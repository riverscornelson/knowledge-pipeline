# Enhanced Pipeline Deployment Guide

## Overview

This guide covers the deployment of the integrated prompt-aware pipeline with full attribution, executive dashboards, and user feedback collection.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Integration Manager                          │
├─────────────────┬───────────────────┬───────────────────────────┤
│  Legacy Pipeline│  Enhanced Pipeline│     Support Systems       │
│                 │                   │                           │
│  • Original     │  • Prompt-aware   │  • Attribution Tracker   │
│    processing   │  • Executive      │  • Feedback Collector    │
│  • Standard     │    dashboards     │  • Migration Manager     │
│    output       │  • Rich formatting│  • Performance Monitor   │
│                 │  • Web citations  │                           │
└─────────────────┴───────────────────┴───────────────────────────┘
```

## System Components

### 1. Prompt-Aware Pipeline (`prompt_aware_pipeline.py`)
- Processes documents with full prompt attribution
- Tracks which prompts were used for each analysis
- Records quality scores and performance metrics
- Integrates with executive dashboard generation

### 2. Attribution Tracker (`prompt_attribution_tracker.py`)
- Stores prompt usage and performance data
- Generates recommendations for prompt improvements
- Provides historical analysis of prompt effectiveness

### 3. Executive Dashboard Generator (`executive_dashboard_generator.py`)
- Creates high-level executive summaries
- Formats content based on document type
- Provides actionable insights and metrics

### 4. Enhanced Notion Formatter (`notion_formatter_enhanced.py`)
- Rich formatting with attribution information
- Quality indicators and prompt performance data
- Interactive feedback collection elements

### 5. Migration Manager (`migration_manager.py`)
- Handles gradual rollout of new features
- Provides side-by-side comparison capabilities
- Manages rollback procedures

### 6. Feedback Collector (`feedback_collector.py`)
- Collects user ratings and comments
- Updates prompt quality scores based on feedback
- Generates improvement recommendations

## Deployment Steps

### Phase 1: Configuration Setup

1. **Environment Variables**

Create a `.env` file with the following configuration:

```env
# Feature Flags
ENABLE_PROMPT_ATTRIBUTION=true
ENABLE_EXECUTIVE_DASHBOARD=true
ENABLE_FEEDBACK_COLLECTION=true
ENABLE_PERFORMANCE_MONITORING=true
ENABLE_WEB_SEARCH=true
ENABLE_QUALITY_VALIDATION=true

# Rollout Configuration
ROLLOUT_MODE=gradual  # Options: full, gradual, ab_test
ROLLOUT_PERCENTAGE=25  # Start with 25% rollout
AB_TEST_ENABLED=false
AB_TEST_CONTROL_GROUP=0.5

# Performance Thresholds
QUALITY_THRESHOLD=0.7
PROCESSING_TIME_THRESHOLD=30.0

# Migration Settings
MIGRATION_BATCH_SIZE=50
MIGRATION_DELAY_SECONDS=1.0

# Notion Configuration
NOTION_PROMPTS_DB_ID=your_prompts_database_id
USE_ENHANCED_FORMATTING=true
```

2. **Validate Configuration**

```python
from src.core.integration_config import IntegrationConfig

config = IntegrationConfig()
validation = config.validate_configuration()

if not validation["valid"]:
    print("Configuration issues:", validation["issues"])
```

### Phase 2: Gradual Rollout (Recommended)

1. **Start with 25% Traffic**

```python
from src.integration_manager import IntegrationManager
from src.core.config import PipelineConfig

# Initialize
pipeline_config = PipelineConfig()
manager = IntegrationManager(pipeline_config)

# Process batch with gradual rollout
result = manager.process_batch(limit=100)
print(f"Processed: {result['processed']}, Enhanced: {result['enhanced_used']}")
```

2. **Monitor Performance**

```python
# Generate performance report
report = manager.generate_performance_report()

# Check system health
status = manager.get_system_status()

if status["system_health"] != "healthy":
    print("System issues detected:", status["configuration_issues"])
```

3. **Increase Rollout Gradually**

```python
# Increase to 50%
manager.update_feature_flags({
    "ROLLOUT_PERCENTAGE": 50
})

# Monitor for 24-48 hours, then increase to 75%, then 100%
```

### Phase 3: Full Deployment

1. **Enable All Features**

```python
manager.update_feature_flags({
    "ROLLOUT_MODE": "full",
    "ROLLOUT_PERCENTAGE": 100
})
```

2. **Run Migration for Existing Documents**

```python
def progress_callback(progress):
    print(f"Migration progress: {progress['percentage']:.1f}% "
          f"({progress['current']}/{progress['total']})")

migration_result = manager.migrate_to_enhanced_pipeline(
    batch_size=100,
    progress_callback=progress_callback
)

print(f"Migration complete: {migration_result}")
```

### Phase 4: A/B Testing (Optional)

For more rigorous testing, enable A/B testing:

```python
manager.update_feature_flags({
    "ROLLOUT_MODE": "ab_test",
    "AB_TEST_ENABLED": True,
    "AB_TEST_CONTROL_GROUP": 0.5  # 50% control, 50% treatment
})

