"""OAuth2-based Drive uploader for user-owned file uploads."""

import os
import pickle
import logging
from pathlib import Path
from typing import Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError


logger = logging.getLogger(__name__)


class OAuthDriveUploader:
    """Upload files using OAuth2 user authentication instead of service account.
    
    This uploader ensures files are owned by the authenticated user account,
    avoiding the 15GB service account quota limitation.
    """
    
    SCOPES = ['https://www.googleapis.com/auth/drive.file']
    
    def __init__(self, 
                 credentials_file: str = 'credentials.json',
                 token_file: str = '.token.pickle'):
        """Initialize OAuth Drive uploader.
        
        Args:
            credentials_file: Path to OAuth2 credentials JSON file
            token_file: Path to store/load authentication token
        """
        self.credentials_file = credentials_file
        self.token_file = token_file
        self.service = None
        self._init_service()
    
    def _init_service(self):
        """Initialize the Drive service with OAuth2 authentication."""
        try:
            creds = self._get_credentials()
            self.service = build('drive', 'v3', credentials=creds)
            logger.info("OAuth2 Drive service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize OAuth2 Drive service: {e}")
            raise
    
    def _get_credentials(self) -> Credentials:
        """Get OAuth2 credentials, authenticating if necessary.
        
        Returns:
            Authenticated credentials object
        """
        creds = None
        
        # Load existing token if available
        if os.path.exists(self.token_file):
            try:
                with open(self.token_file, 'rb') as token:
                    creds = pickle.load(token)
                logger.debug("Loaded existing OAuth2 token")
            except Exception as e:
                logger.warning(f"Could not load token file: {e}")
        
        # Refresh or authenticate as needed
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                logger.info("Refreshing expired OAuth2 token")
                creds.refresh(Request())
            else:
                if not os.path.exists(self.credentials_file):
                    raise FileNotFoundError(
                        f"Missing {self.credentials_file}. To create it:\n"
                        "1. Go to https://console.cloud.google.com/apis/credentials\n"
                        "2. Select your project\n"
                        "3. Click 'Create Credentials' → 'OAuth client ID'\n"
                        "4. Choose 'Desktop app' as application type\n"
                        "5. Download the JSON file and save it as '{self.credentials_file}'\n"
                        "6. Place it in your project root directory"
                    )
                
                logger.info("Starting OAuth2 authentication flow")
                flow = InstalledAppFlow.from_client_secrets_file(
                    self.credentials_file, self.SCOPES)
                
                # Run local server for authentication
                creds = flow.run_local_server(
                    port=0,
                    authorization_prompt_message='Please visit this URL to authorize the application: {url}',
                    success_message='Authorization successful! You may close this window.',
                    open_browser=True
                )
                logger.info("OAuth2 authentication completed successfully")
            
            # Save credentials for next run
            try:
                with open(self.token_file, 'wb') as token:
                    pickle.dump(creds, token)
                logger.debug(f"Saved OAuth2 token to {self.token_file}")
            except Exception as e:
                logger.warning(f"Could not save token file: {e}")
        
        return creds
    
    def upload_file(self, filepath: str, filename: str, folder_id: str) -> Optional[str]:
        """Upload a file to Google Drive.
        
        Args:
            filepath: Local path to the file to upload
            filename: Name for the file in Drive
            folder_id: ID of the Drive folder to upload to
            
        Returns:
            File ID of the uploaded file, or None if upload failed
        """
        if not self.service:
            logger.error("Drive service not initialized")
            return None
        
        try:
            # Prepare file metadata
            file_metadata = {
                'name': filename,
                'parents': [folder_id]
            }
            
            # Determine MIME type
            mime_type = 'application/pdf' if filepath.lower().endswith('.pdf') else 'application/octet-stream'
            
            # Create media upload object
            media = MediaFileUpload(
                filepath,
                mimetype=mime_type,
                resumable=True
            )
            
            # Upload the file
            logger.info(f"Uploading {filename} to Drive folder {folder_id} (as authenticated user)...")
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id,name,webViewLink'
            ).execute()
            
            file_id = file.get('id')
            web_link = file.get('webViewLink', '')
            
            logger.info(f"Successfully uploaded '{filename}' with ID: {file_id}")
            if web_link:
                logger.debug(f"File URL: {web_link}")
            
            return file_id
            
        except HttpError as e:
            logger.error(f"HTTP error during upload: {e}")
            return None
        except Exception as e:
            logger.error(f"Failed to upload file {filepath}: {e}")
            return None
    
    def test_connection(self) -> bool:
        """Test the OAuth2 connection by listing user's Drive root.
        
        Returns:
            True if connection is working, False otherwise
        """
        if not self.service:
            return False
        
        try:
            # Try to list files in root (just 1 file to test)
            results = self.service.files().list(
                pageSize=1,
                fields="files(id, name)"
            ).execute()
            
            logger.info("OAuth2 Drive connection test successful")
            return True
            
        except Exception as e:
            logger.error(f"OAuth2 Drive connection test failed: {e}")
            return False