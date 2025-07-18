# Service Account Storage Quota Solutions

## The Core Problem
When a service account uploads files to Google Drive (even to a shared folder), it becomes the owner of those files and they count against its 15GB quota.

## Solution 1: Use OAuth2 Instead (Recommended)

Create a new file `src/drive/oauth_uploader.py`:

```python
import os
import pickle
from pathlib import Path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

class OAuthDriveUploader:
    """Upload files using OAuth2 user authentication instead of service account."""
    
    SCOPES = ['https://www.googleapis.com/auth/drive.file']
    
    def __init__(self, credentials_file='credentials.json', token_file='token.pickle'):
        self.credentials_file = credentials_file
        self.token_file = token_file
        self.service = self._get_service()
    
    def _get_service(self):
        """Get authenticated Drive service using OAuth2."""
        creds = None
        
        # Load existing token
        if os.path.exists(self.token_file):
            with open(self.token_file, 'rb') as token:
                creds = pickle.load(token)
        
        # If there are no (valid) credentials, authenticate
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not os.path.exists(self.credentials_file):
                    raise FileNotFoundError(
                        f"Missing {self.credentials_file}. Download it from Google Cloud Console:\n"
                        "1. Go to https://console.cloud.google.com/apis/credentials\n"
                        "2. Create OAuth 2.0 Client ID (Desktop application)\n"
                        "3. Download as credentials.json"
                    )
                
                flow = InstalledAppFlow.from_client_secrets_file(
                    self.credentials_file, self.SCOPES)
                creds = flow.run_local_server(port=0)
            
            # Save for next run
            with open(self.token_file, 'wb') as token:
                pickle.dump(creds, token)
        
        return build('drive', 'v3', credentials=creds)
    
    def upload_file(self, filepath: str, filename: str, folder_id: str) -> str:
        """Upload file to Drive folder."""
        file_metadata = {
            'name': filename,
            'parents': [folder_id]
        }
        
        media = MediaFileUpload(filepath, mimetype='application/pdf', resumable=True)
        
        file = self.service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id'
        ).execute()
        
        return file.get('id')
```

## Solution 2: Clean Up Service Account Storage

Create a cleanup script `scripts/cleanup_service_account.py`:

```python
import os
from src.drive.ingester import DriveIngester
from src.core.config import PipelineConfig

def cleanup_service_account_files():
    """List and optionally delete files owned by service account."""
    config = PipelineConfig.from_env()
    ingester = DriveIngester(config, None)
    
    # List all files owned by service account
    results = ingester.drive.files().list(
        q="'me' in owners",
        fields="files(id, name, size, createdTime)",
        pageSize=1000
    ).execute()
    
    files = results.get('files', [])
    total_size = sum(int(f.get('size', 0)) for f in files)
    
    print(f"Found {len(files)} files owned by service account")
    print(f"Total size: {total_size / 1024 / 1024 / 1024:.2f} GB")
    
    for f in files[:10]:  # Show first 10
        print(f"- {f['name']} ({int(f.get('size', 0)) / 1024 / 1024:.2f} MB)")
    
    # Optional: Delete old files
    # if input("Delete all files? (y/n): ").lower() == 'y':
    #     for f in files:
    #         ingester.drive.files().delete(fileId=f['id']).execute()
    #         print(f"Deleted {f['name']}")

if __name__ == "__main__":
    cleanup_service_account_files()
```

## Solution 3: Modify Pipeline to Use OAuth2

Update `src/drive/ingester.py` to support both authentication methods:

```python
def __init__(self, config: PipelineConfig, notion_client: NotionClient):
    # ... existing code ...
    
    # Check for OAuth2 mode
    if os.getenv('USE_OAUTH2_FOR_UPLOADS', 'false').lower() == 'true':
        from .oauth_uploader import OAuthDriveUploader
        self.oauth_uploader = OAuthDriveUploader()
        self.use_oauth = True
    else:
        self.use_oauth = False
        self._init_drive_service()

def upload_local_file(self, filepath: str, cleaned_name: str) -> str:
    """Upload a local file to Google Drive."""
    if self.use_oauth:
        # Use OAuth2 uploader (user-owned files)
        target_folder_id = (
            self.config.local_uploader.upload_folder_id or 
            self.config.google_drive.folder_id
        )
        return self.oauth_uploader.upload_file(filepath, cleaned_name, target_folder_id)
    else:
        # Use service account (will hit quota)
        # ... existing service account code ...
```

## Quick Setup for OAuth2

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your project
3. Click "Create Credentials" → "OAuth client ID"
4. Choose "Desktop app" as application type
5. Download the JSON file as `credentials.json`
6. Place it in your project root
7. Add to `.env`:
   ```bash
   USE_OAUTH2_FOR_UPLOADS=true
   ```
8. Run the pipeline - it will open a browser for first-time auth

## Which Solution to Choose?

- **OAuth2 (Solution 1)**: Best for personal use, files owned by your account
- **Cleanup (Solution 2)**: Temporary fix, good for clearing space
- **Hybrid (Solution 3)**: Most flexible, supports both methods

The OAuth2 approach is recommended because:
- Files are owned by your Google account (no quota issues)
- Works with personal Gmail accounts
- One-time browser authentication
- Refresh token stored for future use