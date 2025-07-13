# Gmail Credentials Directory

This directory stores Gmail OAuth2 credentials for the Knowledge Pipeline.

## Files

- `credentials.json` - OAuth2 client credentials from Google Cloud Console
- `token.json` - Persistent authentication token (auto-generated)

Both files are gitignored for security.

## Setup Instructions

For complete Gmail integration setup, see [Gmail Setup Guide](../docs/guides/gmail-setup.md)

## Security Note

**Never commit these files to version control!** They contain sensitive authentication data.