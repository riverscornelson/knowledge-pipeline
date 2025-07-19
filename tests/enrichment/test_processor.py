"""
Tests for enrichment processor orchestration.
"""
import pytest
from unittest.mock import patch, Mock, MagicMock
from contextlib import contextmanager
from dataclasses import dataclass
from typing import List, Optional

from src.enrichment.pipeline_processor import PipelineProcessor
from src.core.models import ContentStatus, EnrichmentResult


@contextmanager
def patch_pipeline_dependencies(web_search_enabled=False):
    """Helper to patch all pipeline processor dependencies."""
    with patch('src.enrichment.pipeline_processor.AdvancedContentSummarizer') as mock_summarizer:
        with patch('src.enrichment.pipeline_processor.AdvancedContentClassifier') as mock_classifier:
            with patch('src.enrichment.pipeline_processor.AdvancedInsightsGenerator') as mock_insights:
                with patch('src.enrichment.pipeline_processor.EnhancedContentSummarizer') as mock_enhanced_summarizer:
                    with patch('src.enrichment.pipeline_processor.EnhancedInsightsGenerator') as mock_enhanced_insights:
                        with patch('src.enrichment.pipeline_processor.ContentTagger') as mock_tagger:
                            with patch('src.enrichment.pipeline_processor.PromptConfig') as mock_prompt_config:
                                with patch('src.enrichment.pipeline_processor.PDFProcessor') as mock_pdf_processor:
                                    # Mock prompt config
                                    mock_prompt_instance = Mock()
                                    mock_prompt_instance.web_search_enabled = web_search_enabled
                                    mock_prompt_instance.get_prompt.return_value = {"enabled": True}
                                    mock_prompt_config.return_value = mock_prompt_instance
                                    
                                    yield {
                                        'summarizer': mock_summarizer,
                                        'classifier': mock_classifier,
                                        'insights': mock_insights,
                                        'enhanced_summarizer': mock_enhanced_summarizer,
                                        'enhanced_insights': mock_enhanced_insights,
                                        'tagger': mock_tagger,
                                        'prompt_config': mock_prompt_config,
                                        'pdf_processor': mock_pdf_processor,
                                        'prompt_instance': mock_prompt_instance
                                    }


