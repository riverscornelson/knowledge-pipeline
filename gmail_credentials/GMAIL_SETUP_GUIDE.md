# Gmail Integration Setup Guide

## Complete Setup Instructions

### Step 1: Google Cloud Project Setup

1. **Create Google Cloud Project**:
   - Visit https://console.cloud.google.com/
   - Click "Select a project" → "New Project"
   - Name: `knowledge-pipeline-gmail`
   - Click "Create"

2. **Enable Gmail API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Gmail API"
   - Click "Gmail API" → "Enable"

### Step 2: OAuth Consent Screen Configuration

1. **Navigate to OAuth Consent Screen**:
   - Go to "APIs & Services" → "OAuth consent screen"

2. **Configure Basic Information**:
   - **User Type**: External
   - **App name**: `Knowledge Pipeline Gmail`
   - **User support email**: Your Gmail address
   - **Developer contact information**: Your Gmail address

3. **Add Required Scopes**:
   - Click "Add or Remove Scopes"
   - Add: `https://www.googleapis.com/auth/gmail.readonly`
   - Save and continue

4. **Add Test Users** (CRITICAL):
   - In "Test users" section, click "Add Users"
   - Add your Gmail address
   - Save and continue

5. **Publishing Status**:
   - Keep as "Testing" (do not publish for personal use)
   - This allows up to 100 test users without verification

### Step 3: Create OAuth Credentials

1. **Create OAuth Client ID**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Desktop application"
   - Name: `knowledge-pipeline-oauth`

2. **Download Credentials**:
   - Click "Download JSON"
   - Save as `gmail_credentials/credentials.json`

### Step 4: Environment Configuration

Add these variables to your `.env` file:

```bash
# Gmail Integration (Required)
GMAIL_CREDENTIALS_PATH=gmail_credentials/credentials.json
GMAIL_TOKEN_PATH=gmail_credentials/token.json

# Gmail Search Configuration (Optional)
GMAIL_SEARCH_QUERY=from:newsletter OR from:substack OR from:digest
GMAIL_WINDOW_DAYS=7

# Email Filtering (Optional)
EMAIL_SENDER_WHITELIST=important@newsletter.com,special@substack.com
EMAIL_SENDER_BLACKLIST=spam@example.com,marketing@company.com
```

### Step 5: Install Dependencies

```bash
python3 -m pip install -r requirements.txt
```

### Step 6: Test Authentication

```bash
python3 gmail_auth.py
```

Expected flow:
1. Browser opens OAuth consent screen
2. Warning: "Google hasn't verified this app" (normal for testing)
3. Click "Advanced" → "Go to Knowledge Pipeline Gmail (unsafe)"
4. Grant permissions
5. Success message with email address and message count

### Step 7: Test Email Capture

```bash
python3 capture_emails.py
```

Expected output:
- Gmail authentication success
- Email search and filtering results
- Notion database entries created
- Filtering statistics showing cost savings

## Configuration Options

### Gmail Search Query

Customize what emails to capture:

```bash
# Default (broad newsletter search)
GMAIL_SEARCH_QUERY=from:newsletter OR from:substack OR from:digest

# Specific senders only
GMAIL_SEARCH_QUERY=from:simonw@substack.com OR from:oneusefulthing@substack.com

# Subject-based filtering
GMAIL_SEARCH_QUERY=subject:AI OR subject:"machine learning"

# Time-based with other filters
GMAIL_SEARCH_QUERY=(from:newsletter OR from:substack) after:2024/01/01
```

### Smart Filtering

**Whitelist Priority Senders**:
```bash
EMAIL_SENDER_WHITELIST=important@newsletter.com,vip@substack.com
```

**Blacklist Problem Senders**:
```bash
EMAIL_SENDER_BLACKLIST=spam@domain.com,notifications@linkedin.com
```

### Window Configuration

```bash
# Look back 30 days for emails (default: 7)
GMAIL_WINDOW_DAYS=30

# Only get very recent emails
GMAIL_WINDOW_DAYS=1
```

## Troubleshooting

### Common Issues

**"403 access_denied"**:
- Ensure OAuth consent screen is configured
- Add your Gmail as test user
- Keep publishing status as "Testing"

**"Gmail API not enabled"**:
- Enable Gmail API in Google Cloud Console
- Wait 5-10 minutes for propagation

**"Rate limit exceeded"**:
- The system automatically retries with exponential backoff
- Gmail API has generous limits for personal use

**"Token expired"**:
- Delete `gmail_credentials/token.json`
- Run `python3 gmail_auth.py` to re-authenticate

### Performance Tips

**Optimize Filtering**:
- Use specific sender patterns to reduce API calls
- Adjust `GMAIL_WINDOW_DAYS` to control volume
- Monitor filtering statistics for cost optimization

**Rate Limiting**:
- System includes automatic retry logic
- Default 0.5s delay between emails
- Exponential backoff for API errors

## Security Best Practices

1. **Never commit credentials**:
   - `gmail_credentials/*.json` is in `.gitignore`
   - Keep OAuth credentials secure

2. **Use least privilege**:
   - Only `gmail.readonly` scope requested
   - Cannot send emails or modify Gmail

3. **Token management**:
   - Tokens auto-refresh when expired
   - Store in secure location only

4. **Test user limitation**:
   - Keep app in "Testing" mode
   - Only you can access the integration

## Integration with Pipeline

The Gmail capture is automatically included in `pipeline.sh`:

```bash
./pipeline.sh
```

Order of operations:
1. `ingest_drive.py` - PDF capture
2. `capture_rss.py` - RSS feed capture  
3. `capture_websites.py` - Website scraping
4. `capture_emails.py` - Gmail email capture
5. `enrich.py` - PDF enrichment
6. `enrich_rss.py` - Content enrichment (RSS, websites, emails)

## Monitoring and Maintenance

**Check Gmail quota**:
- Gmail API: 1 billion quota units/day
- Typical usage: ~10-50 units per email
- Monitor in Google Cloud Console

**Filter effectiveness**:
- Review filtering statistics in output
- Adjust whitelist/blacklist based on results
- Monitor cost savings vs content quality

**Token refresh**:
- Tokens auto-refresh for 6 months
- Re-authenticate when needed
- Monitor for authentication errors in logs