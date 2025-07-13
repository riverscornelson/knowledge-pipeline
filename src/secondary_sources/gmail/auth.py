"""
Gmail authentication handler.
"""
import os
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build


class GmailAuthenticator:
    """Handles Gmail OAuth2 authentication."""
    
    SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']
    
    def __init__(self, credentials_path: str, token_path: str):
        """
        Initialize authenticator with paths.
        
        Args:
            credentials_path: Path to OAuth2 credentials JSON
            token_path: Path to store/load token
        """
        self.credentials_path = credentials_path
        self.token_path = token_path
        self._service = None
    
    def get_service(self):
        """Get authenticated Gmail service."""
        if self._service is None:
            creds = self._get_credentials()
            self._service = build('gmail', 'v1', credentials=creds)
        return self._service
    
    def _get_credentials(self) -> Credentials:
        """Get or refresh Gmail credentials."""
        creds = None
        
        # Load existing token
        if os.path.exists(self.token_path):
            creds = Credentials.from_authorized_user_file(self.token_path, self.SCOPES)
        
        # Refresh or get new credentials
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(
                    self.credentials_path, self.SCOPES
                )
                creds = flow.run_local_server(port=0)
            
            # Save credentials
            with open(self.token_path, 'w') as token:
                token.write(creds.to_json())
        
        return creds