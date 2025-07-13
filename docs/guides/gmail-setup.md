# Gmail Integration Guide

This comprehensive guide covers Gmail integration for the Knowledge Pipeline, from initial setup to troubleshooting.

## Table of Contents

- [Quick Start](#quick-start)
- [Complete Setup Guide](#complete-setup-guide)
- [Configuration Reference](#configuration-reference)
- [Testing & Verification](#testing--verification)
- [Troubleshooting](#troubleshooting)
- [Integration & Operations](#integration--operations)
- [Security Best Practices](#security-best-practices)

## Quick Start

### Prerequisites
- Google account
- Knowledge Pipeline v2.0 installed
- Python 3.8+

### File Structure
```
gmail_credentials/
├── credentials.json    # OAuth2 client credentials (from Google Cloud)
├── token.json         # OAuth2 token (auto-generated, DO NOT commit)
└── .gitignore         # Ensures tokens aren't committed
```

### Minimal Setup (Personal Use)

For personal use with minimal configuration:

1. **Create a Google Cloud Project**
   - Go to https://console.cloud.google.com
   - Create new project or select existing
   - Note the project name

2. **Enable Gmail API**
   ```bash
   # Direct link to enable
   https://console.cloud.google.com/apis/library/gmail.googleapis.com
   ```

3. **Create OAuth Credentials**
   - Go to APIs & Services → Credentials
   - Create credentials → OAuth client ID
   - Application type: Desktop app
   - Download JSON as `gmail_credentials/credentials.json`

4. **Configure OAuth Consent (Testing Mode)**
   - APIs & Services → OAuth consent screen
   - User type: External
   - App name: Knowledge Pipeline
   - User support email: your email
   - Developer email: your email
   - Add your email as test user
   - **Leave in "Testing" mode** (no verification needed)

5. **Run Authentication**
   ```bash
   python scripts/run_pipeline.py --source gmail
   # Browser will open for authorization
   ```

## Complete Setup Guide

### Step 1: Google Cloud Project Setup

1. **Create Project**
   - Navigate to [Google Cloud Console](https://console.cloud.google.com)
   - Click "Select a project" → "New Project"
   - Project name: `knowledge-pipeline` (or your preference)
   - Click "Create"

2. **Enable Gmail API**
   - In the search bar, type "Gmail API"
   - Click on Gmail API result
   - Click "Enable"
   - Wait for activation (usually instant)

### Step 2: OAuth Consent Screen Configuration

1. **Navigate to OAuth Consent**
   - Left sidebar: APIs & Services → OAuth consent screen

2. **Choose User Type**
   - Select "External" (allows any Google account)
   - Click "Create"

3. **App Information**
   - App name: `Knowledge Pipeline`
   - User support email: Select your email
   - Developer contact: Your email address

4. **Scopes** (click "Add or Remove Scopes")
   - Search for "Gmail API"
   - Select: `https://www.googleapis.com/auth/gmail.readonly`
   - Click "Update"

5. **Test Users**
   - Click "Add Users"
   - Add your Gmail address
   - Add any other accounts you'll use
   - Maximum 100 test users while in "Testing" mode

6. **Publishing Status**
   - Keep in "Testing" mode for personal use
   - Verification not required for testing mode

### Step 3: Create OAuth2 Credentials

1. **Navigate to Credentials**
   - APIs & Services → Credentials
   - Click "Create Credentials" → "OAuth client ID"

2. **Configure OAuth Client**
   - Application type: "Desktop app"
   - Name: `Knowledge Pipeline Client`
   - Click "Create"

3. **Download Credentials**
   - Click download icon (⬇️) next to your client
   - Save as `gmail_credentials/credentials.json`
   - **Keep this file secure!**

### Step 4: Environment Configuration

Add to your `.env` file:
```bash
# Gmail Configuration
GMAIL_CREDENTIALS_PATH=gmail_credentials/credentials.json
GMAIL_TOKEN_PATH=gmail_credentials/token.json
GMAIL_WINDOW_DAYS=7  # How many days back to search
GMAIL_QUERY="from:newsletter OR from:substack"  # Customize search
```

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GMAIL_CREDENTIALS_PATH` | `gmail_credentials/credentials.json` | OAuth2 client credentials |
| `GMAIL_TOKEN_PATH` | `gmail_credentials/token.json` | Stored authentication token |
| `GMAIL_WINDOW_DAYS` | `7` | Days to look back for emails |
| `GMAIL_QUERY` | `from:newsletter OR from:substack` | Gmail search query |

### Gmail Search Query Syntax

Customize email capture with Gmail's search operators:

```python
# Newsletters and substacks (default)
"from:newsletter OR from:substack"

# Specific senders
"from:techcrunch.com OR from:stratechery.com"

# Label-based
"label:newsletters"

# Subject keywords
"subject:(AI OR machine learning) newer_than:7d"

# Complex queries
"from:(@substack.com OR @mailchimp.com) -subject:unsubscribe"
```

### Smart Filtering

The pipeline includes intelligent filtering to skip:
- Marketing/promotional emails
- Password resets
- Order confirmations
- Auto-replies
- Emails with minimal content

Configure whitelist/blacklist in `src/secondary_sources/gmail/filters.py`:

```python
# Always process these senders
WHITELIST_SENDERS = [
    "ben@stratechery.com",
    "newsletter@pythonweekly.com"
]

# Never process these domains
BLACKLIST_DOMAINS = [
    "marketing.company.com",
    "noreply@github.com"
]
```

## Testing & Verification

### Initial Authentication Test

```bash
# Test Gmail connection
python -c "
from src.secondary_sources.gmail.auth import GmailAuthenticator
auth = GmailAuthenticator('gmail_credentials/credentials.json', 'gmail_credentials/token.json')
service = auth.get_service()
print('✅ Gmail authentication successful!')
"
```

### Capture Test

```bash
# Test email capture (dry run)
python scripts/run_pipeline.py --source gmail --dry-run

# Capture last 3 days only
GMAIL_WINDOW_DAYS=3 python scripts/run_pipeline.py --source gmail
```

### Expected Output

Successful capture shows:
```
2024-01-15 10:23:45 - Gmail - INFO - Starting email capture
2024-01-15 10:23:46 - Gmail - INFO - Found 42 emails matching query
2024-01-15 10:23:47 - Gmail - INFO - Processing: "AI Weekly Newsletter #123"
2024-01-15 10:23:48 - Gmail - INFO - Created new page in Notion
2024-01-15 10:23:55 - Gmail - INFO - Gmail capture complete: {'processed': 15, 'skipped': 25, 'failed': 2}
```

## Troubleshooting

### Common Issues

#### 403 Access Denied Error

**Symptom**: `Error 403: access_denied - Access blocked: Project hasn't been configured`

**Solutions**:

1. **Verify OAuth Consent Configuration**
   - Ensure app is in "Testing" mode
   - Confirm your email is added as test user
   - Check scopes include Gmail readonly

2. **Reset Authentication**
   ```bash
   # Delete token and re-authenticate
   rm gmail_credentials/token.json
   python scripts/run_pipeline.py --source gmail
   ```

3. **Create New Project** (if above fails)
   - Create fresh Google Cloud project
   - Enable Gmail API
   - Set up OAuth consent from scratch
   - Download new credentials.json

#### Token Refresh Failed

**Symptom**: `Failed to refresh credentials`

**Solution**:
```bash
# Force re-authentication
rm gmail_credentials/token.json
python scripts/run_pipeline.py --source gmail
```

#### No Emails Found

**Symptom**: Pipeline runs but finds 0 emails

**Debugging Steps**:
1. Check search query:
   ```python
   # Test query directly
   print(f"Current query: {os.getenv('GMAIL_QUERY', 'from:newsletter OR from:substack')}")
   ```

2. Verify time window:
   ```bash
   # Increase search window
   GMAIL_WINDOW_DAYS=30 python scripts/run_pipeline.py --source gmail
   ```

3. Check Gmail filters aren't archiving emails

#### Rate Limiting

Gmail API quotas:
- **Daily quota**: 1,000,000,000 quota units
- **Per-user rate limit**: 250 quota units per user per second
- **Email read**: 5 quota units per request

If hitting limits:
1. Reduce batch size
2. Add delays between requests
3. Process fewer emails per run

## Integration & Operations

### Pipeline Integration

Gmail capture runs as part of the main pipeline:
```bash
# Full pipeline (all sources)
python scripts/run_pipeline.py

# Gmail only
python scripts/run_pipeline.py --source gmail
```

### Scheduling

Recommended cron schedule:
```bash
# Daily at 8 AM - capture new newsletters
0 8 * * * cd /path/to/pipeline && python scripts/run_pipeline.py --source gmail

# Weekly full capture on Sunday
0 2 * * 0 cd /path/to/pipeline && GMAIL_WINDOW_DAYS=7 python scripts/run_pipeline.py --source gmail
```

### Performance Optimization

1. **Batch Processing**
   - Emails processed in batches of 50
   - Adjust in `capture_emails()` if needed

2. **Content Extraction**
   - HTML parsing optimized for common newsletter formats
   - Falls back to text/plain if HTML fails

3. **Deduplication**
   - SHA-256 hash prevents duplicate imports
   - Based on email content, not subject

### Monitoring

Check logs for capture metrics:
```bash
# View Gmail-specific logs
cat logs/pipeline.jsonl | jq 'select(.logger | contains("gmail"))'

# Monitor success rate
cat logs/pipeline.jsonl | jq 'select(.message | contains("Gmail capture complete"))'
```

## Security Best Practices

### Credential Security

1. **Never commit credentials**
   - `credentials.json` contains client secrets
   - `token.json` contains access tokens
   - Both are in `.gitignore`

2. **File permissions**
   ```bash
   chmod 600 gmail_credentials/credentials.json
   chmod 600 gmail_credentials/token.json
   ```

3. **Token rotation**
   - Tokens auto-refresh when possible
   - Manually rotate every 6 months:
   ```bash
   rm gmail_credentials/token.json
   # Re-authenticate on next run
   ```

### Scope Limitations

- Pipeline only requests `gmail.readonly` scope
- Cannot modify, delete, or send emails
- Cannot access email passwords or account settings

### Audit Trail

All email captures logged with:
- Timestamp
- Email ID
- Sender
- Subject (truncated)
- Processing result

## Appendix

### Gmail API Quotas

| Operation | Quota Cost |
|-----------|------------|
| messages.list | 5 units |
| messages.get | 5 units |
| Daily limit | 1B units |
| Per-user/sec | 250 units |

### Advanced Search Examples

```python
# Tech newsletters from last week
"from:newsletter (tech OR engineering OR AI) newer_than:7d"

# Exclude marketing
"from:substack -subject:(sale OR discount OR offer)"

# Specific labels and unread
"label:newsletters is:unread"

# Size filters
"larger:1M has:attachment"
```

### Useful Links

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [Gmail Search Operators](https://support.google.com/mail/answer/7190)
- [OAuth 2.0 Scopes](https://developers.google.com/identity/protocols/oauth2/scopes#gmail)
- [API Quotas](https://developers.google.com/gmail/api/reference/quota)

For additional help, see the main [Troubleshooting Guide](../operations/troubleshooting.md).