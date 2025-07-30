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
    
    def test_init_with_deeplink_dedup_enabled(self, mock_config, mock_notion_client):
        """Test initializing ingester with deeplink deduplication enabled."""
        # Enable deeplink deduplication in config
        mock_config.google_drive.use_deeplink_dedup = True
        
        with patch('src.drive.ingester.Credentials'):
            with patch('src.drive.ingester.build'):
                with patch('src.drive.ingester.PDFProcessor'):
                    with patch('src.drive.ingester.DeduplicationService') as mock_dedup_class:
                        ingester = DriveIngester(mock_config, mock_notion_client)
                        
                        # Verify DeduplicationService was initialized with deeplink mode
                        mock_dedup_class.assert_called_once_with(use_deeplink_dedup=True)
    
    def test_process_file_with_deeplink_dedup(self, mock_config, mock_notion_client, mock_drive_service):
        """Test processing file with deeplink deduplication (skips hash calculation)."""
        # Enable deeplink deduplication
        mock_config.google_drive.use_deeplink_dedup = True
        
        file_info = {
            "id": "file-123",
            "name": "Test Document.pdf",
            "webViewLink": "https://drive.google.com/file/d/file-123/view",
            "createdTime": "2024-01-01T00:00:00Z"
        }
        
        with patch('src.drive.ingester.Credentials'):
            with patch('src.drive.ingester.build') as mock_build:
                mock_build.return_value = mock_drive_service
                with patch('src.drive.ingester.PDFProcessor'):
                    with patch('src.drive.ingester.DeduplicationService') as mock_dedup_class:
                        mock_dedup = Mock()
                        mock_dedup_class.return_value = mock_dedup
                        
                        ingester = DriveIngester(mock_config, mock_notion_client)
                        content = ingester.process_file(file_info, skip_hash_calculation=True)
                        
                        # Should NOT call calculate_drive_file_hash
                        mock_dedup.calculate_drive_file_hash.assert_not_called()
                        
                        # Should use drive_id as hash
                        assert content.hash == "drive_id:file-123"
    
    def test_ingest_with_deeplink_dedup(self, mock_config, mock_notion_client, mock_drive_service):
        """Test full ingestion with deeplink deduplication."""
        # Enable deeplink deduplication
        mock_config.google_drive.use_deeplink_dedup = True
        
        # Mock file list
        mock_drive_service.files().list().execute.return_value = {
            "files": [
                {
                    "id": "new-file-1",
                    "name": "new-doc1.pdf",
                    "webViewLink": "https://drive.google.com/file/d/new-file-1/view",
                    "createdTime": "2024-01-01T00:00:00Z"
                },
                {
                    "id": "duplicate-file",
                    "name": "duplicate-doc.pdf",
                    "webViewLink": "https://drive.google.com/file/d/duplicate-file/view",
                    "createdTime": "2024-01-01T00:00:00Z"
                }
            ]
        }
        
        # Mock existing files
        mock_notion_client.get_existing_drive_files.return_value = (set(), set())
        mock_notion_client.create_page.return_value = "new-page-id"
        
        with patch('src.drive.ingester.Credentials'):
            with patch('src.drive.ingester.build') as mock_build:
                mock_build.return_value = mock_drive_service
                with patch('src.drive.ingester.PDFProcessor'):
                    with patch('src.drive.ingester.DeduplicationService') as mock_dedup_class:
                        mock_dedup = Mock()
                        # First file is not duplicate, second is duplicate
                        mock_dedup.is_duplicate_by_deeplink.side_effect = [False, True]
                        mock_dedup_class.return_value = mock_dedup
                        
                        # Mock _get_existing_drive_urls
                        with patch.object(DriveIngester, '_get_existing_drive_urls') as mock_get_urls:
                            mock_get_urls.return_value = {
                                "https://drive.google.com/file/d/existing-1/view"
                            }
                            
                            ingester = DriveIngester(mock_config, mock_notion_client)
                            stats = ingester.ingest(skip_existing=True)
                            
                            # Verify stats
                            assert stats["total"] == 2
                            assert stats["new"] == 1  # Only first file added
                            assert stats["skipped"] == 1  # Second file was duplicate
                            
                            # Verify is_duplicate_by_deeplink was called for both files
                            assert mock_dedup.is_duplicate_by_deeplink.call_count == 2
                            
                            # Verify only one page was created
                            mock_notion_client.create_page.assert_called_once()
    
    def test_get_existing_drive_urls(self, mock_config, mock_notion_client, mock_drive_service):
        """Test fetching existing Drive URLs from Notion."""
        # Mock Notion response with Drive URLs
        mock_notion_client.client.databases.query.return_value = {
            "results": [
                {
                    "properties": {
                        "Drive URL": {"url": "https://drive.google.com/file/d/existing-1/view"}
                    }
                },
                {
                    "properties": {
                        "Drive URL": {"url": "https://drive.google.com/file/d/existing-2/view"}
                    }
                },
                {
                    "properties": {
                        "Drive URL": {"url": None}  # Should be skipped
                    }
                },
                {
                    "properties": {}  # No Drive URL property
                }
            ],
            "has_more": False
        }
        
        with patch('src.drive.ingester.Credentials'):
            with patch('src.drive.ingester.build') as mock_build:
                mock_build.return_value = mock_drive_service
                with patch('src.drive.ingester.PDFProcessor'):
                    with patch('src.drive.ingester.DeduplicationService'):
                        ingester = DriveIngester(mock_config, mock_notion_client)
                        urls = ingester._get_existing_drive_urls()
                        
                        assert len(urls) == 2
                        assert "https://drive.google.com/file/d/existing-1/view" in urls
                        assert "https://drive.google.com/file/d/existing-2/view" in urls
    
    def test_iter_drive_urls_pagination(self, mock_config, mock_notion_client, mock_drive_service):
        """Test iterating through Drive URLs with pagination."""
        # Mock paginated responses
        page1_response = {
            "results": [
                {"properties": {"Drive URL": {"url": f"https://drive.google.com/file/d/file-{i}/view"}}}
                for i in range(100)
            ],
            "has_more": True,
            "next_cursor": "cursor-page-2"
        }
        
        page2_response = {
            "results": [
                {"properties": {"Drive URL": {"url": f"https://drive.google.com/file/d/file-{i}/view"}}}
                for i in range(100, 150)
            ],
            "has_more": False
        }
        
        mock_notion_client.client.databases.query.side_effect = [page1_response, page2_response]
        
        with patch('src.drive.ingester.Credentials'):
            with patch('src.drive.ingester.build') as mock_build:
                mock_build.return_value = mock_drive_service
                with patch('src.drive.ingester.PDFProcessor'):
                    with patch('src.drive.ingester.DeduplicationService'):
                        ingester = DriveIngester(mock_config, mock_notion_client)
                        
                        # Collect all URLs
                        urls = list(ingester._iter_drive_urls())
                        
                        assert len(urls) == 150
                        assert urls[0] == "https://drive.google.com/file/d/file-0/view"
                        assert urls[149] == "https://drive.google.com/file/d/file-149/view"
                        
                        # Verify pagination calls
                        assert mock_notion_client.client.databases.query.call_count == 2
    
    def test_get_existing_drive_urls_error_handling(self, mock_config, mock_notion_client, mock_drive_service):
        """Test error handling when fetching Drive URLs."""
        # Mock database query to raise exception
        mock_notion_client.client.databases.query.side_effect = Exception("API Error")
        
        with patch('src.drive.ingester.Credentials'):
            with patch('src.drive.ingester.build') as mock_build:
                mock_build.return_value = mock_drive_service
                with patch('src.drive.ingester.PDFProcessor'):
                    with patch('src.drive.ingester.DeduplicationService'):
                        ingester = DriveIngester(mock_config, mock_notion_client)
                        
                        # Should return empty set on error
                        urls = ingester._get_existing_drive_urls()
                        assert urls == set()
    
    def test_ingest_mixed_deduplication_modes(self, mock_config, mock_notion_client, mock_drive_service):
        """Test switching between hash and deeplink deduplication modes."""
        # Start with hash-based deduplication
        mock_config.google_drive.use_deeplink_dedup = False
        
        # Mock file
        mock_drive_service.files().list().execute.return_value = {
            "files": [{
                "id": "test-file",
                "name": "test.pdf",
                "webViewLink": "https://drive.google.com/file/d/test-file/view",
                "createdTime": "2024-01-01T00:00:00Z"
            }]
        }
        
        mock_notion_client.get_existing_drive_files.return_value = (set(), set())
        mock_notion_client.create_page.return_value = "page-id"
        
        with patch('src.drive.ingester.Credentials'):
            with patch('src.drive.ingester.build') as mock_build:
                mock_build.return_value = mock_drive_service
                with patch('src.drive.ingester.PDFProcessor'):
                    with patch('src.drive.ingester.DeduplicationService') as mock_dedup_class:
                        mock_dedup = Mock()
                        mock_dedup.calculate_drive_file_hash.return_value = "file-hash"
                        mock_dedup_class.return_value = mock_dedup
                        
                        # First run with hash-based
                        ingester = DriveIngester(mock_config, mock_notion_client)
                        stats1 = ingester.ingest()
                        
                        # Should have called calculate_drive_file_hash
                        mock_dedup.calculate_drive_file_hash.assert_called()
                        
                        # Now switch to deeplink mode
                        mock_config.google_drive.use_deeplink_dedup = True
                        mock_dedup.is_duplicate_by_deeplink.return_value = False
                        
                        with patch.object(DriveIngester, '_get_existing_drive_urls') as mock_get_urls:
                            mock_get_urls.return_value = set()
                            
                            # Create new ingester with deeplink mode
                            mock_dedup_class.reset_mock()
                            ingester2 = DriveIngester(mock_config, mock_notion_client)
                            
                            # Verify new dedup service created with deeplink mode
                            mock_dedup_class.assert_called_with(use_deeplink_dedup=True)