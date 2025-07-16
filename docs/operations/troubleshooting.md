# Knowledge Pipeline v3.0 - Troubleshooting Guide

This guide helps diagnose and resolve common issues with the Knowledge Pipeline.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Common Issues](#common-issues)
  - [Notion API Errors](#notion-api-errors)
  - [Google Drive Issues](#google-drive-issues)
  - [OpenAI API Errors](#openai-api-errors)
  - [Content Processing Failures](#content-processing-failures)
- [Performance Issues](#performance-issues)
- [Debugging Procedures](#debugging-procedures)
- [Recovery Procedures](#recovery-procedures)
- [FAQ](#faq)

## Quick Diagnostics

### 1. Check Pipeline Status
```bash
# View recent logs
tail -n 50 logs/pipeline.jsonl | jq .

# Check for errors
cat logs/pipeline.jsonl | jq 'select(.level == "ERROR")'

# Find failed items
cat logs/pipeline.jsonl | jq 'select(.message | contains("Failed"))'
```

### 2. Verify Configuration
```bash
# Test environment variables
python -c "from src.core.config import PipelineConfig; PipelineConfig.from_env()"

# If error, check your .env file
cat .env | grep -E "NOTION_TOKEN|OPENAI_API_KEY|GOOGLE_APP_CREDENTIALS"
```

### 3. Test Individual Components
```bash
# Test Drive ingestion only
python scripts/run_pipeline.py --dry-run

# Test enrichment on existing items
python scripts/run_pipeline.py --skip-enrichment
```

## Common Issues

### Notion API Errors

#### Error: "502 Bad Gateway"
**Symptom**: `Notion API 502 error (attempt X/3)`

**Cause**: Notion servers temporarily unavailable

**Solution**:
1. The pipeline automatically retries with exponential backoff
2. If persistent, check Notion status: https://status.notion.so
3. Increase retry attempts in code if needed

#### Error: "Rate limited (429)"
**Symptom**: `Notion API rate limited`

**Cause**: Too many requests to Notion API

**Solution**:
```bash
# Increase delay between requests
export RATE_LIMIT_DELAY=1.0  # Default is 0.3

# Reduce batch size
export BATCH_SIZE=5  # Default is 10
```

#### Error: "Archived page"
**Symptom**: `Page is archived, skipping operation`

**Cause**: Page was deleted or archived in Notion

**Solution**:
- This is handled gracefully - no action needed
- To reprocess, unarchive the page in Notion

#### Error: "Validation error"
**Symptom**: `body failed validation: body.properties.X.Y...`

**Cause**: Property name mismatch or invalid value

**Solution**:
1. Check exact property names in Notion database:
   ```python
   # Debug script to check schema
   from src.core.config import PipelineConfig
   from src.core.notion_client import NotionClient
   
   config = PipelineConfig.from_env()
   client = NotionClient(config.notion)
   db_info = client.client.databases.retrieve(client.db_id)
   
   for prop_name, prop_config in db_info['properties'].items():
       print(f"{prop_name}: {prop_config['type']}")
   ```

2. Ensure values match property types (select options, etc.)

### Google Drive Issues

#### Error: "Invalid Drive URL"
**Symptom**: `Could not extract file ID from URL`

**Cause**: Malformed Google Drive URL

**Solution**:
- Ensure URL format: `https://drive.google.com/file/d/FILE_ID/view`
- Check for special characters in file ID

#### Error: "PDF download failed"
**Symptom**: `Failed to download file`

**Cause**: Permission issues or invalid file ID

**Solution**:
1. Verify service account has access to the file/folder
2. Share folder with service account email
3. Check service account JSON path:
   ```bash
   ls -la $GOOGLE_APP_CREDENTIALS
   ```

#### Error: "PDF text extraction failed"
**Symptom**: Empty content from PDF

**Cause**: Corrupted PDF or image-only PDF

**Solution**:
- Pipeline continues with empty content (marked as failed)
- For image PDFs, OCR is not currently supported
- Consider pre-processing PDFs with OCR tools

### OpenAI API Errors

#### Error: "Timeout"
**Symptom**: `Request timed out`

**Cause**: Large content or slow API response

**Solution**:
1. Content is automatically chunked to fit context
2. For persistent issues, check OpenAI status
3. Consider using faster models for classification:
   ```bash
   export MODEL_CLASSIFIER=gpt-3.5-turbo
   ```

#### Error: "Invalid API key"
**Symptom**: `Incorrect API key provided`

**Solution**:
```bash
# Verify API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

#### Error: "Rate limit exceeded"
**Symptom**: `429 Too Many Requests`

**Solution**:
- Pipeline automatically handles with retry
- Reduce batch size to process fewer items
- Upgrade OpenAI plan for higher limits

### Gmail Integration Problems

#### Error: "403 Access Denied"
**Symptom**: `Access blocked: Project hasn't been configured`

**Cause**: OAuth consent screen not configured

**Solution**:
1. Follow setup guide: See FUTURE_FEATURES.md for planned Gmail integration
2. Key steps:
   - Enable Gmail API in GCP Console
   - Configure OAuth consent screen
   - Add test users if in testing mode
   - Re-authenticate with new credentials

#### Error: "Token refresh failed"
**Symptom**: `Failed to refresh credentials`

**Solution**:
```bash
# Delete token and re-authenticate
# Gmail integration removed - see FUTURE_FEATURES.md
# Follow browser prompt to re-authorize
```

### Content Processing Failures

#### Error: "No content extracted"
**Symptom**: Items stuck with Status="Failed"

**Causes & Solutions**:

1. **Empty PDF**: Check if PDF has text content
2. **Website blocking**: Firecrawl may be blocked
   - Try alternative scraping methods
   - Check if site requires authentication
3. **Email parsing**: Complex HTML structure
   - Check email filter settings
   - Verify sender is not blocked

#### Error: "Content too large"
**Symptom**: `Content truncated to 50KB`

**Solution**:
- This is by design to prevent Notion API errors
- Full content still processed for AI analysis
- Consider summarizing before storage

## Performance Issues

### Slow Processing

#### Symptom: Pipeline takes hours to complete

**Solutions**:

1. **Parallel Processing**:
   ```bash
   # Process sources separately
   python scripts/run_pipeline.py --source drive &
   python scripts/run_pipeline.py &
   ```

2. **Skip Re-processing**:
   - Drive ingester skips existing files by default
   - Email capture uses date windows

3. **Optimize Batch Size**:
   ```bash
   # Larger batches for simple content
   export BATCH_SIZE=20
   
   # Smaller for complex PDFs
   export BATCH_SIZE=5
   ```

### Memory Issues

#### Symptom: "MemoryError" or process killed

**Solutions**:

1. **Reduce batch size**:
   ```bash
   export BATCH_SIZE=3
   ```

2. **Process in chunks**:
   ```python
   # Custom script for large backlogs
   processor.process_batch(limit=50)
   ```

3. **Increase system memory** or use swap:
   ```bash
   # Add 4GB swap
   sudo fallocate -l 4G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

## Debugging Procedures

### Enable Detailed Logging

1. **View structured logs**:
   ```bash
   # Real-time log viewing with formatting
   tail -f logs/pipeline.jsonl | jq '.'
   
   # Filter by component
   tail -f logs/pipeline.jsonl | jq 'select(.logger | contains("enrichment"))'
   ```

2. **Performance metrics**:
   ```bash
   # Find slow operations
   cat logs/pipeline.jsonl | jq 'select(.processing_time > 10)'
   ```

### Test Individual Components

```python
# Test Notion connection
from src.core.config import PipelineConfig
from src.core.notion_client import NotionClient

config = PipelineConfig.from_env()
client = NotionClient(config.notion)
print("Database ID:", client.db_id)

# Test single item
for item in client.get_inbox_items(limit=1):
    print("Found item:", item['properties']['Title']['title'][0]['text']['content'])
```

### API Debugging

1. **Notion API Test**:
   ```bash
   curl -X GET https://api.notion.com/v1/databases/$NOTION_SOURCES_DB \
     -H "Authorization: Bearer $NOTION_TOKEN" \
     -H "Notion-Version: 2022-06-28"
   ```

2. **OpenAI API Test**:
   ```bash
   curl https://api.openai.com/v1/chat/completions \
     -H "Authorization: Bearer $OPENAI_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model": "gpt-3.5-turbo", "messages": [{"role": "user", "content": "test"}]}'
   ```

## Recovery Procedures

### Reprocess Failed Items

1. **Find failed items in Notion**:
   - Filter by Status = "Failed"
   - Check error messages in properties

2. **Reset status for reprocessing**:
   ```python
   # Script to reset failed items
   from src.core.config import PipelineConfig
   from src.core.notion_client import NotionClient
   from src.core.models import ContentStatus
   
   config = PipelineConfig.from_env()
   client = NotionClient(config.notion)
   
   # Get failed items
   failed_filter = {
       "property": "Status",
       "select": {"equals": "Failed"}
   }
   
   results = client.client.databases.query(
       database_id=client.db_id,
       filter=failed_filter
   )
   
   # Reset to Inbox
   for page in results['results']:
       client.update_page_status(page['id'], ContentStatus.INBOX)
       print(f"Reset: {page['id']}")
   ```

### Clean Up Duplicates

```python
# Find and remove duplicates
from collections import defaultdict

# Get all items
all_items = client.client.databases.query(database_id=client.db_id)

# Group by hash
hash_groups = defaultdict(list)
for item in all_items['results']:
    if 'Hash' in item['properties']:
        hash_val = item['properties']['Hash']['rich_text']
        if hash_val:
            hash_groups[hash_val[0]['text']['content']].append(item)

# Archive duplicates (keep newest)
for hash_val, items in hash_groups.items():
    if len(items) > 1:
        # Sort by created time, keep newest
        items.sort(key=lambda x: x['created_time'], reverse=True)
        for duplicate in items[1:]:
            client.client.pages.update(
                page_id=duplicate['id'],
                archived=True
            )
```

### Database Maintenance

1. **Archive old processed items**:
   ```python
   from datetime import datetime, timedelta
   
   # Archive items older than 90 days
   cutoff_date = datetime.now() - timedelta(days=90)
   
   old_filter = {
       "and": [
           {"property": "Status", "select": {"equals": "Enriched"}},
           {"property": "Created time", "date": {"before": cutoff_date.isoformat()}}
       ]
   }
   ```

2. **Export backup**:
   - Use Notion's export feature
   - Regular JSON backups of critical items

## FAQ

### Q: Why are items stuck in "Inbox" status?
**A**: Several possibilities:
1. Enrichment errors - check logs for failures
2. Pipeline interrupted - rerun to continue
3. Rate limits hit - wait and retry
4. Empty content - these are skipped

### Q: How do I handle duplicate content?
**A**: The pipeline automatically:
1. Calculates SHA-256 hash of content
2. Checks for existing hash before creating
3. Skips duplicates with "Already exists" message

To force reprocessing:
1. Delete the duplicate in Notion
2. Or change the content slightly

### Q: What happens if the pipeline crashes mid-run?
**A**: The pipeline is stateless and idempotent:
- Completed items have Status="Enriched"
- Failed items have Status="Failed"
- Unprocessed remain as Status="Inbox"
- Simply rerun - it will continue where it left off

### Q: How do I process only specific items?
**A**: Options:
1. Use Notion filters to temporarily archive others
2. Modify the `get_inbox_items` query filter
3. Create a custom script with specific page IDs

### Q: Why is Gmail capture not finding emails?
**A**: Check:
1. Date window: `GMAIL_WINDOW_DAYS` (default 7)
2. Search query in code (default: "from:newsletter OR from:substack")
3. Email filters blocking senders
4. Gmail API quotas

### Q: Can I run multiple instances?
**A**: Yes, but:
1. Use different Notion databases to avoid conflicts
2. Or implement locking mechanism
3. Monitor for rate limit issues
4. Consider separating by source type

### Q: How do I monitor pipeline health?
**A**: Several approaches:
1. Check last run time in logs
2. Monitor Notion database for stuck items
3. Set up alerts for error count thresholds
4. Monitor logs for recent execution timestamps

## Getting Help

1. **Check logs first** - Most issues are clearly logged
2. **Review configuration** - Ensure all credentials are correct
3. **Test components individually** - Isolate the problem
4. **Check API status pages** - External services may be down

For additional support:
- Review architecture documentation
- Check API reference for component details
- Consider adding custom error handling for specific use cases