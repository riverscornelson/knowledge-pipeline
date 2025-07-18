# OAuth2 Setup Guide for Local PDF Upload

This guide will help you set up OAuth2 authentication to avoid the Google Drive service account 15GB quota limitation.

## Prerequisites

1. A Google Cloud Project (or create one at https://console.cloud.google.com)
2. Google Drive API enabled for your project
3. Python packages: `google-auth-oauthlib` and `google-auth` (already in requirements.txt)

## Step 1: Create OAuth2 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** → **Credentials**
4. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
5. If prompted, configure the OAuth consent screen:
   - Choose "External" for personal use
   - Fill in required fields (app name, email)
   - Add your email to test users
   - Save and continue
6. Back in Credentials, click **+ CREATE CREDENTIALS** → **OAuth client ID** again
7. Choose **Desktop app** as Application type
8. Give it a name (e.g., "Knowledge Pipeline Local Uploader")
9. Click **CREATE**
10. Download the JSON file by clicking the download button
11. Rename it to `credentials.json` and place it in your project root

## Step 2: Update Your Environment Configuration

Add these lines to your `.env` file:

```bash
# Enable OAuth2 for uploads (avoids service account quota)
USE_OAUTH2_FOR_UPLOADS=true

# Optional: Customize paths (defaults shown)
# OAUTH_CREDENTIALS_FILE=credentials.json
# OAUTH_TOKEN_FILE=.token.pickle
```

## Step 3: First-Time Authentication

When you run the pipeline for the first time with OAuth2 enabled:

```bash
python scripts/run_pipeline.py --process-local
```

1. A browser window will open automatically
2. Sign in with your Google account
3. Grant permissions to access Google Drive
4. You'll see "Authorization successful!" 
5. The authentication token will be saved to `.token.pickle`
6. Future runs won't require browser authentication

## Step 4: Test the Upload

Run a test upload:

```bash
# Dry run first to see what will be uploaded
python scripts/run_pipeline.py --process-local --dry-run

# Then do the actual upload
python scripts/run_pipeline.py --process-local --skip-enrichment
```

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit credentials.json to git** - It's already in .gitignore
2. **Keep .token.pickle secure** - It contains your access token
3. **For production**, consider:
   - Using environment-specific credentials
   - Encrypting stored tokens
   - Implementing token rotation

## Troubleshooting

### "Missing credentials.json"
- Make sure you downloaded the OAuth2 credentials from Google Cloud Console
- Verify the file is named exactly `credentials.json` and is in your project root

### "Access blocked: This app's request is invalid"
- Make sure you've configured the OAuth consent screen
- Add your email to the test users list
- For production apps, you may need to verify your domain

### "Token has been expired or revoked"
- Delete `.token.pickle` and re-authenticate
- The app will automatically open a browser for re-authentication

### Browser doesn't open automatically
- Check the console for the authorization URL
- Copy and paste it into your browser manually
- After authorizing, the app will continue automatically

## Benefits of OAuth2 vs Service Account

| Feature | Service Account | OAuth2 |
|---------|----------------|---------|
| Storage Quota | 15GB fixed | Your account's quota |
| File Ownership | Service account | Your account |
| Authentication | Automatic | One-time browser |
| Best For | Server apps | Personal/desktop use |

## Advanced Configuration

### Using a Different Google Account

If you want to use a different Google account:
1. Delete `.token.pickle`
2. Run the pipeline again
3. Sign in with the desired account

### Custom Token Storage

To store tokens in a different location:
```bash
OAUTH_TOKEN_FILE=/secure/location/.token.pickle
```

### Headless Server Setup

For servers without a browser:
1. Run the authentication on your local machine first
2. Copy `.token.pickle` to the server
3. Ensure the token file permissions are secure (600)

## Next Steps

After setting up OAuth2:
1. Your uploaded files will be owned by your Google account
2. No more 15GB service account quota issues
3. Files will count against your personal Google Drive storage
4. You can manage files directly in your Google Drive

Happy uploading! 🚀