"""
Deduplication service for content management.
"""
import hashlib
import io
import re
from typing import Optional, Set, Tuple, Dict, Any
from googleapiclient.http import MediaIoBaseDownload
from utils.logging import setup_logger


class DeduplicationService:
    """Handles content deduplication using SHA-256 hashing and Drive deeplinks."""
    
    # Pre-compiled regex patterns for better performance
    FILE_ID_PATTERN_1 = re.compile(r'/file/d/([a-zA-Z0-9_-]+)')
    FILE_ID_PATTERN_2 = re.compile(r'[?&]id=([a-zA-Z0-9_-]+)')
    VALID_DRIVE_URL_PATTERN = re.compile(
        r'^https?://(?:drive|docs)\.google\.com/(?:file/d/|open\?id=|uc\?id=)'
    )
    
    def __init__(self, use_deeplink_dedup: bool = False):
        """Initialize deduplication service.
        
        Args:
            use_deeplink_dedup: If True, use Drive deeplinks for deduplication.
                               If False, use traditional hash-based deduplication.
        """
        self.use_deeplink_dedup = use_deeplink_dedup
        self.logger = setup_logger(__name__)
        
    def calculate_hash(self, content: bytes) -> str:
        """Calculate SHA-256 hash of content."""
        return hashlib.sha256(content).hexdigest()
    
    def calculate_drive_file_hash(self, drive_service, file_id: str) -> str:
        """Calculate hash of a Google Drive file.
        
        Note: This method downloads the entire file to calculate its hash.
        Consider using is_duplicate_by_deeplink() for better performance.
        """
        if self.use_deeplink_dedup:
            self.logger.warning(
                "Using calculate_drive_file_hash with deeplink deduplication enabled. "
                "Consider using is_duplicate_by_deeplink() for better performance."
            )
            
        request = drive_service.files().get_media(fileId=file_id)
        buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(buffer, request)
        
        done = False
        while not done:
            status, done = downloader.next_chunk()
        
        return self.calculate_hash(buffer.getvalue())
    
    def extract_file_id_from_url(self, drive_url: str) -> Optional[str]:
        """Extract Google Drive file ID from a Drive URL.
        
        Args:
            drive_url: Google Drive URL (webViewLink or similar)
            
        Returns:
            File ID if found, None otherwise
        """
        if not drive_url:
            return None
            
        # Validate URL format for security
        if not self.is_valid_drive_url(drive_url):
            self.logger.warning(f"Invalid Drive URL format: {drive_url}")
            return None
            
        # Handle different Drive URL formats
        # Format 1: https://drive.google.com/file/d/{FILE_ID}/view
        # Format 2: https://drive.google.com/open?id={FILE_ID}
        # Format 3: https://drive.google.com/uc?id={FILE_ID}
        
        # Try pattern 1: /file/d/{FILE_ID}/ format
        match = self.FILE_ID_PATTERN_1.search(drive_url)
        if match:
            return match.group(1)
            
        # Try pattern 2: ?id={FILE_ID} format
        match = self.FILE_ID_PATTERN_2.search(drive_url)
        if match:
            return match.group(1)
            
        return None
    
    def is_valid_drive_url(self, url: str) -> bool:
        """Validate if a URL is a valid Google Drive URL.
        
        Args:
            url: URL to validate
            
        Returns:
            True if valid Drive URL, False otherwise
        """
        if not url or not isinstance(url, str):
            return False
            
        return bool(self.VALID_DRIVE_URL_PATTERN.match(url))
    
    def is_duplicate_by_deeplink(self, drive_url: str, existing_urls: Set[str]) -> bool:
        """Check if a file is a duplicate based on its Drive deeplink.
        
        Args:
            drive_url: The Drive URL to check
            existing_urls: Set of existing Drive URLs in the system
            
        Returns:
            True if duplicate, False otherwise
        """
        if not self.use_deeplink_dedup:
            raise ValueError("Deeplink deduplication is not enabled")
            
        # Extract file ID from the new URL
        new_file_id = self.extract_file_id_from_url(drive_url)
        if not new_file_id:
            self.logger.warning(f"Could not extract file ID from URL: {drive_url}")
            return False
            
        # Check against existing URLs
        for existing_url in existing_urls:
            existing_file_id = self.extract_file_id_from_url(existing_url)
            if existing_file_id and existing_file_id == new_file_id:
                return True
                
        return False
    
    def get_deduplication_key(self, file_info: Dict[str, Any], 
                             file_hash: Optional[str] = None) -> str:
        """Get the deduplication key for a file.
        
        Args:
            file_info: Drive file metadata
            file_hash: Pre-calculated file hash (optional)
            
        Returns:
            Deduplication key (either file ID or hash)
        """
        if self.use_deeplink_dedup:
            # Use file ID as the deduplication key
            return f"drive_id:{file_info['id']}"
        else:
            # Use hash as the deduplication key
            if file_hash:
                return f"hash:{file_hash}"
            else:
                raise ValueError("File hash required for hash-based deduplication")
    
    def calculate_text_hash(self, text: str) -> str:
        """Calculate hash of text content."""
        return self.calculate_hash(text.encode('utf-8'))
    
    def calculate_url_hash(self, url: str) -> str:
        """Calculate hash for URL-based content."""
        # Normalize URL before hashing
        normalized_url = self._normalize_url(url)
        return self.calculate_hash(normalized_url.encode('utf-8'))
    
    def _normalize_url(self, url: str) -> str:
        """Normalize URL for consistent hashing."""
        # Remove trailing slashes
        url = url.rstrip('/')
        
        # Remove common tracking parameters
        if '?' in url:
            base_url, params = url.split('?', 1)
            # Keep only essential parameters
            return base_url
        
        return url