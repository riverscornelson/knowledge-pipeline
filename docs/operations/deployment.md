# Knowledge Pipeline v2.0 - Deployment Guide

This guide covers deployment options for the Knowledge Pipeline in various environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Production Deployment](#production-deployment)
  - [Linux Server with Cron](#linux-server-with-cron)
  - [Docker Container](#docker-container)
  - [Cloud Functions](#cloud-functions)
- [Configuration Management](#configuration-management)
- [Monitoring & Logging](#monitoring--logging)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements
- Python 3.8 or higher (3.11+ recommended for performance)
- 2GB RAM minimum (4GB recommended)
- 10GB free disk space
- Internet connectivity for API access

### Required Accounts & Credentials
1. **Notion Integration**
   - Notion account with API access
   - Database created with required schema (see CLAUDE.md)
   - Integration token from https://www.notion.so/my-integrations

2. **Google Cloud Platform**
   - Service account with Drive API access
   - Download service account JSON key file

3. **OpenAI API**
   - API key from https://platform.openai.com

4. **Optional: Secondary Sources**
   - Gmail OAuth2 credentials (for email capture)
   - Firecrawl API key (for web scraping)

## Local Development Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/knowledge-pipeline.git
cd knowledge-pipeline
```

### 2. Create Virtual Environment
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Package
```bash
# Install in development mode
pip install -e .

# Or install dependencies only
pip install -r requirements.txt
```

### 4. Configure Environment
```bash
# Copy example configuration
cp .env.example .env

# Edit .env with your credentials
nano .env
```

Required `.env` variables:
```bash
# Core Configuration
NOTION_TOKEN=secret_your_notion_token
NOTION_SOURCES_DB=your_database_id
OPENAI_API_KEY=sk-your-openai-key
GOOGLE_APP_CREDENTIALS=/path/to/service-account.json

# Processing Configuration
BATCH_SIZE=10
RATE_LIMIT_DELAY=0.3

# Optional Secondary Sources
GMAIL_CREDENTIALS_PATH=gmail_credentials/credentials.json
GMAIL_TOKEN_PATH=gmail_credentials/token.json
FIRECRAWL_API_KEY=fc-your-api-key
```

### 5. Test Installation
```bash
# Dry run to verify setup
python scripts/run_pipeline.py --dry-run

# Process only Drive content
python scripts/run_pipeline.py --source drive
```

## Production Deployment

### Linux Server with Cron

#### 1. Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python 3.11
sudo apt install python3.11 python3.11-venv python3.11-dev

# Create application user
sudo useradd -m -s /bin/bash pipeline
sudo su - pipeline
```

#### 2. Application Installation
```bash
# Clone repository
git clone https://github.com/your-org/knowledge-pipeline.git ~/knowledge-pipeline
cd ~/knowledge-pipeline

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install package
pip install -e .
```

#### 3. Systemd Service (Optional)
Create `/etc/systemd/system/knowledge-pipeline.service`:
```ini
[Unit]
Description=Knowledge Pipeline
After=network.target

[Service]
Type=oneshot
User=pipeline
WorkingDirectory=/home/pipeline/knowledge-pipeline
Environment="PATH=/home/pipeline/knowledge-pipeline/venv/bin"
ExecStart=/home/pipeline/knowledge-pipeline/venv/bin/python /home/pipeline/knowledge-pipeline/scripts/run_pipeline.py
StandardOutput=append:/home/pipeline/knowledge-pipeline/logs/systemd.log
StandardError=append:/home/pipeline/knowledge-pipeline/logs/systemd-error.log

[Install]
WantedBy=multi-user.target
```

Enable service:
```bash
sudo systemctl enable knowledge-pipeline
sudo systemctl start knowledge-pipeline
```

#### 4. Cron Schedule
Add to crontab (`crontab -e`):
```bash
# Run every 4 hours
0 */4 * * * cd /home/pipeline/knowledge-pipeline && /home/pipeline/knowledge-pipeline/venv/bin/python scripts/run_pipeline.py >> logs/cron.log 2>&1

# Daily enrichment run at 2 AM
0 2 * * * cd /home/pipeline/knowledge-pipeline && /home/pipeline/knowledge-pipeline/venv/bin/python scripts/run_pipeline.py --source drive >> logs/cron.log 2>&1

# Weekly secondary sources at Sunday 3 AM
0 3 * * 0 cd /home/pipeline/knowledge-pipeline && /home/pipeline/knowledge-pipeline/venv/bin/python scripts/run_pipeline.py --source gmail,firecrawl >> logs/cron.log 2>&1
```

### Docker Container

#### 1. Create Dockerfile
```dockerfile
FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN useradd -m -u 1000 pipeline

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .
RUN pip install -e .

# Create logs directory
RUN mkdir -p logs && chown pipeline:pipeline logs

# Switch to non-root user
USER pipeline

# Default command
CMD ["python", "scripts/run_pipeline.py"]
```

#### 2. Build and Run
```bash
# Build image
docker build -t knowledge-pipeline:latest .

# Run with environment file
docker run --rm \
  --env-file .env \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/gmail_credentials:/app/gmail_credentials \
  -v /path/to/service-account.json:/app/service-account.json \
  knowledge-pipeline:latest
```

#### 3. Docker Compose
Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  pipeline:
    build: .
    env_file: .env
    volumes:
      - ./logs:/app/logs
      - ./gmail_credentials:/app/gmail_credentials
      - /path/to/service-account.json:/app/service-account.json
    environment:
      - GOOGLE_APP_CREDENTIALS=/app/service-account.json
    restart: unless-stopped
```

### Cloud Functions

#### AWS Lambda

1. **Package Dependencies**
```bash
# Create deployment package
pip install -r requirements.txt -t package/
cp -r src scripts package/
cd package && zip -r ../deployment.zip .
```

2. **Lambda Handler**
Create `lambda_handler.py`:
```python
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.core.config import PipelineConfig
from src.core.notion_client import NotionClient
from src.drive.ingester import DriveIngester
from src.enrichment.processor import EnrichmentProcessor

def handler(event, context):
    """AWS Lambda handler function"""
    # Load configuration
    config = PipelineConfig.from_env()
    notion_client = NotionClient(config.notion)
    
    # Process based on event
    source = event.get('source', 'all')
    
    if source in ['all', 'drive']:
        ingester = DriveIngester(config, notion_client)
        ingest_stats = ingester.ingest()
    
    # Run enrichment
    processor = EnrichmentProcessor(config, notion_client)
    enrich_stats = processor.process_batch()
    
    return {
        'statusCode': 200,
        'body': {
            'ingest_stats': ingest_stats,
            'enrich_stats': enrich_stats
        }
    }
```

3. **Deploy to Lambda**
- Runtime: Python 3.11
- Memory: 1024 MB
- Timeout: 15 minutes
- Environment variables: Set all from .env

#### Google Cloud Functions

1. **Create `main.py`**
```python
import functions_framework
from src.core.config import PipelineConfig
from src.core.notion_client import NotionClient
from src.drive.ingester import DriveIngester

@functions_framework.http
def run_pipeline(request):
    """Google Cloud Function entry point"""
    config = PipelineConfig.from_env()
    notion_client = NotionClient(config.notion)
    
    # Run ingestion
    ingester = DriveIngester(config, notion_client)
    stats = ingester.ingest()
    
    return {'stats': stats}
```

2. **Deploy**
```bash
gcloud functions deploy knowledge-pipeline \
  --runtime python311 \
  --trigger-http \
  --allow-unauthenticated \
  --memory 1024MB \
  --timeout 900s \
  --env-vars-file .env.yaml
```

## Configuration Management

### Environment Variables

#### Development
Use `.env` file with python-dotenv:
```bash
# .env
NOTION_TOKEN=secret_dev_token
OPENAI_API_KEY=sk-dev-key
```

#### Production
Options for secure configuration:

1. **Environment Variables**
```bash
export NOTION_TOKEN="secret_prod_token"
export OPENAI_API_KEY="sk-prod-key"
```

2. **Secrets Manager (AWS)**
```python
import boto3
import json

def load_secrets():
    client = boto3.client('secretsmanager')
    response = client.get_secret_value(SecretId='knowledge-pipeline/prod')
    return json.loads(response['SecretString'])
```

3. **HashiCorp Vault**
```bash
# Store secrets
vault kv put secret/knowledge-pipeline \
  notion_token="..." \
  openai_api_key="..."

# Retrieve in application
vault kv get -format=json secret/knowledge-pipeline
```

### Service Account Management

#### Google Drive Service Account
1. Create service account in GCP Console
2. Enable Drive API
3. Download JSON key file
4. Store securely:
   - Development: Local file path
   - Production: Encrypted storage or secrets manager

#### Security Best Practices
- Never commit credentials to git
- Use least privilege access
- Rotate keys regularly
- Monitor API usage

## Monitoring & Logging

### Log Management

#### Log Rotation
Add to `/etc/logrotate.d/knowledge-pipeline`:
```
/home/pipeline/knowledge-pipeline/logs/*.jsonl {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 pipeline pipeline
}
```

#### Log Analysis
```bash
# View recent logs
tail -f logs/pipeline.jsonl | jq .

# Filter errors
cat logs/pipeline.jsonl | jq 'select(.level == "ERROR")'

# Performance metrics
cat logs/pipeline.jsonl | jq 'select(.message | contains("complete"))'
```

### Monitoring Setup

#### Log Monitoring
Monitor pipeline execution through structured logs:

```bash
# Check if pipeline ran recently
tail -n 100 logs/pipeline.jsonl | jq -r '.timestamp' | tail -1

# Count errors in last run
cat logs/pipeline.jsonl | jq 'select(.level == "ERROR")' | wc -l

# View performance metrics
cat logs/pipeline.jsonl | jq 'select(.performance_ms != null) | {operation: .msg, time: .performance_ms}'
```

#### Monitoring Integration
```bash
# Simple health check via log monitoring
# Check if pipeline has run in last 6 hours
if [ -f logs/pipeline.jsonl ]; then
    LAST_RUN=$(tail -n 1 logs/pipeline.jsonl | jq -r '.timestamp')
    # Compare with current time
fi

# CloudWatch custom metric (AWS)
aws cloudwatch put-metric-data \
  --namespace "KnowledgePipeline" \
  --metric-name "PipelineHealth" \
  --value 1
```

### Alerting

#### Email Alerts
Add to cron job:
```bash
0 */4 * * * cd /home/pipeline/knowledge-pipeline && \
  /home/pipeline/knowledge-pipeline/venv/bin/python scripts/run_pipeline.py || \
  echo "Pipeline failed at $(date)" | mail -s "Knowledge Pipeline Alert" admin@example.com
```

#### Slack Notifications
```python
import requests

def send_slack_alert(message):
    webhook_url = os.getenv('SLACK_WEBHOOK_URL')
    requests.post(webhook_url, json={'text': message})
```

## Troubleshooting

### Common Deployment Issues

#### 1. Permission Errors
```bash
# Fix log directory permissions
sudo chown -R pipeline:pipeline logs/

# Fix service account file permissions
chmod 600 /path/to/service-account.json
```

#### 2. Memory Issues
```bash
# Increase system limits
echo "pipeline soft memlock unlimited" >> /etc/security/limits.conf
echo "pipeline hard memlock unlimited" >> /etc/security/limits.conf

# For Docker
docker run --memory="4g" --memory-swap="4g" knowledge-pipeline
```

#### 3. API Rate Limits
Adjust in `.env`:
```bash
RATE_LIMIT_DELAY=1.0  # Increase delay between calls
BATCH_SIZE=5  # Reduce batch size
```

#### 4. SSL Certificate Issues
```bash
# Update certificates
sudo apt-get update && sudo apt-get install ca-certificates

# For Python
pip install --upgrade certifi
```

### Performance Optimization

#### 1. Database Indexes
Ensure Notion database has proper views and filters set up.

#### 2. Concurrent Processing
The pipeline supports environment variables for tuning:
```bash
BATCH_SIZE=20  # Process more items per batch
MAX_WORKERS=4  # For parallel operations (if implemented)
```

#### 3. Resource Monitoring
```bash
# Monitor resource usage
htop
iotop
```

### Backup & Recovery

#### 1. Configuration Backup
```bash
# Backup credentials and config
tar -czf config-backup-$(date +%Y%m%d).tar.gz \
  .env \
  gmail_credentials/ \
  /path/to/service-account.json
```

#### 2. Log Backup
```bash
# Archive old logs
tar -czf logs-$(date +%Y%m%d).tar.gz logs/
aws s3 cp logs-*.tar.gz s3://backups/knowledge-pipeline/
```

## Security Considerations

1. **Network Security**
   - Use HTTPS for all API calls
   - Restrict outbound traffic to required endpoints
   - Use VPN for sensitive deployments

2. **Access Control**
   - Implement least privilege for service accounts
   - Regularly rotate API keys
   - Monitor API usage for anomalies

3. **Data Protection**
   - Encrypt credentials at rest
   - Use secure communication channels
   - Implement audit logging

## Next Steps

1. Set up monitoring dashboards
2. Implement automated testing in CI/CD
3. Create disaster recovery procedures
4. Document scaling strategies

For additional help, see the [Troubleshooting Guide](troubleshooting.md).