# Google Drive Service Account Storage Fix

## Quick Fix: Use a User-Owned Folder

### Step 1: Create and Share a Folder
1. Go to Google Drive with your personal/work account
2. Create a new folder (or use existing one)
3. Right-click the folder → Share
4. Add your service account email (found in your JSON key file, looks like: `your-service-account@your-project.iam.gserviceaccount.com`)
5. Give it "Editor" permissions
6. Copy the folder ID from the URL

### Step 2: Update Your Configuration
Update your `.env` file:
```bash
# Use the shared folder ID instead of service account's folder
GOOGLE_DRIVE_FOLDER_ID=your_shared_folder_id_here
```

### Step 3: Test Again
```bash
python scripts/run_pipeline.py --process-local --dry-run
```

## Alternative Solutions

### Option 2: Use OAuth2 Instead of Service Account
If you want files owned by your account directly, switch to OAuth2:

1. Update `src/drive/ingester.py` to support OAuth2:
```python
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials
import pickle
import os

def get_oauth2_credentials():
    """Get OAuth2 credentials with user authentication."""
    SCOPES = ['https://www.googleapis.com/auth/drive.file']
    creds = None
    
    # Token file stores the user's access and refresh tokens
    token_file = 'token.pickle'
    
    if os.path.exists(token_file):
        with open(token_file, 'rb') as token:
            creds = pickle.load(token)
    
    # If there are no (valid) credentials available, let the user log in
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # You'll need to download credentials.json from Google Cloud Console
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=0)
        
        # Save the credentials for the next run
        with open(token_file, 'wb') as token:
            pickle.dump(creds, token)
    
    return creds
```

### Option 3: Use Shared Drives (Google Workspace Only)
If you have Google Workspace:
1. Create a Shared Drive
2. Add service account as a member
3. Upload to the Shared Drive instead

### Option 4: Transfer Ownership After Upload
Modify the upload to transfer ownership immediately:
```python
def upload_and_transfer_ownership(file_path, user_email):
    # Upload file
    file_id = service.files().create(...).execute()['id']
    
    # Transfer ownership
    permission = {
        'type': 'user',
        'role': 'owner',
        'emailAddress': user_email
    }
    service.permissions().create(
        fileId=file_id,
        body=permission,
        transferOwnership=True
    ).execute()
```

## Recommended Approach
**Use Option 1** - It's the simplest and requires minimal code changes. Just share a folder from your personal Google account with the service account.

## Why This Happens
- Service accounts are meant for server-to-server interactions
- They have a fixed 15GB quota that cannot be increased
- Google expects service accounts to work with user-owned resources, not own resources themselves