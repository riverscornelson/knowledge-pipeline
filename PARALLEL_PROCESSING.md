# Parallel Processing & Enhanced Logging

This document describes the parallel processing and enhanced logging features added to the knowledge pipeline.

## Overview

The enhanced pipeline includes:
- **Parallel Processing**: Concurrent enrichment of multiple items using asyncio
- **Structured Logging**: JSON-formatted logs with performance metrics
- **API Call Tracking**: Monitor OpenAI, Notion, and other API usage
- **Migration Safety**: Gradual rollout with rollback capabilities
- **Backward Compatibility**: Original sequential processing remains available

## Performance Improvements

- **3-5x faster processing** through parallel execution
- **Intelligent rate limiting** to respect API limits
- **Batched API calls** where possible
- **Progress monitoring** with detailed metrics

## Quick Start

### 1. Migration Setup

```bash
# Install new dependencies
pip install -r requirements.txt

# Perform gradual migration
python3 migrate_to_parallel.py migrate

# Test enhanced functionality
python3 migrate_to_parallel.py test
```

### 2. Run Enhanced Pipeline

```bash
# Sequential with enhanced logging
./pipeline_enhanced.sh

# Enable parallel processing
export ENABLE_PARALLEL=true
./pipeline_enhanced.sh
```

### 3. Monitor Performance

```bash
# View structured logs
tail -f logs/pipeline.jsonl | jq '.'

# Check metrics
grep "pipeline_summary" logs/pipeline.jsonl | jq '.extra_fields.metrics'
```

## Configuration

### Environment Variables

```bash
# Parallel Processing
ENABLE_PARALLEL=true              # Enable/disable parallel processing
PARALLEL_MAX_WORKERS=5            # Number of concurrent workers
PARALLEL_RATE_LIMIT=0.1           # Delay between requests (seconds)

# Logging
LOG_DIR=logs                      # Log directory
LOG_LEVEL=INFO                    # Logging level (DEBUG, INFO, WARNING, ERROR)

# Enhanced Features
USE_ENHANCED=true                 # Use enhanced enrichment scripts
API_TIMEOUT=60                    # API request timeout (seconds)
RETRY_ATTEMPTS=3                  # Number of retry attempts
```

### Performance Tuning

```bash
# Conservative settings (recommended for initial rollout)
PARALLEL_MAX_WORKERS=3
PARALLEL_RATE_LIMIT=0.2

# Aggressive settings (for high-volume processing)
PARALLEL_MAX_WORKERS=8
PARALLEL_RATE_LIMIT=0.05
```

## Enhanced Scripts

### RSS/Website Enrichment

```bash
# Enhanced sequential processing
python3 enrich_rss_enhanced.py

# Enhanced parallel processing
python3 enrich_rss_enhanced.py --parallel

# Original implementation (fallback)
python3 enrich_rss_enhanced.py --original
```

### PDF Enrichment

```bash
# Enhanced processing with logging
python3 enrich_enhanced.py

# Original implementation (fallback)
python3 enrich_enhanced.py --original
```

## Monitoring & Metrics

### Structured Logs

Logs are written in JSON format to `logs/pipeline.jsonl`:

```json
{
  "timestamp": "2024-01-15T10:30:00.123Z",
  "level": "INFO",
  "logger": "parallel_enricher",
  "message": "Starting parallel processing of 25 items",
  "extra_fields": {
    "event_type": "parallel_start",
    "total_items": 25,
    "max_workers": 5
  }
}
```

### Performance Metrics

Track key metrics:
- Processing times per item
- API call counts and latency
- Success/failure rates
- Token usage for OpenAI calls

### Log Analysis

```bash
# View all errors
jq 'select(.level=="ERROR")' logs/pipeline.jsonl

# API call metrics
jq 'select(.extra_fields.event_type=="api_call_complete")' logs/pipeline.jsonl

# Processing summary
jq 'select(.extra_fields.event_type=="pipeline_summary")' logs/pipeline.jsonl
```

