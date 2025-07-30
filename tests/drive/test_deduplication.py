"""
Tests for the deduplication service with deeplink support.
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
import io

from src.drive.deduplication import DeduplicationService


class TestDeduplicationService:
    """Test cases for DeduplicationService."""
    
    def test_init_default_mode(self):
        """Test initialization with default hash-based mode."""
        service = DeduplicationService()
        assert service.use_deeplink_dedup is False
        assert service.logger is not None
    
    def test_init_deeplink_mode(self):
        """Test initialization with deeplink deduplication enabled."""
        service = DeduplicationService(use_deeplink_dedup=True)
        assert service.use_deeplink_dedup is True
        assert service.logger is not None
    
    def test_calculate_hash(self):
        """Test SHA-256 hash calculation."""
        service = DeduplicationService()
        content = b"Test content for hashing"
        expected_hash = "c7e61601675e5c2a1b4d19d6b61db327e1b7e79c3f5c7e34a3eb7b3a3a9d6c8f"
        
        result = service.calculate_hash(content)
        assert len(result) == 64  # SHA-256 produces 64 character hex string
        assert isinstance(result, str)
        
        # Same content should produce same hash
        assert service.calculate_hash(content) == result
        
        # Different content should produce different hash
        assert service.calculate_hash(b"Different content") != result
    
    def test_calculate_text_hash(self):
        """Test text content hashing."""
        service = DeduplicationService()
        text = "Test text content"
        
        result = service.calculate_text_hash(text)
        assert len(result) == 64
        assert isinstance(result, str)
        
        # Should be same as calculating hash of encoded text
        assert result == service.calculate_hash(text.encode('utf-8'))
    
    def test_calculate_url_hash(self):
        """Test URL hashing with normalization."""
        service = DeduplicationService()
        
        # URLs with trailing slashes should produce same hash
        url1 = "https://example.com/page/"
        url2 = "https://example.com/page"
        assert service.calculate_url_hash(url1) == service.calculate_url_hash(url2)
        
        # URLs with query params should be normalized
        url_with_params = "https://example.com/page?utm_source=test"
        url_without_params = "https://example.com/page"
        assert service.calculate_url_hash(url_with_params) == service.calculate_url_hash(url_without_params)
    
    def test_extract_file_id_from_url_format1(self):
        """Test extracting file ID from /file/d/{ID}/view format."""
        service = DeduplicationService()
        
        # Standard format
        url = "https://drive.google.com/file/d/1234567890abcdef/view"
        assert service.extract_file_id_from_url(url) == "1234567890abcdef"
        
        # With additional params
        url = "https://drive.google.com/file/d/abc-123_xyz/view?usp=sharing"
        assert service.extract_file_id_from_url(url) == "abc-123_xyz"
        
        # Docs subdomain
        url = "https://docs.google.com/file/d/test123/view"
        assert service.extract_file_id_from_url(url) == "test123"
    
    def test_extract_file_id_from_url_format2(self):
        """Test extracting file ID from open?id={ID} format."""
        service = DeduplicationService()
        
        # Open format
        url = "https://drive.google.com/open?id=xyz789def456"
        assert service.extract_file_id_from_url(url) == "xyz789def456"
        
        # With additional params
        url = "https://drive.google.com/open?id=test_file-123&other=param"
        assert service.extract_file_id_from_url(url) == "test_file-123"
    
    def test_extract_file_id_from_url_format3(self):
        """Test extracting file ID from uc?id={ID} format."""
        service = DeduplicationService()
        
        # UC format (direct download)
        url = "https://drive.google.com/uc?id=direct123download"
        assert service.extract_file_id_from_url(url) == "direct123download"
    
    def test_extract_file_id_from_url_edge_cases(self):
        """Test edge cases for file ID extraction."""
        service = DeduplicationService()
        
        # None input
        assert service.extract_file_id_from_url(None) is None
        
        # Empty string
        assert service.extract_file_id_from_url("") is None
        
        # Invalid URL format
        assert service.extract_file_id_from_url("not-a-url") is None
        
        # Non-Drive URL
        assert service.extract_file_id_from_url("https://example.com/file/d/123/view") is None
        
        # Malformed Drive URL
        assert service.extract_file_id_from_url("https://drive.google.com/something/else") is None
    
    def test_is_valid_drive_url(self):
        """Test Drive URL validation."""
        service = DeduplicationService()
        
        # Valid URLs
        assert service.is_valid_drive_url("https://drive.google.com/file/d/123/view") is True
        assert service.is_valid_drive_url("https://docs.google.com/file/d/123/view") is True
        assert service.is_valid_drive_url("https://drive.google.com/open?id=123") is True
        assert service.is_valid_drive_url("https://drive.google.com/uc?id=123") is True
        assert service.is_valid_drive_url("http://drive.google.com/file/d/123/view") is True
        
        # Invalid URLs
        assert service.is_valid_drive_url("https://example.com/file/d/123/view") is False
        assert service.is_valid_drive_url("https://drive.google.com/something/else") is False
        assert service.is_valid_drive_url("not-a-url") is False
        assert service.is_valid_drive_url("") is False
        assert service.is_valid_drive_url(None) is False
        assert service.is_valid_drive_url(123) is False  # Non-string input
        
        # Security: Prevent URL injection
        assert service.is_valid_drive_url("javascript:alert('xss')") is False
        assert service.is_valid_drive_url("file:///etc/passwd") is False
    
    def test_is_duplicate_by_deeplink_not_enabled(self):
        """Test deeplink duplicate check when feature is disabled."""
        service = DeduplicationService(use_deeplink_dedup=False)
        
        with pytest.raises(ValueError, match="Deeplink deduplication is not enabled"):
            service.is_duplicate_by_deeplink("https://drive.google.com/file/d/123/view", set())
    
    def test_is_duplicate_by_deeplink_no_duplicates(self):
        """Test deeplink duplicate check with no duplicates."""
        service = DeduplicationService(use_deeplink_dedup=True)
        
        new_url = "https://drive.google.com/file/d/new123/view"
        existing_urls = {
            "https://drive.google.com/file/d/existing1/view",
            "https://drive.google.com/file/d/existing2/view"
        }
        
        assert service.is_duplicate_by_deeplink(new_url, existing_urls) is False
    
    def test_is_duplicate_by_deeplink_found_duplicate(self):
        """Test deeplink duplicate check finding a duplicate."""
        service = DeduplicationService(use_deeplink_dedup=True)
        
        # Same file ID but different URL format
        new_url = "https://drive.google.com/file/d/duplicate123/view"
        existing_urls = {
            "https://drive.google.com/file/d/existing1/view",
            "https://drive.google.com/open?id=duplicate123",  # Same file ID, different format
            "https://drive.google.com/file/d/existing3/view"
        }
        
        assert service.is_duplicate_by_deeplink(new_url, existing_urls) is True
    
    def test_is_duplicate_by_deeplink_invalid_new_url(self):
        """Test deeplink duplicate check with invalid new URL."""
        service = DeduplicationService(use_deeplink_dedup=True)
        
        # Invalid URL should return False (not duplicate) with warning
        with patch.object(service.logger, 'warning') as mock_warning:
            result = service.is_duplicate_by_deeplink("invalid-url", {"https://drive.google.com/file/d/123/view"})
            assert result is False
            # Two warnings are expected: one for invalid URL format, one for failed extraction
            assert mock_warning.call_count == 2
            assert "Invalid Drive URL format" in mock_warning.call_args_list[0][0][0]
            assert "Could not extract file ID from URL" in mock_warning.call_args_list[1][0][0]
    
    def test_is_duplicate_by_deeplink_invalid_existing_urls(self):
        """Test deeplink duplicate check with invalid URLs in existing set."""
        service = DeduplicationService(use_deeplink_dedup=True)
        
        new_url = "https://drive.google.com/file/d/new123/view"
        existing_urls = {
            "https://drive.google.com/file/d/valid123/view",
            "invalid-url",  # This should be skipped
            "",  # This should be skipped
            None  # This would cause error if not handled
        }
        
        # Should not find duplicate despite invalid URLs in set
        assert service.is_duplicate_by_deeplink(new_url, existing_urls) is False
    
    def test_get_deduplication_key_deeplink_mode(self):
        """Test getting deduplication key in deeplink mode."""
        service = DeduplicationService(use_deeplink_dedup=True)
        
        file_info = {"id": "file123abc"}
        key = service.get_deduplication_key(file_info)
        
        assert key == "drive_id:file123abc"
    
    def test_get_deduplication_key_hash_mode_with_hash(self):
        """Test getting deduplication key in hash mode with provided hash."""
        service = DeduplicationService(use_deeplink_dedup=False)
        
        file_info = {"id": "file123abc"}
        file_hash = "abc123def456"
        key = service.get_deduplication_key(file_info, file_hash=file_hash)
        
        assert key == "hash:abc123def456"
    
    def test_get_deduplication_key_hash_mode_without_hash(self):
        """Test getting deduplication key in hash mode without hash raises error."""
        service = DeduplicationService(use_deeplink_dedup=False)
        
        file_info = {"id": "file123abc"}
        
        with pytest.raises(ValueError, match="File hash required for hash-based deduplication"):
            service.get_deduplication_key(file_info)
    
    @patch('src.drive.deduplication.MediaIoBaseDownload')
    def test_calculate_drive_file_hash(self, mock_downloader_class):
        """Test calculating hash of a Drive file."""
        service = DeduplicationService()
        
        # Mock drive service
        mock_drive = Mock()
        mock_request = Mock()
        mock_drive.files().get_media.return_value = mock_request
        
        # Mock file content
        file_content = b"Test PDF content"
        
        # Mock downloader
        mock_downloader = Mock()
        mock_downloader.next_chunk.side_effect = [(None, False), (None, True)]
        mock_downloader_class.return_value = mock_downloader
        
        # Need to mock BytesIO to capture content
        with patch('io.BytesIO') as mock_bytesio:
            mock_buffer = Mock()
            mock_buffer.getvalue.return_value = file_content
            mock_bytesio.return_value = mock_buffer
            
            result = service.calculate_drive_file_hash(mock_drive, "file123")
            
            # Verify API calls
            mock_drive.files().get_media.assert_called_once_with(fileId="file123")
            assert mock_downloader.next_chunk.call_count == 2
            
            # Verify hash calculation
            expected_hash = service.calculate_hash(file_content)
            assert result == expected_hash
    
    @patch('src.drive.deduplication.MediaIoBaseDownload')
    def test_calculate_drive_file_hash_with_deeplink_warning(self, mock_downloader_class):
        """Test warning when using file hash with deeplink mode enabled."""
        service = DeduplicationService(use_deeplink_dedup=True)
        
        # Mock drive service and downloader
        mock_drive = Mock()
        mock_request = Mock()
        mock_drive.files().get_media.return_value = mock_request
        
        mock_downloader = Mock()
        mock_downloader.next_chunk.side_effect = [(None, True)]
        mock_downloader_class.return_value = mock_downloader
        
        # Mock BytesIO properly
        with patch('io.BytesIO') as mock_bytesio:
            mock_buffer = Mock()
            mock_buffer.getvalue.return_value = b"Test content"
            mock_bytesio.return_value = mock_buffer
            
            with patch.object(service.logger, 'warning') as mock_warning:
                service.calculate_drive_file_hash(mock_drive, "file123")
                
                # Should log warning about using hash with deeplink mode
                mock_warning.assert_called_once()
                assert "deeplink deduplication enabled" in mock_warning.call_args[0][0]
    
    def test_regex_patterns_performance(self):
        """Test that regex patterns are pre-compiled for performance."""
        service = DeduplicationService()
        
        # Verify patterns are compiled regex objects
        import re
        assert isinstance(service.FILE_ID_PATTERN_1, re.Pattern)
        assert isinstance(service.FILE_ID_PATTERN_2, re.Pattern)
        assert isinstance(service.VALID_DRIVE_URL_PATTERN, re.Pattern)
        
        # Test patterns work correctly
        assert service.FILE_ID_PATTERN_1.search("/file/d/test123/view").group(1) == "test123"
        assert service.FILE_ID_PATTERN_2.search("?id=test456").group(1) == "test456"
        assert service.VALID_DRIVE_URL_PATTERN.match("https://drive.google.com/file/d/")