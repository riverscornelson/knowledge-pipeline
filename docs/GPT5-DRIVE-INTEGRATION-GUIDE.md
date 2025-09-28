# GPT-5 Drive Integration Guide

## Overview

The GPT-5 Drive Integration provides a comprehensive system for automatically processing Google Drive documents through the GPT-5 optimized Notion pipeline. This system features advanced status tracking, error handling, and CLI management capabilities.

## Architecture

### Core Components

1. **GPT5DriveProcessor** (`src/drive/gpt5_drive_processor.py`)
   - Main processing engine with CLI interface
   - Integrates GPT-5 quality validation and Notion formatting
   - Supports batch processing with rate limiting

2. **DriveStatusManager** (`src/drive/status_manager.py`)
   - SQLite-based status tracking system
   - Manages processing states and retry logic
   - Provides performance metrics and auditing

3. **DriveErrorHandler** (`src/drive/error_handler.py`)
   - Advanced error categorization and retry strategies
   - Circuit breaker pattern for API protection
   - Comprehensive error analysis and reporting

## Quick Start

### Prerequisites

1. **Google Drive API Setup**
   - Service account credentials configured
   - Drive folder access permissions
   - API quotas sufficient for batch processing

2. **Notion Integration**
   - Notion API token configured
   - Database with proper schema
   - Write permissions for content creation

3. **Environment Configuration**
   ```bash
   export USE_GPT5_OPTIMIZATION=true
   export GPT5_MODEL=gpt-5
   export GPT5_REASONING=high
   ```

### Basic Usage

#### Process All Inbox Files
```bash
python scripts/run_gpt5_drive_integration.py --all
```

#### Process Specific Files
```bash
python scripts/run_gpt5_drive_integration.py --file-ids "1abc123,2def456,3ghi789"
```

#### Process with Status Filter
```bash
python scripts/run_gpt5_drive_integration.py --all --status-filter "failed"
```

#### Dry Run (Preview Mode)
```bash
python scripts/run_gpt5_drive_integration.py --all --dry-run
```

### Advanced Options

#### Force Reprocessing
```bash
python scripts/run_gpt5_drive_integration.py --file-ids "1abc123" --force
```

#### Custom Batch Size
```bash
python scripts/run_gpt5_drive_integration.py --all --batch-size 3
```

#### With Logging
```bash
python scripts/run_gpt5_drive_integration.py --all --log-level DEBUG
```

## CLI Reference

### Command Flags

| Flag | Description | Example |
|------|-------------|---------|
| `--all` | Process all inbox files | `--all` |
| `--file-ids` | Comma-separated file IDs | `--file-ids "1,2,3"` |
| `--status-filter` | Filter by status | `--status-filter "failed"` |
| `--dry-run` | Preview without processing | `--dry-run` |
| `--batch-size` | Files per batch | `--batch-size 5` |
| `--force` | Force reprocess completed files | `--force` |
| `--config` | Custom config file path | `--config "custom.yaml"` |
| `--log-level` | Logging verbosity | `--log-level DEBUG` |

### Status Values

- `inbox` - Newly discovered files
- `processing` - Currently being processed
- `completed` - Successfully processed
- `failed` - Processing failed
- `skipped` - Intentionally skipped

## Configuration

### GPT-5 Optimization Settings

The system uses the latest GPT-5 refined prompts (`config/prompts-gpt5-refined-v2.yaml`) with:

- **Model**: GPT-5 with high reasoning
- **Quality Target**: ≥9.2/10
- **Processing Time**: <25 seconds
- **Block Limit**: ≤12 blocks
- **Notion Aesthetics**: Mobile-first design

### Rate Limiting

Default rate limiting configuration:
- **Batch Size**: 5 files
- **Inter-file Delay**: 0.3 seconds
- **Inter-batch Delay**: 2.0 seconds
- **API Timeout**: 30 seconds

### Error Handling

#### Retry Strategies

1. **Rate Limiting**: Exponential backoff (5 retries, 3s base delay)
2. **Transient Errors**: Exponential backoff (3 retries, 1s base delay)
3. **Network Issues**: Exponential backoff (3 retries, 2s base delay)
4. **Authentication**: No retry (manual intervention required)
5. **Validation**: No retry (data issue)

