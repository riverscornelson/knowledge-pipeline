"""
Integration tests for the complete knowledge pipeline flow.
"""
import pytest
from unittest.mock import patch, Mock, MagicMock
from datetime import datetime

from src.core.models import SourceContent, ContentStatus, ContentType
from src.core.config import PipelineConfig
from src.drive.ingester import DriveIngester
from src.enrichment.pipeline_processor import PipelineProcessor


class TestPipelineIntegration:
    """Test complete pipeline flow from ingestion to enrichment."""
    
    def test_drive_to_enrichment_flow(self, mock_env_vars):
        """Test complete flow: Drive → Notion → Enrichment."""
        # Setup mock Google Drive file
        mock_drive_files = [{
            "id": "drive-123",
            "name": "AI Research Paper.pdf",
            "mimeType": "application/pdf",
            "webViewLink": "https://drive.google.com/file/d/drive-123/view",
            "createdTime": "2024-01-01T00:00:00Z"
        }]
        
        # Setup mock services
        mock_drive_service = Mock()
        mock_drive_service.files().list().execute.return_value = {"files": mock_drive_files}
        mock_drive_service.files().get_media().execute.return_value = b"PDF content about AI"
        
        mock_notion_client = Mock()
        mock_notion_client.check_duplicate_hash.return_value = False
        mock_notion_client.create_page.return_value = "new-page-123"
        
        # Inbox items for enrichment
        mock_notion_client.get_inbox_items.return_value = iter([{
            "id": "new-page-123",
            "properties": {
                "Title": {"title": [{"text": {"content": "AI Research Paper"}}]},
                "Status": {"select": {"name": "Inbox"}},
                "Drive URL": {"url": "https://drive.google.com/file/d/drive-123/view"},
                "Hash": {"rich_text": [{"text": {"content": "abc123"}}]},
            }
        }])
        
        # Mock PDF processing - SourceContent doesn't have content field
        mock_pdf_content = SourceContent(
            title="AI Research Paper",
            status=ContentStatus.INBOX,
            hash="abc123",
            content_type=ContentType.PDF,
            drive_url="https://drive.google.com/file/d/drive-123/view",
            created_date="2024-01-01T00:00:00Z"
        )
        
        # Mock OpenAI responses
        mock_openai_client = Mock()
        mock_openai_client.chat.completions.create.return_value = Mock(
            choices=[Mock(message=Mock(content="AI research summary under 200 chars"))]
        )
        
        # Execute the pipeline
        with patch('src.drive.ingester.Credentials'):
            with patch('src.drive.ingester.build', return_value=mock_drive_service):
                with patch('src.drive.ingester.NotionClient') as mock_notion_class:
                    mock_notion_class.return_value = mock_notion_client
                    with patch('src.drive.ingester.PDFProcessor') as mock_pdf_class:
                        mock_pdf_processor = Mock()
                        mock_pdf_processor.process_pdf_file.return_value = mock_pdf_content
                        mock_pdf_class.return_value = mock_pdf_processor
                        
                        # Step 1: Ingest from Drive - DriveIngester doesn't have from_env
                        with patch('src.drive.ingester.PipelineConfig') as mock_config_class:
                            mock_config = Mock()
                            mock_config.google_drive.folder_id = "test-folder-id"
                            mock_config.rate_limit_delay = 0
                            mock_config_class.from_env.return_value = mock_config
                            
                            with patch('src.drive.ingester.PDFProcessor'):
                                with patch('src.drive.ingester.DeduplicationService') as mock_dedup:
                                    mock_dedup_instance = Mock()
                                    mock_dedup_instance.calculate_drive_file_hash.return_value = "abc123"
                                    mock_dedup.return_value = mock_dedup_instance
                                    
                                    ingester = DriveIngester(mock_config, mock_notion_client)
                                    mock_notion_client.get_existing_drive_files.return_value = (set(), set())
                                    ingest_stats = ingester.ingest(skip_existing=True)
                        
                                    # Verify ingestion
                                    assert ingest_stats["total"] == 1
                                    assert ingest_stats["new"] == 1
                                    mock_notion_client.create_page.assert_called_once()
                        
                        # Step 2: Enrich the content
                        with patch('src.enrichment.pipeline_processor.NotionClient') as mock_notion_class2:
                            mock_notion_class2.return_value = mock_notion_client
                            
                            with patch('src.enrichment.pipeline_processor.AdvancedContentSummarizer'):
                                with patch('src.enrichment.pipeline_processor.AdvancedContentClassifier'):
                                    with patch('src.enrichment.pipeline_processor.AdvancedInsightsGenerator'):
                                        with patch.object(PipelineProcessor, '_load_taxonomy', return_value={'content_types': [], 'ai_primitives': [], 'vendors': []}):
                                            processor = PipelineProcessor(mock_config, mock_notion_client)
                                            # Mock extract_content to return something
                                            with patch.object(processor, '_extract_content', return_value="Test content"):
                                                with patch.object(processor, 'enrich_content') as mock_enrich:
                                                    from src.core.models import EnrichmentResult
                                                    mock_enrich.return_value = EnrichmentResult(
                                                            core_summary="AI research summary",
                                                            key_insights=["Insight 1"],
                                                            content_type="Technical",
                                                            ai_primitives=["Classification"],
                                                            vendor="OpenAI",
                                                            confidence_scores={"classification": 0.9},
                                                            processing_time=1.0,
                                                            token_usage={"prompt": 100, "completion": 50}
                                                    )
                                                    with patch.object(processor, '_store_results'):
                                                        enrich_stats = processor.process_batch(limit=1)
                                                        
                                                        # Verify enrichment
                                                        assert enrich_stats["processed"] == 1
                                                        assert enrich_stats["failed"] == 0
    
    def test_pipeline_handles_errors_gracefully(self, mock_env_vars):
        """Test that pipeline continues processing despite individual errors."""
        # Setup services with some failures
        mock_drive_service = Mock()
        mock_drive_service.files().list().execute.return_value = {
            "files": [
                {"id": "file1", "name": "doc1.pdf", "webViewLink": "http://example.com/1"},
                {"id": "file2", "name": "doc2.pdf", "webViewLink": "http://example.com/2"},
            ]
        }
        
        mock_notion_client = Mock()
        mock_notion_client.check_duplicate_hash.return_value = False
        
        # First create succeeds, second fails
        mock_notion_client.create_page.side_effect = [
            "page-1",
            Exception("Notion API error")
        ]
        
        with patch('src.drive.ingester.Credentials'):
            with patch('src.drive.ingester.build', return_value=mock_drive_service):
                with patch('src.drive.ingester.NotionClient') as mock_notion_class:
                    mock_notion_class.return_value = mock_notion_client
                    with patch('src.drive.ingester.PDFProcessor') as mock_pdf_class:
                        mock_pdf_processor = Mock()
                        mock_pdf_processor.process_pdf_file.return_value = Mock(
                            to_notion_properties=Mock(return_value={})
                        )
                        mock_pdf_class.return_value = mock_pdf_processor
                        
                        with patch('src.drive.ingester.PipelineConfig') as mock_config_class:
                            mock_config = Mock()
                            mock_config.google_drive.folder_id = "test-folder-id"
                            mock_config.rate_limit_delay = 0
                            mock_config_class.from_env.return_value = mock_config
                            
                            with patch('src.drive.ingester.PDFProcessor'):
                                with patch('src.drive.ingester.DeduplicationService') as mock_dedup:
                                    mock_dedup_instance = Mock()
                                    mock_dedup_instance.calculate_drive_file_hash.return_value = "unique-hash"
                                    mock_dedup.return_value = mock_dedup_instance
                                    
                                    mock_notion_client.get_existing_drive_files.return_value = (set(), set())
                                    ingester = DriveIngester(mock_config, mock_notion_client)
                                    stats = ingester.ingest()
                        
                                    # Should process both files
                                    assert stats["total"] == 2
                                    assert stats["new"] == 1  # One succeeded
                                    assert stats["skipped"] == 1  # One failed counts as skipped
    
    def test_empty_pipeline_run(self, mock_env_vars):
        """Test pipeline handles empty inputs gracefully."""
        mock_drive_service = Mock()
        mock_drive_service.files().list().execute.return_value = {"files": []}
        
        mock_notion_client = Mock()
        mock_notion_client.get_inbox_items.return_value = iter([])  # Empty inbox
        
        with patch('src.drive.ingester.Credentials'):
            with patch('src.drive.ingester.build', return_value=mock_drive_service):
                with patch('src.drive.ingester.NotionClient') as mock_notion_class:
                    mock_notion_class.return_value = mock_notion_client
                    
                    # Ingest should handle no files
                    with patch('src.drive.ingester.PipelineConfig') as mock_config_class:
                        mock_config = Mock()
                        mock_config.google_drive.folder_id = "empty-folder-id"
                        mock_config.rate_limit_delay = 0
                        mock_config_class.from_env.return_value = mock_config
                        
                        with patch('src.drive.ingester.PDFProcessor'):
                            with patch('src.drive.ingester.DeduplicationService'):
                                mock_notion_client.get_existing_drive_files.return_value = (set(), set())
                                ingester = DriveIngester(mock_config, mock_notion_client)
                                ingest_stats = ingester.ingest()
                                assert ingest_stats["total"] == 0
                    
                    # Enrichment should handle empty inbox
                    with patch('src.enrichment.pipeline_processor.NotionClient') as mock_notion_class2:
                        mock_notion_class2.return_value = mock_notion_client
                        
                        with patch('src.enrichment.pipeline_processor.AdvancedContentSummarizer'):
                            with patch('src.enrichment.pipeline_processor.AdvancedContentClassifier'):
                                with patch('src.enrichment.pipeline_processor.AdvancedInsightsGenerator'):
                                    with patch.object(PipelineProcessor, '_load_taxonomy', return_value={'content_types': [], 'ai_primitives': [], 'vendors': []}):
                                        processor = PipelineProcessor(mock_config, mock_notion_client)
                                        enrich_stats = processor.process_batch()
                                        assert enrich_stats["processed"] == 0