"""
Tests for Google Drive ingestion functionality.
"""
import pytest
from unittest.mock import patch, Mock, MagicMock
from datetime import datetime

from src.drive.ingester import DriveIngester
from src.core.models import SourceContent, ContentStatus, ContentType


class TestDriveIngester:
    """Test DriveIngester functionality."""
    
    def test_create_ingester_with_credentials(self, mock_config, mock_notion_client, mock_drive_service):
        """Test creating DriveIngester with valid credentials."""
        with patch('src.drive.ingester.Credentials') as mock_creds_class:
            with patch('src.drive.ingester.build') as mock_build:
                mock_build.return_value = mock_drive_service
                mock_creds = Mock()
                mock_creds_class.from_service_account_file.return_value = mock_creds
                
                # Mock PDFProcessor and DeduplicationService
                with patch('src.drive.ingester.PDFProcessor'):
                    with patch('src.drive.ingester.DeduplicationService'):
                        ingester = DriveIngester(mock_config, mock_notion_client)
                        
                        # Verify credentials were loaded (without scopes)
                        mock_creds_class.from_service_account_file.assert_called_once_with(
                            "/path/to/test-creds.json"
                        )
                        
                        # Verify service was built
                        mock_build.assert_called_once_with('drive', 'v3', credentials=mock_creds, cache_discovery=False)
                        assert ingester.drive == mock_drive_service
    
    def test_create_ingester_without_credentials(self, mock_config, mock_notion_client):
        """Test creating ingester without credentials file."""
        # Mock missing credentials
        with patch('src.drive.ingester.Credentials') as mock_creds_class:
            # Make from_service_account_file raise FileNotFoundError
            mock_creds_class.from_service_account_file.side_effect = FileNotFoundError()
            
            with patch('src.drive.ingester.PDFProcessor'):
                with patch('src.drive.ingester.DeduplicationService'):
                    # The logger is instance variable, not module-level
                    ingester = DriveIngester(mock_config, mock_notion_client)
                    
                    # Drive should be None
                    assert ingester.drive is None
    
    def test_get_folder_files(self, mock_config, mock_notion_client, mock_drive_service):
        """Test getting files from Drive folder."""
        # Mock Drive API response
        mock_drive_service.files().list().execute.return_value = {
            "files": [
                {
                    "id": "file-123",
                    "name": "test-document.pdf",
                    "webViewLink": "https://drive.google.com/file/d/file-123/view",
                    "mimeType": "application/pdf",
                    "createdTime": "2024-01-01T00:00:00Z",
                    "modifiedTime": "2024-01-01T00:00:00Z",
                    "size": "1024"
                }
            ]
        }
        
        with patch('src.drive.ingester.Credentials'):
            with patch('src.drive.ingester.build') as mock_build:
                mock_build.return_value = mock_drive_service
                with patch('src.drive.ingester.PDFProcessor'):
                    with patch('src.drive.ingester.DeduplicationService'):
                        ingester = DriveIngester(mock_config, mock_notion_client)
                        files = ingester.get_folder_files()
                        
                        # Verify API call
                        mock_drive_service.files().list.assert_called()
                        
                        # Check results
                        assert len(files) == 1
                        assert files[0]["name"] == "test-document.pdf"
    
    def test_process_file(self, mock_config, mock_notion_client, mock_drive_service):
        """Test processing a single file."""
        file_info = {
            "id": "file-123",
            "name": "AI Research Paper.pdf",
            "webViewLink": "https://drive.google.com/file/d/file-123/view",
            "createdTime": "2024-01-01T00:00:00Z"
        }
        
        # Mock file download
        mock_drive_service.files().get_media().execute.return_value = b"PDF content"
        
        with patch('src.drive.ingester.Credentials'):
            with patch('src.drive.ingester.build') as mock_build:
                mock_build.return_value = mock_drive_service
                with patch('src.drive.ingester.PDFProcessor') as mock_pdf_class:
                    with patch('src.drive.ingester.DeduplicationService') as mock_dedup_class:
                        # Mock PDF processing
                        mock_pdf_processor = Mock()
                        mock_pdf_class.return_value = mock_pdf_processor
                        
                        # Mock deduplication - calculate_drive_file_hash is the correct method
                        mock_dedup = Mock()
                        mock_dedup.calculate_drive_file_hash.return_value = "abc123hash"
                        mock_dedup_class.return_value = mock_dedup
                        
                        ingester = DriveIngester(mock_config, mock_notion_client)
                        content = ingester.process_file(file_info)
                        
                        # Verify result
                        assert isinstance(content, SourceContent)
                        assert content.title == "AI Research Paper.pdf"
                        assert content.status == ContentStatus.INBOX
                        assert content.hash == "abc123hash"
                        assert content.content_type == ContentType.PDF
                        assert content.drive_url == "https://drive.google.com/file/d/file-123/view"
    
    def test_ingest(self, mock_config, mock_notion_client, mock_drive_service):
        """Test full ingestion flow."""
        # Mock file list
        mock_drive_service.files().list().execute.return_value = {
            "files": [
                {"id": "file-1", "name": "doc1.pdf", "webViewLink": "https://example.com/1", "createdTime": "2024-01-01T00:00:00Z"},
                {"id": "file-2", "name": "doc2.pdf", "webViewLink": "https://example.com/2", "createdTime": "2024-01-01T00:00:00Z"},
            ]
        }
        
        # Mock Notion responses - returns (file_ids, hashes)
        mock_notion_client.get_existing_drive_files.return_value = ({"file-1"}, {"hash1"})  # file-1 exists by ID
        mock_notion_client.create_page.return_value = "new-page-id"
        
        with patch('src.drive.ingester.Credentials'):
            with patch('src.drive.ingester.build') as mock_build:
                mock_build.return_value = mock_drive_service
                with patch('src.drive.ingester.PDFProcessor') as mock_pdf_class:
                    with patch('src.drive.ingester.DeduplicationService') as mock_dedup_class:
                        # Mock processors
                        mock_pdf = Mock()
                        mock_pdf_class.return_value = mock_pdf
                        
                        mock_dedup = Mock()
                        # file-2 gets hash2 which matches known_hashes, so will be skipped
                        mock_dedup.calculate_drive_file_hash.return_value = "hash1"
                        mock_dedup_class.return_value = mock_dedup
                        
                        ingester = DriveIngester(mock_config, mock_notion_client)
                        stats = ingester.ingest(skip_existing=True)
                        
                        # Verify stats
                        assert stats["total"] == 2
                        assert stats["new"] == 0  # Both files are skipped
                        assert stats["skipped"] == 2  # file-1 by ID, file-2 by hash
                        
                        # Verify no pages were created
                        mock_notion_client.create_page.assert_not_called()
    
    def test_ingest_no_drive_service(self, mock_config, mock_notion_client):
        """Test ingestion fails gracefully without Drive service."""
        mock_config.google_drive.service_account_path = ""
        
        with patch('src.drive.ingester.PDFProcessor'):
            with patch('src.drive.ingester.DeduplicationService'):
                ingester = DriveIngester(mock_config, mock_notion_client)
                stats = ingester.ingest()
                
                # Should return empty stats
                assert stats["total"] == 0
                assert stats["new"] == 0
                assert stats["skipped"] == 0