class TestPipelineProcessor:
    """Test PipelineProcessor orchestration."""
    
    def test_create_processor(self, mock_config, mock_notion_client):
        """Test creating PipelineProcessor instance."""
        # Patch all the components that get initialized
        with patch('src.enrichment.pipeline_processor.AdvancedContentSummarizer') as mock_summarizer_class:
            with patch('src.enrichment.pipeline_processor.AdvancedContentClassifier') as mock_classifier_class:
                with patch('src.enrichment.pipeline_processor.AdvancedInsightsGenerator') as mock_insights_class:
                    with patch('src.enrichment.pipeline_processor.EnhancedContentSummarizer') as mock_enhanced_summarizer:
                        with patch('src.enrichment.pipeline_processor.EnhancedInsightsGenerator') as mock_enhanced_insights:
                            with patch('src.enrichment.pipeline_processor.ContentTagger') as mock_tagger:
                                with patch('src.enrichment.pipeline_processor.PromptConfig') as mock_prompt_config:
                                    with patch('src.enrichment.pipeline_processor.PDFProcessor') as mock_pdf_processor:
                                        # Mock prompt config
                                        mock_prompt_instance = Mock()
                                        mock_prompt_instance.web_search_enabled = False
                                        mock_prompt_instance.get_prompt.return_value = {"enabled": True}
                                        mock_prompt_config.return_value = mock_prompt_instance
                                        
                                        # Mock taxonomy loading
                                        with patch.object(PipelineProcessor, '_load_taxonomy') as mock_load_taxonomy:
                                            mock_load_taxonomy.return_value = {
                                                "content_types": ["Technical"],
                                                "ai_primitives": ["Classification"],
                                                "vendors": ["OpenAI"]
                                            }
                                            
                                            processor = PipelineProcessor(mock_config, mock_notion_client)
                                            
                                            # Verify all components were initialized
                                            mock_summarizer_class.assert_called_once_with(mock_config.openai)
                                            mock_classifier_class.assert_called_once_with(
                                                mock_config.openai,
                                                {
                                                    "content_types": ["Technical"],
                                                    "ai_primitives": ["Classification"],
                                                    "vendors": ["OpenAI"]
                                                }
                                            )
                                            mock_insights_class.assert_called_once_with(mock_config.openai)
                                            assert processor.config == mock_config
                                            assert processor.notion_client == mock_notion_client
    
    def test_enrich_content(self, mock_config, mock_notion_client, sample_notion_page):
        """Test enriching content with all AI components."""
        # Mock the components
        mock_summarizer = Mock()
        mock_summarizer.generate_summary.return_value = "# Full Summary\n\nDetailed content"
        mock_summarizer.generate_brief_summary.return_value = "Brief summary under 200 chars"
        
        mock_classifier = Mock()
        mock_classifier.classify_content.return_value = {
            "content_type": "Technical",
            "ai_primitives": ["Classification", "Analysis"],
            "vendor": "OpenAI",
            "confidence": "high"
        }
        
        mock_insights = Mock()
        mock_insights.generate_insights.return_value = [
            "Key insight 1",
            "Key insight 2",
            "Key insight 3"
        ]
        
        # Mock prompt config
        mock_prompt_instance = Mock()
        mock_prompt_instance.web_search_enabled = False
        mock_prompt_instance.get_prompt.return_value = {"enabled": True}
        
        # Mock content tagger
        mock_tagger_instance = Mock()
        mock_tagger_instance.analyze.return_value = {
            "success": True,
            "topical_tags": ["AI", "Technology"],
            "domain_tags": ["Machine Learning"]
        }
        
        with patch('src.enrichment.pipeline_processor.AdvancedContentSummarizer') as mock_summarizer_class:
            mock_summarizer_class.return_value = mock_summarizer
            with patch('src.enrichment.pipeline_processor.AdvancedContentClassifier') as mock_classifier_class:
                mock_classifier_class.return_value = mock_classifier
                with patch('src.enrichment.pipeline_processor.AdvancedInsightsGenerator') as mock_insights_class:
                    mock_insights_class.return_value = mock_insights
                    with patch('src.enrichment.pipeline_processor.EnhancedContentSummarizer'):
                        with patch('src.enrichment.pipeline_processor.EnhancedInsightsGenerator'):
                            with patch('src.enrichment.pipeline_processor.ContentTagger') as mock_tagger_class:
                                mock_tagger_class.return_value = mock_tagger_instance
                                with patch('src.enrichment.pipeline_processor.PromptConfig') as mock_prompt_config:
                                    mock_prompt_config.return_value = mock_prompt_instance
                                    with patch('src.enrichment.pipeline_processor.PDFProcessor'):
                                        with patch.object(PipelineProcessor, '_load_taxonomy') as mock_load_taxonomy:
                                            mock_load_taxonomy.return_value = {"content_types": [], "ai_primitives": [], "vendors": []}
                                            
                                            processor = PipelineProcessor(mock_config, mock_notion_client)
                                            result = processor.enrich_content(
                                                content="Test content about AI",
                                                item=sample_notion_page
                                            )
                                            
                                            # Verify all components were called
                                            mock_summarizer.generate_summary.assert_called_once_with("Test content about AI", "Test Page")
                                            mock_classifier.classify_content.assert_called_once_with("Test content about AI", "Test Page")
                                            mock_insights.generate_insights.assert_called_once_with("Test content about AI", "Test Page")
                                            
                                            # Check result
                                            assert isinstance(result, EnrichmentResult)
                                            assert result.core_summary == "# Full Summary\n\nDetailed content"
                                            assert result.content_type == "Technical"
                                            assert result.ai_primitives == ["Classification", "Analysis"]
                                            assert result.vendor == "OpenAI"
                                            assert len(result.key_insights) == 3
    
    def test_process_batch(self, mock_config, mock_notion_client):
        """Test processing a batch of inbox items."""
        # Mock inbox items
        mock_notion_client.get_inbox_items.return_value = iter([
            {"id": "page-1", "properties": {"Title": {"title": [{"text": {"content": "Doc 1"}}]}}},
            {"id": "page-2", "properties": {"Title": {"title": [{"text": {"content": "Doc 2"}}]}}},
        ])
        
        # Mock content extraction
        with patch.object(PipelineProcessor, '_extract_content') as mock_extract:
            mock_extract.return_value = "Extracted content"
            
            # Mock enrichment
            with patch.object(PipelineProcessor, 'enrich_content') as mock_enrich:
                mock_result = EnrichmentResult(
                    core_summary="Summary",
                    key_insights=["Insight 1"],
                    content_type="Technical",
                    ai_primitives=["Analysis"],
                    vendor="OpenAI",
                    confidence_scores={"classification": 0.95},
                    processing_time=1.5,
                    token_usage={"prompt": 100, "completion": 50}
                )
                mock_enrich.return_value = mock_result
                
                # Mock storage
                with patch.object(PipelineProcessor, '_store_results') as mock_store:
                    with patch('src.enrichment.pipeline_processor.AdvancedContentSummarizer'):
                        with patch('src.enrichment.pipeline_processor.AdvancedContentClassifier'):
                            with patch('src.enrichment.pipeline_processor.AdvancedInsightsGenerator'):
                                with patch('src.enrichment.pipeline_processor.EnhancedContentSummarizer'):
                                    with patch('src.enrichment.pipeline_processor.EnhancedInsightsGenerator'):
                                        with patch('src.enrichment.pipeline_processor.ContentTagger'):
                                            with patch('src.enrichment.pipeline_processor.PromptConfig') as mock_prompt_config:
                                                # Mock prompt config
                                                mock_prompt_instance = Mock()
                                                mock_prompt_instance.web_search_enabled = False
                                                mock_prompt_instance.get_prompt.return_value = {"enabled": True}
                                                mock_prompt_config.return_value = mock_prompt_instance
                                                
                                                with patch('src.enrichment.pipeline_processor.PDFProcessor'):
                                                    with patch.object(PipelineProcessor, '_load_taxonomy') as mock_load_taxonomy:
                                                        mock_load_taxonomy.return_value = {"content_types": [], "ai_primitives": [], "vendors": []}
                                                        
                                                        processor = PipelineProcessor(mock_config, mock_notion_client)
                                                        stats = processor.process_batch(limit=10)
                                                        
                                                        # Verify stats
                                                        assert stats["processed"] == 2
                                                        assert stats["failed"] == 0
                                                        assert stats["skipped"] == 0
                                                        
                                                        # Verify both items were processed
                                                        assert mock_extract.call_count == 2
                                                        assert mock_enrich.call_count == 2
                                                        assert mock_store.call_count == 2
    
    def test_load_taxonomy(self, mock_config, mock_notion_client):
        """Test loading taxonomy from Notion database schema."""
        # Mock the nested client.databases.retrieve
        mock_client = Mock()
        mock_databases = Mock()
        mock_client.databases = mock_databases
        mock_notion_client.client = mock_client
        mock_notion_client.db_id = "test-database-id"
        mock_databases.retrieve.return_value = {
            "properties": {
                "Content-Type": {
                    "select": {
                        "options": [
                            {"name": "Technical"},
                            {"name": "Tutorial"},
                            {"name": "Research"}
                        ]
                    }
                },
                "AI-Primitive": {
                    "multi_select": {
                        "options": [
                            {"name": "Classification"},
                            {"name": "Generation"},
                            {"name": "Analysis"}
                        ]
                    }
                },
                "Vendor": {
                    "select": {
                        "options": [
                            {"name": "OpenAI"},
                            {"name": "Google"}
                        ]
                    }
                }
            }
        }
        
        with patch('src.enrichment.pipeline_processor.AdvancedContentSummarizer'):
            with patch('src.enrichment.pipeline_processor.AdvancedContentClassifier'):
                with patch('src.enrichment.pipeline_processor.AdvancedInsightsGenerator'):
                    with patch('src.enrichment.pipeline_processor.EnhancedContentSummarizer'):
                        with patch('src.enrichment.pipeline_processor.EnhancedInsightsGenerator'):
                            with patch('src.enrichment.pipeline_processor.ContentTagger'):
                                with patch('src.enrichment.pipeline_processor.PromptConfig') as mock_prompt_config:
                                    # Mock prompt config
                                    mock_prompt_instance = Mock()
                                    mock_prompt_instance.web_search_enabled = False
                                    mock_prompt_instance.get_prompt.return_value = {"enabled": True}
                                    mock_prompt_config.return_value = mock_prompt_instance
                                    
                                    with patch('src.enrichment.pipeline_processor.PDFProcessor'):
                                        processor = PipelineProcessor(mock_config, mock_notion_client)
                                        
                                        # The taxonomy should have been loaded during init
                                        # Let's verify by checking the classifier was created with correct taxonomy
                                        assert mock_databases.retrieve.called