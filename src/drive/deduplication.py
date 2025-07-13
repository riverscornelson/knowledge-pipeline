"""
Deduplication service for content management.
"""
import hashlib
import io
from typing import Optional
from googleapiclient.http import MediaIoBaseDownload


class DeduplicationService:
    """Handles content deduplication using SHA-256 hashing."""
    
    def calculate_hash(self, content: bytes) -> str:
        """Calculate SHA-256 hash of content."""
        return hashlib.sha256(content).hexdigest()
    
    def calculate_drive_file_hash(self, drive_service, file_id: str) -> str:
        """Calculate hash of a Google Drive file."""
        request = drive_service.files().get_media(fileId=file_id)
        buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(buffer, request)
        
        done = False
        while not done:
            status, done = downloader.next_chunk()
        
        return self.calculate_hash(buffer.getvalue())
    
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