#### Circuit Breakers

- **Drive API**: 5 failures → 60s timeout
- **Notion API**: 3 failures → 30s timeout
- **GPT API**: 3 failures → 120s timeout

## Status Management

### Database Schema

The status manager uses SQLite with these tables:

1. **processing_records** - Main file tracking
2. **status_history** - Audit trail
3. **performance_metrics** - Aggregated statistics

### Status Lifecycle

```
discovered → queued → processing → completed
                  ↓         ↓
               skipped   failed → retry_pending → queued
```

### Monitoring Commands

#### Check Status Statistics
```python
from src.drive.status_manager import DriveStatusManager
manager = DriveStatusManager()
stats = manager.get_processing_stats(days=7)
print(json.dumps(stats, indent=2))
```

#### Export Status Report
```python
report_path = manager.export_status_report()
print(f"Report saved to: {report_path}")
```

## Error Analysis

### Error Categories

1. **TRANSIENT** - Temporary issues, safe to retry
2. **RATE_LIMIT** - API rate limiting
3. **AUTHENTICATION** - Auth/permission issues
4. **NOT_FOUND** - Resource not found
5. **VALIDATION** - Data validation errors
6. **QUOTA_EXCEEDED** - Quota/limit exceeded
7. **NETWORK** - Network connectivity issues
8. **SYSTEM** - System/infrastructure errors

### Error Metrics

```python
from src.drive.error_handler import DriveErrorHandler
handler = DriveErrorHandler()
metrics = handler.get_error_metrics()
print(json.dumps(metrics, indent=2))
```

### Generate Error Report

```python
report_path = handler.export_error_report()
print(f"Error analysis saved to: {report_path}")
```

## Quality Assurance

### GPT-5 Quality Standards

The system enforces strict quality standards:

- **Content Quality**: ≥9.0/10 (target: 9.2+)
- **Aesthetic Quality**: ≥8.5/10 for Notion formatting
- **Mobile Readability**: ≥9.0/10 for mobile optimization
- **Processing Speed**: <25 seconds per document

### Quality Validation Process

1. **Content Extraction** - Drive file content parsing
2. **GPT-5 Analysis** - High reasoning mode processing
3. **Quality Scoring** - Multi-criteria validation
4. **Notion Formatting** - Aesthetic optimization
5. **Final Validation** - Block count and mobile checks

### Quality Metrics

```json
{
  "quality_score": 9.2,
  "processing_time": 18.5,
  "block_count": 10,
  "aesthetic_score": 9.0,
  "mobile_optimized": true
}
```

## Performance Optimization

### Batch Processing Strategy

- **Small Batches**: Better error isolation
- **Rate Limiting**: Prevent API throttling
- **Parallel Components**: Independent processing stages
- **Memory Management**: Efficient resource usage

### Recommended Settings

#### High Volume (>100 files)
```bash
--batch-size 3 --log-level INFO
```

#### Quality Focus
```bash
--batch-size 1 --log-level DEBUG
```

#### Speed Focus
```bash
--batch-size 10 --log-level WARNING
```

## Troubleshooting

### Common Issues

#### 1. Authentication Errors
```
Error: "forbidden" or "insufficientPermissions"
```
**Solution**: Check service account permissions and API credentials

#### 2. Rate Limiting
```
Error: "quotaExceeded" or "userRateLimitExceeded"
```
**Solution**: Reduce batch size or increase delays

#### 3. Quality Failures
```
Error: "Quality score 7.5 too low"
```
**Solution**: Check source document quality or adjust thresholds

#### 4. Notion Block Limits
```
Error: "Block count 15 exceeds limit"
```
**Solution**: Review formatting rules or increase limits

### Debug Commands

#### Enable Debug Logging
```bash
--log-level DEBUG
```

#### Check Circuit Breaker Status
```python
from src.drive.error_handler import DriveErrorHandler
handler = DriveErrorHandler()
print(handler.get_error_metrics()["circuit_breakers"])
```

#### Reset Circuit Breaker
```python
handler.reset_circuit_breaker("drive_api")
```

