# Gmail Credentials Setup

## Files in this directory:

1. **`credentials.json`** - OAuth2 client credentials downloaded from Google Cloud Console
2. **`token.json`** - Generated OAuth2 access token (created after first authentication)

## Setup Instructions:

1. Download your OAuth2 credentials JSON file from Google Cloud Console
2. Save it as `gmail_credentials/credentials.json`
3. The `token.json` file will be created automatically on first run

## Security Notes:

- **Never commit these files to git**
- Both files contain sensitive authentication data
- Add `gmail_credentials/` to your `.gitignore`

## Google Cloud Console Setup:

1. Go to https://console.cloud.google.com/
2. Create new project: `knowledge-pipeline-gmail`
3. Enable Gmail API in APIs & Services → Library
4. Create OAuth2 credentials in APIs & Services → Credentials
5. Download credentials and save as `credentials.json` in this directory