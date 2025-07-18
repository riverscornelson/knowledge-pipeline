"""
Google Drive content ingestion module.
"""
import time
from typing import List, Optional, Dict, Any
from datetime import datetime
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
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
        
        # Parse created date
        created_date = None
        if file_info.get("createdTime"):
            try:
                # Parse ISO format datetime string from Drive API
                created_date = datetime.fromisoformat(file_info["createdTime"].replace('Z', '+00:00'))
            except:
                self.logger.warning(f"Could not parse date: {file_info.get('createdTime')}")
        
        # Create source content
        content = SourceContent(
            title=file_info["name"],
            status=ContentStatus.INBOX,
            hash=file_hash,
            content_type=ContentType.PDF,  # Assuming PDFs for now
            drive_url=file_info["webViewLink"],
            created_date=created_date
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
    
    def upload_local_file(self, filepath: str, cleaned_name: str) -> str:
        """
        Upload a local file to Google Drive.
        
        Args:
            filepath: Path to the local file to upload
            cleaned_name: Cleaned filename to use in Drive
            
        Returns:
            The Google Drive file ID of the uploaded file
            
        Raises:
            Exception: If upload fails
        """
        # Check if we should use OAuth2 for uploads
        if (hasattr(self.config, 'local_uploader') and 
            self.config.local_uploader.use_oauth2):
            return self._upload_with_oauth2(filepath, cleaned_name)
        
        # Otherwise use service account (original implementation)
        if not self.drive:
            raise Exception("Google Drive API not available - cannot upload file")
        
        # Determine the target folder ID
        # Use local_uploader config if specified, otherwise use default folder
        target_folder_id = self.drive_config.folder_id
        if hasattr(self.config, 'local_uploader') and self.config.local_uploader.upload_folder_id:
            target_folder_id = self.config.local_uploader.upload_folder_id
            self.logger.info(f"Using custom upload folder: {target_folder_id}")
        
        if not target_folder_id:
            raise ValueError("No target folder ID configured for uploads")
        
        try:
            # Prepare file metadata
            file_metadata = {
                'name': cleaned_name,
                'parents': [target_folder_id]
            }
            
            # Create media upload object
            media = MediaFileUpload(
                filepath,
                mimetype='application/pdf',
                resumable=True
            )
            
            # Upload the file
            self.logger.info(f"Uploading {cleaned_name} to Drive folder {target_folder_id}...")
            file = self.drive.files().create(
                body=file_metadata,
                media_body=media,
                fields='id,webViewLink'
            ).execute()
            
            file_id = file.get('id')
            
            # Important: When uploading to a shared folder, the service account becomes the owner
            # which counts against its 15GB quota. We need to check if this is a shared folder
            # and handle permissions appropriately.
            
            # Get folder metadata to check if it's shared
            try:
                folder = self.drive.files().get(
                    fileId=target_folder_id,
                    fields='owners,ownedByMe'
                ).execute()
                
                # If the folder is not owned by the service account (i.e., it's shared)
                # the uploaded file will still be owned by the service account
                if not folder.get('ownedByMe', True):
                    self.logger.warning(
                        "Uploading to a shared folder. File will be owned by service account "
                        "and count against its 15GB quota. Consider using OAuth2 for user-owned uploads."
                    )
            except Exception as e:
                self.logger.debug(f"Could not check folder ownership: {e}")
            
            self.logger.info(f"Successfully uploaded file with ID: {file_id}")
            
            return file_id
            
        except Exception as e:
            self.logger.error(f"Failed to upload file {filepath}: {str(e)}")
            raise Exception(f"Drive upload failed: {str(e)}")
    
    def _upload_with_oauth2(self, filepath: str, cleaned_name: str) -> str:
        """Upload file using OAuth2 authentication (user-owned files).
        
        Args:
            filepath: Path to the local file
            cleaned_name: Cleaned filename to use in Drive
            
        Returns:
            Google Drive file ID
            
        Raises:
            Exception: If upload fails
        """
        try:
            # Lazy import to avoid dependency if not using OAuth2
            from .oauth_uploader import OAuthDriveUploader
            
            # Initialize OAuth uploader with config
            oauth_uploader = OAuthDriveUploader(
                credentials_file=self.config.local_uploader.oauth_credentials_file,
                token_file=self.config.local_uploader.oauth_token_file
            )
            
            # Determine target folder
            target_folder_id = (
                self.config.local_uploader.upload_folder_id or 
                self.config.google_drive.folder_id
            )
            
            if not target_folder_id:
                raise ValueError("No target folder ID configured for uploads")
            
            self.logger.info("Using OAuth2 authentication for upload (user-owned file)")
            
            # Upload file
            file_id = oauth_uploader.upload_file(filepath, cleaned_name, target_folder_id)
            
            if not file_id:
                raise Exception("OAuth2 upload returned no file ID")
            
            return file_id
            
        except Exception as e:
            self.logger.error(f"OAuth2 upload failed: {str(e)}")
            raise Exception(f"OAuth2 upload failed: {str(e)}")