### Log Files

- **Application Logs**: `/workspaces/knowledge-pipeline/logs/gpt5_drive_integration.log`
- **Processing Results**: `/workspaces/knowledge-pipeline/results/gpt5_drive_processing_*.json`
- **Error Reports**: `/workspaces/knowledge-pipeline/results/error_analysis_report_*.json`
- **Status Reports**: `/workspaces/knowledge-pipeline/results/drive_status_report_*.json`

## API Integration

### Programmatic Usage

```python
from src.drive.gpt5_drive_processor import GPT5DriveProcessor

# Initialize processor
processor = GPT5DriveProcessor()

# Process specific files
file_ids = ["1abc123", "2def456"]
results = processor.process_batch(file_ids, batch_size=2)

# Process all inbox
results = processor.process_all_inbox(status_filter="failed")

print(f"Processed: {results['completed']} files")
print(f"Failed: {results['failed']} files")
```

### Status Management API

```python
from src.drive.status_manager import DriveStatusManager, ProcessingStatus, Priority

# Initialize manager
manager = DriveStatusManager()

# Add file to tracking
record = manager.add_file(
    file_id="new_file_123",
    file_name="Important Document",
    drive_url="https://drive.google.com/file/d/new_file_123/view",
    priority=Priority.HIGH
)

# Update status
manager.update_status(
    "new_file_123",
    ProcessingStatus.COMPLETED,
    quality_score=9.3,
    block_count=8
)

# Get status
current_status = manager.get_file_status("new_file_123")
print(f"Status: {current_status.status.value}")
```

## Testing

### Run Test Suite

```bash
cd /workspaces/knowledge-pipeline
python -m pytest tests/test_gpt5_drive_integration.py -v
```

### Test Categories

1. **Unit Tests** - Individual component testing
2. **Integration Tests** - Component interaction testing
3. **CLI Tests** - Command-line interface testing
4. **Error Handling Tests** - Resilience testing

### Mock Testing

The test suite includes comprehensive mocking for:
- Google Drive API responses
- Notion API interactions
- GPT-5 processing results
- Error scenarios

## Production Deployment

### Prerequisites Checklist

- [ ] Google Drive service account configured
- [ ] Notion API token and database access
- [ ] GPT-5 API access and quotas
- [ ] Sufficient disk space for logs and results
- [ ] Network connectivity to all APIs
- [ ] Backup strategy for status database

### Monitoring Setup

1. **Log Monitoring** - Set up log aggregation
2. **Error Alerting** - Monitor error rates and circuit breaker trips
3. **Performance Tracking** - Track processing times and quality scores
4. **Resource Monitoring** - CPU, memory, and disk usage

### Scaling Considerations

- **Horizontal Scaling**: Run multiple instances with different file sets
- **Vertical Scaling**: Increase batch sizes for more powerful hardware
- **API Quotas**: Monitor and manage API usage across instances
- **Database Scaling**: Consider PostgreSQL for high-volume deployments

## Support and Maintenance

### Regular Maintenance Tasks

1. **Status Database Cleanup** - Remove old records (90+ days)
2. **Log Rotation** - Archive old log files
3. **Performance Review** - Analyze processing metrics
4. **Error Analysis** - Review error patterns and trends
5. **API Quota Monitoring** - Track usage and limits

### Health Checks

```bash
# Check system status
python scripts/run_gpt5_drive_integration.py --all --dry-run

# Verify configuration
python -c "from src.drive.gpt5_drive_processor import GPT5DriveProcessor; print('✅ Configuration valid')"

# Test API connectivity
python -c "
from src.core.notion_client import NotionClient
from src.core.config import PipelineConfig
config = PipelineConfig.from_env()
client = NotionClient(config.notion)
print('✅ Notion API connected')
"
```

## Changelog

### v1.0.0 (2024-12-27)
- Initial release with GPT-5 integration
- Advanced status management system
- Comprehensive error handling with circuit breakers
- CLI interface with full feature set
- Aesthetic-focused Notion formatting
- Mobile-first design optimization

---

For additional support, please refer to the test suite and example implementations in the codebase.