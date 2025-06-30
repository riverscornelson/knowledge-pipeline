"""
gmail_auth.py - Gmail API authentication and service setup

Handles OAuth2 flow for Gmail API access with token persistence.
Supports both reading messages and sending emails.
"""
import os
import json
import base64
from pathlib import Path
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Gmail API scopes - read access to messages, send access for newsletters
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send'
]

# Default paths for credentials
DEFAULT_CREDENTIALS_PATH = 'gmail_credentials/credentials.json'
DEFAULT_TOKEN_PATH = 'gmail_credentials/token.json'


class GmailAuthenticator:
    """Handles Gmail API authentication and service creation."""
    
    def __init__(self, credentials_path=None, token_path=None):
        self.credentials_path = credentials_path or DEFAULT_CREDENTIALS_PATH
        self.token_path = token_path or DEFAULT_TOKEN_PATH
        self.service = None
        self.creds = None
    
    def authenticate(self):
        """Authenticate with Gmail API and return service object."""
        self.creds = None
        
        # Load existing token if available
        if os.path.exists(self.token_path):
            self.creds = Credentials.from_authorized_user_file(self.token_path, SCOPES)
        
        # If no valid credentials, get new ones
        if not self.creds or not self.creds.valid:
            if self.creds and self.creds.expired and self.creds.refresh_token:
                print("🔄 Refreshing expired Gmail token...")
                self.creds.refresh(Request())
            else:
                print("🔐 Starting Gmail OAuth2 flow...")
                if not os.path.exists(self.credentials_path):
                    raise FileNotFoundError(
                        f"Gmail credentials not found at {self.credentials_path}. "
                        f"Please download OAuth2 credentials from Google Cloud Console."
                    )
                
                flow = InstalledAppFlow.from_client_secrets_file(
                    self.credentials_path, SCOPES
                )
                self.creds = flow.run_local_server(port=0)
                print("✅ Gmail authentication successful!")
            
            # Save credentials for next run
            with open(self.token_path, 'w') as token:
                token.write(self.creds.to_json())
            print(f"💾 Saved token to {self.token_path}")
        
        # Build Gmail service
        try:
            self.service = build('gmail', 'v1', credentials=self.creds)
            print("✅ Gmail API service created")
            return self.service
        except HttpError as error:
            print(f"❌ Gmail API error: {error}")
            raise
    
    def get_service(self):
        """Get authenticated Gmail service, authenticating if needed."""
        if not self.service:
            self.authenticate()
        return self.service
    
    def test_connection(self):
        """Test Gmail API connection by getting user profile."""
        try:
            service = self.get_service()
            profile = service.users().getProfile(userId='me').execute()
            email = profile.get('emailAddress', 'Unknown')
            total_messages = profile.get('messagesTotal', 0)
            print(f"📧 Connected to Gmail: {email}")
            print(f"📊 Total messages in account: {total_messages:,}")
            return True
        except Exception as error:
            print(f"❌ Gmail connection test failed: {error}")
            return False
    
    def send_email(self, to_email: str, subject: str, html_content: str, text_content: str = None):
        """
        Send an email via Gmail API.
        
        Args:
            to_email: Recipient email address
            subject: Email subject line
            html_content: HTML email content
            text_content: Plain text version (optional, will be generated from HTML if not provided)
            
        Returns:
            Message ID if successful, None if failed
        """
        try:
            service = self.get_service()
            
            # Create message
            message = MIMEMultipart('alternative')
            message['to'] = to_email
            message['subject'] = subject
            
            # Get sender email from profile
            profile = service.users().getProfile(userId='me').execute()
            sender_email = profile.get('emailAddress')
            if sender_email:
                message['from'] = sender_email
            
            # Add text content (plain text version)
            if text_content:
                text_part = MIMEText(text_content, 'plain')
                message.attach(text_part)
            
            # Add HTML content
            html_part = MIMEText(html_content, 'html')
            message.attach(html_part)
            
            # Encode message
            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
            
            # Send message
            send_message = service.users().messages().send(
                userId='me',
                body={'raw': raw_message}
            ).execute()
            
            message_id = send_message.get('id')
            print(f"✅ Email sent successfully! Message ID: {message_id}")
            return message_id
            
        except HttpError as error:
            print(f"❌ Gmail API error sending email: {error}")
            return None
        except Exception as error:
            print(f"❌ Error sending email: {error}")
            return None


def create_gmail_service(credentials_path=None, token_path=None):
    """Convenience function to create authenticated Gmail service."""
    authenticator = GmailAuthenticator(credentials_path, token_path)
    return authenticator.get_service()


def test_gmail_auth():
    """Test Gmail authentication and connection."""
    print("🧪 Testing Gmail authentication...")
    
    try:
        authenticator = GmailAuthenticator()
        service = authenticator.authenticate()
        
        if authenticator.test_connection():
            print("✅ Gmail authentication test passed!")
            return True
        else:
            print("❌ Gmail authentication test failed!")
            return False
            
    except Exception as error:
        print(f"❌ Gmail auth test error: {error}")
        return False


if __name__ == "__main__":
    # Run authentication test when script is executed directly
    test_gmail_auth()