## Migration Strategy

### Phase 1: Enhanced Logging (Sequential)

```bash
# Enable enhanced logging without parallel processing
export USE_ENHANCED=true
export ENABLE_PARALLEL=false
./pipeline_enhanced.sh
```

**Benefits:**
- Structured logging for monitoring
- Performance metrics collection
- API call tracking
- Zero risk - same processing logic

### Phase 2: Parallel Processing (Limited)

```bash
# Enable parallel processing with conservative settings
export ENABLE_PARALLEL=true
export PARALLEL_MAX_WORKERS=3
export PARALLEL_RATE_LIMIT=0.2
./pipeline_enhanced.sh
```

**Benefits:**
- 2-3x performance improvement
- Limited concurrency reduces risk
- Detailed monitoring of parallel operations

### Phase 3: Optimized Parallel Processing

```bash
# Optimize for maximum performance
export PARALLEL_MAX_WORKERS=5
export PARALLEL_RATE_LIMIT=0.1
./pipeline_enhanced.sh
```

**Benefits:**
- 3-5x performance improvement
- Full utilization of API limits
- Production-ready performance

## Safety & Rollback

### Backup

Migration automatically creates backups:

```bash
ls backups/migration_*
# backups/migration_20240115_103000/
#   ├── pipeline.sh
#   ├── enrich.py
#   └── enrich_rss.py
```

### Rollback

```bash
# Rollback to previous version
python3 migrate_to_parallel.py rollback backups/migration_20240115_103000

# Or manually restore original pipeline
./pipeline.sh  # Original pipeline still works
```

### Feature Flags

Disable features individually:

```bash
# Disable parallel processing
export ENABLE_PARALLEL=false

# Disable enhanced features entirely
export USE_ENHANCED=false
./pipeline_enhanced.sh  # Falls back to original scripts
```

## Troubleshooting

### Common Issues

**Import Errors:**
```bash
# Check dependencies
pip install -r requirements.txt

# Test imports
python3 migrate_to_parallel.py test
```

**Rate Limiting:**
```bash
# Increase rate limit delay
export PARALLEL_RATE_LIMIT=0.3

# Reduce concurrent workers
export PARALLEL_MAX_WORKERS=2
```

**Memory Issues:**
```bash
# Reduce worker count
export PARALLEL_MAX_WORKERS=3

# Monitor memory usage
htop
```

**API Failures:**
```bash
# Check logs for specific errors
jq 'select(.extra_fields.event_type=="api_call_error")' logs/pipeline.jsonl

# Increase timeout
export API_TIMEOUT=120
```

### Performance Issues

**Slow Processing:**
```bash
# Check API call metrics
jq 'select(.extra_fields.event_type=="api_call_complete") | .extra_fields.duration' logs/pipeline.jsonl

# Verify parallel processing is enabled
grep "parallel_start" logs/pipeline.jsonl
```

**High Error Rates:**
```bash
# Check error patterns
jq 'select(.level=="ERROR") | .extra_fields.error' logs/pipeline.jsonl

# Review retry attempts
export RETRY_ATTEMPTS=5
```

## Best Practices

### Production Deployment

1. **Start Conservative**: Begin with enhanced logging only
2. **Monitor Closely**: Watch logs and metrics during initial runs
3. **Gradual Scaling**: Increase parallel workers incrementally
4. **Set Alerts**: Monitor error rates and API usage
5. **Regular Backups**: Keep multiple backup versions

### Performance Optimization

1. **Tune Workers**: Find optimal worker count for your API limits
2. **Adjust Rate Limits**: Balance speed vs. API stability
3. **Monitor Costs**: Track OpenAI token usage
4. **Schedule Wisely**: Run during off-peak hours if possible

### Monitoring

1. **Log Retention**: Rotate logs to manage disk space
2. **Metric Collection**: Export metrics to monitoring systems
3. **Alerting**: Set up alerts for failures and performance degradation
4. **Regular Reviews**: Analyze performance trends weekly