# Run for sufficient time to collect data
comparison_study = manager.run_comparison_study(sample_size=200)
print(f"A/B test results: {comparison_study}")
```

## Configuration Management

### Feature Flags

Control system behavior through environment variables:

- `ENABLE_PROMPT_ATTRIBUTION`: Enable prompt tracking
- `ENABLE_EXECUTIVE_DASHBOARD`: Enable executive summaries
- `ENABLE_FEEDBACK_COLLECTION`: Enable user feedback
- `ENABLE_PERFORMANCE_MONITORING`: Enable metrics collection
- `ENABLE_WEB_SEARCH`: Enable web search enhancement
- `ENABLE_QUALITY_VALIDATION`: Enable quality checks

### Rollout Modes

1. **Full**: All documents use enhanced pipeline
2. **Gradual**: Percentage-based rollout
3. **A/B Test**: Scientific comparison between pipelines

### Performance Thresholds

Set quality and performance standards:

```env
QUALITY_THRESHOLD=0.7      # Minimum acceptable quality score
PROCESSING_TIME_THRESHOLD=30.0  # Maximum processing time (seconds)
```

## Monitoring and Alerting

### Performance Metrics

Monitor these key metrics:

1. **Processing Time**: Average time per document
2. **Quality Scores**: User-rated quality of AI analyses
3. **Error Rate**: Percentage of failed processing attempts
4. **Pipeline Distribution**: Legacy vs Enhanced usage
5. **User Feedback**: Ratings and comments on AI output

### Health Checks

```python
# System status check
status = manager.get_system_status()

# Performance report
report = manager.generate_performance_report()

# Attribution analysis
attribution_report = manager.attribution_tracker.get_performance_report()
```

### Alerts

Set up alerts for:

- Error rate > 5%
- Average processing time > 30 seconds
- Quality score < 0.7
- System health = "degraded"

## Rollback Procedures

### Emergency Rollback

If issues are detected:

```python
# Immediate rollback to legacy pipeline
manager.update_feature_flags({
    "ROLLOUT_MODE": "full",
    "ROLLOUT_PERCENTAGE": 0  # Use legacy for all documents
})

# Or rollback migrated documents
rollback_result = manager.rollback_migration(limit=1000)
print(f"Rollback complete: {rollback_result}")
```

### Gradual Rollback

For less urgent issues:

```python
# Reduce rollout percentage
manager.update_feature_flags({
    "ROLLOUT_PERCENTAGE": 50  # Reduce from 100% to 50%
})

# Monitor and continue reducing if needed
```

## Performance Optimization

### Batch Processing

Optimize for throughput:

```python
# Process larger batches
result = manager.process_batch(limit=200)

# Adjust rate limiting
manager.pipeline_config.rate_limit_delay = 0.5  # Reduce delay
```

### Caching

Enable prompt caching for better performance:

```env
# Use cached prompts when possible
CACHE_PROMPTS=true
CACHE_DURATION_MINUTES=10
```

### Parallel Processing

For high-volume deployments, consider:

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

async def process_documents_parallel(document_ids, max_workers=5):
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        loop = asyncio.get_event_loop()
        tasks = [
            loop.run_in_executor(executor, manager.process_document, doc_id)
            for doc_id in document_ids
        ]
        return await asyncio.gather(*tasks)
```

## Troubleshooting

### Common Issues

1. **High Error Rate**
   - Check API credentials and rate limits
   - Validate Notion database schema
   - Review error logs for patterns

2. **Slow Processing**
   - Monitor API response times
   - Check web search timeout settings
   - Review prompt complexity

3. **Poor Quality Scores**
   - Analyze user feedback patterns
   - Review prompt configurations
   - Check content type classification

### Debug Mode

Enable verbose logging:

```python
import logging
logging.getLogger('src').setLevel(logging.DEBUG)
```

### Performance Analysis

```python
# Detailed performance breakdown
report = manager.generate_performance_report()

print("Quality Analysis:")
print(f"Legacy avg: {report['performance_analysis']['legacy_avg_quality']:.2f}")
print(f"Enhanced avg: {report['performance_analysis']['enhanced_avg_quality']:.2f}")
print(f"Improvement: {report['performance_analysis']['quality_improvement']:.2f}")
```

## Security Considerations

### API Keys

- Store all API keys in environment variables
- Use secure credential management systems
- Rotate keys regularly

### Data Privacy

- Ensure compliance with data protection regulations
- Implement proper access controls
- Log access and modifications

### Monitoring

- Monitor for unusual API usage patterns
- Set up alerts for suspicious activity
- Regularly audit system access

## Backup and Recovery

### Data Backup

```python
# Export feedback data
feedback_data = manager.feedback_collector.export_feedback_data()
with open('feedback_backup.json', 'w') as f:
    f.write(feedback_data)

# Export attribution data (implement as needed)
attribution_data = manager.attribution_tracker.get_performance_report()
```

### Recovery Procedures

```python
# Restore feedback data
with open('feedback_backup.json', 'r') as f:
    backup_data = f.read()
    manager.feedback_collector.import_feedback_data(backup_data)
```

## Support and Maintenance

### Regular Tasks

1. **Weekly**: Review performance reports and user feedback
2. **Monthly**: Analyze prompt performance and optimize
3. **Quarterly**: Full system health assessment and updates

### Updates and Patches

1. Test changes in staging environment
2. Deploy with gradual rollout
3. Monitor performance and rollback if needed
4. Update documentation and training materials

### User Training

Provide training on:
- New executive dashboard features
- How to provide feedback on AI analyses
- Understanding prompt attribution information
- Quality indicators and their meanings

## Success Metrics

Track these KPIs:

1. **User Adoption**: Percentage using enhanced features
2. **Quality Improvement**: Increase in quality scores
3. **Time Savings**: Reduction in manual review time
4. **User Satisfaction**: Feedback ratings and comments
5. **Error Reduction**: Decrease in processing failures

Target improvements:
- 15% increase in quality scores
- 25% reduction in manual review time
- 90%+ user satisfaction rating
- <2% error rate