"""
Google Drive content ingestion module.
"""
import time
from typing import List, Optional, Dict, Any
from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials
from ..core.config import GoogleDriveConfig, PipelineConfig
from ..core.models import SourceContent, ContentStatus, ContentType
from ..core.notion_client import NotionClient
from ..utils.logging import setup_logger
from .pdf_processor import PDFProcessor
from .deduplication import DeduplicationService


class DriveIngester:
    """Handles ingestion of content from Google Drive."""
    
    def __init__(self, config: PipelineConfig, notion_client: NotionClient):
        """Initialize Drive ingester with configuration."""
        self.config = config
        self.drive_config = config.google_drive
        self.notion_client = notion_client
        self.pdf_processor = PDFProcessor()
        self.dedup_service = DeduplicationService()
        self.logger = setup_logger(__name__)
        
        # Initialize Drive API client
        try:
            credentials = Credentials.from_service_account_file(
                self.drive_config.service_account_path
            )
            self.drive = build("drive", "v3", credentials=credentials, cache_discovery=False)
        except FileNotFoundError:
            self.logger.warning(f"Google Drive service account file not found: {self.drive_config.service_account_path}")
            self.drive = None
        
        # Get or find folder ID
        self._initialize_folder()
    
    def _initialize_folder(self):
        """Initialize the target Drive folder ID."""
        if not self.drive:
            return  # Skip if Drive API is not available
            
        if not self.drive_config.folder_id:
            folder_id = self._find_folder_by_name(self.drive_config.folder_name)
            if not folder_id:
                raise ValueError(f"Could not find Drive folder: {self.drive_config.folder_name}")
            self.drive_config.folder_id = folder_id
    
    def _find_folder_by_name(self, name: str) -> Optional[str]:
        """Find a folder ID by name."""
        query = f"mimeType = 'application/vnd.google-apps.folder' and name = '{name}' and trashed=false"
        response = self.drive.files().list(
            q=query,
            fields="files(id, name)"
        ).execute()
        
        files = response.get("files", [])
        return files[0]["id"] if files else None
    
    def get_folder_files(self) -> List[Dict[str, Any]]:
        """Get all files in the configured Drive folder."""
        query = f"'{self.drive_config.folder_id}' in parents and trashed=false"
        response = self.drive.files().list(
            q=query,
            fields="files(id, name, webViewLink, mimeType, createdTime, modifiedTime, size)",
            pageSize=1000
        ).execute()
        
        return response.get("files", [])
    
    def process_file(self, file_info: Dict[str, Any]) -> Optional[SourceContent]:
        """Process a single Drive file."""
        file_id = file_info["id"]
        
        # Calculate file hash
        file_hash = self.dedup_service.calculate_drive_file_hash(self.drive, file_id)
        
        # Create source content
        content = SourceContent(
            title=file_info["name"],
            status=ContentStatus.INBOX,
            hash=file_hash,
            content_type=ContentType.PDF,  # Assuming PDFs for now
            drive_url=file_info["webViewLink"],
            created_date=file_info.get("createdTime")  # This is already a string, not datetime
        )
        
        return content
    
    def ingest(self, skip_existing: bool = True) -> Dict[str, int]:
        """
        Ingest all new files from Drive folder.
        
        Returns:
            Dict with counts: {"total": n, "new": n, "skipped": n}
        """
        stats = {"total": 0, "new": 0, "skipped": 0}
        
        # Check if Drive API is available
        if not self.drive:
            self.logger.warning("Google Drive API not available - skipping ingestion")
            return stats
        
        # Get existing files if skip_existing is True
        known_ids, known_hashes = set(), set()
        if skip_existing:
            known_ids, known_hashes = self.notion_client.get_existing_drive_files()
            if known_ids:
                print(f"Found {len(known_ids)} files already in Notion")
        
        # Get all files from Drive
        files = self.get_folder_files()
        stats["total"] = len(files)
        print(f"Found {len(files)} files in Drive folder")
        
        # Process each file
        for file_info in files:
            file_id = file_info["id"]
            
            # Skip if already processed
            if file_id in known_ids:
                stats["skipped"] += 1
                continue
            
            try:
                # Process the file
                content = self.process_file(file_info)
                if not content:
                    continue
                
                # Skip if hash already exists
                if content.hash in known_hashes:
                    stats["skipped"] += 1
                    print(f"Skipping duplicate: {file_info['name']}")
                    continue
                
                # Create Notion page
                page_id = self.notion_client.create_page(content)
                print(f"✓ Added: {file_info['name']}")
                
                stats["new"] += 1
                known_hashes.add(content.hash)
                
                # Rate limiting
                time.sleep(self.config.rate_limit_delay)
                
            except Exception as e:
                print(f"Error processing {file_info['name']}: {str(e)}")
                stats["skipped"] += 1
        
        print(f"\n✅ Drive ingestion complete: {stats['new']} new files added")
        return stats