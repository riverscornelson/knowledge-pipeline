# CLI Commands Reference - v5.0.0

*Complete guide to GPT-5 pipeline commands*

## Core GPT-5 Commands

### Main Pipeline
```bash
python scripts/run_gpt5_pipeline.py [OPTIONS]
```
Runs the complete GPT-5 processing pipeline with dual-model architecture.

**Options:**
- `--limit N` - Process only N documents
- `--batch-size N` - Documents per batch (default: 10)
- `--dry-run` - Test configuration without processing
- `--content-type TYPE` - Filter by content type
- `--verbose` - Enable detailed logging

**Example:**
```bash
python scripts/run_gpt5_pipeline.py --limit 5 --batch-size 2
```

### Google Drive Processing
```bash
python scripts/run_gpt5_drive.py [OPTIONS]
```
Process Google Drive PDFs with GPT-5 analysis and GPT-4.1 tagging.

**Options:**
- `--folder-name NAME` - Specific Drive folder (default: from env)
- `--recursive` - Process subfolders
- `--status STATUS` - Process only documents with specific status
- `--reprocess-failed` - Retry failed documents

**Example:**
```bash
python scripts/run_gpt5_drive.py --folder-name "Research" --recursive
```

### Batch Optimization
```bash
python scripts/run_gpt5_batch.py [OPTIONS]
```
Optimized batch processing for cost efficiency.

**Options:**
- `--batch-size N` - Items per batch (default: 10)
- `--model MODEL` - Use specific model (gpt-5, gpt-5-mini)
- `--max-cost AMOUNT` - Stop when cost exceeds amount
- `--priority HIGH|MEDIUM|LOW` - Process by priority

**Example:**
```bash
python scripts/run_gpt5_batch.py --model gpt-5-mini --max-cost 50
```

### Live Notion Updates
```bash
python scripts/run_gpt5_notion_live.py [OPTIONS]
```
Process and update Notion pages in real-time.

**Options:**
- `--watch` - Monitor for new documents continuously
- `--interval SECONDS` - Check interval (default: 300)
- `--quality-threshold N` - Minimum quality score (default: 8.5)

### Status Check
```bash
knowledge-pipeline-gpt5-drive --status
```
Check processing status and queue.

**Output includes:**
- Documents in queue
- Processing statistics
- Recent errors
- Performance metrics

## Testing Commands

### Single Document Test
```bash
python scripts/test_single_doc_tags.py FILE_PATH
```
Test GPT-5 processing on a specific document.

### GPT-5 Processing Test
```bash
python test_gpt5_processing.py
```
Run comprehensive GPT-5 system tests.

### PDF Extraction Test
```bash
python test_pdf_extraction.py
```
Test robust PDF extraction methods.

## Validation Commands

### Schema Validation
```bash
python scripts/test_fixed_schema.py
```
Validate Notion schema compatibility.

### Block Limit Check
```bash
python scripts/validate_block_limits.py
```
Ensure mobile optimization (15-block limit).

### Quality Validation
```bash
python scripts/run_gpt5_batch_improved.py --validate-only
```
Run quality checks without processing.

## Migration Commands

### Migrate Prompts
```bash
python scripts/migrate_to_optimized_prompts.py
```
Update to GPT-5 optimized prompts.

### Reprocess Failed
```bash
python reprocess_failed_pdfs.py
```
Retry documents that failed in v4.0.

## Legacy Commands (v4.0 - Still Supported)

### Standard Pipeline
```bash
python scripts/run_pipeline.py [OPTIONS]
```
Original v4.0 pipeline (backward compatible).

**Options:**
- `--process-local` - Include local PDFs
- `--dry-run` - Test configuration
- `--verbose` - Detailed output

### Local Processing
```bash
python scripts/run_pipeline.py --process-local
```
Process PDFs from Downloads folder.

## Environment Variables

### Required for GPT-5
```bash
# Models
MODEL_SUMMARY=gpt-5
MODEL_CLASSIFIER=gpt-4.1
MODEL_INSIGHTS=gpt-5

# Quality
MIN_QUALITY_SCORE=8.5
MAX_NOTION_BLOCKS=15

# Performance
MAX_PROCESSING_TIME=20
BATCH_SIZE=10
```

### Cost Optimization
```bash
# Use GPT-5 mini for 92% performance at 25% cost
USE_GPT5_MINI=true
MODEL_SUMMARY=gpt-5-mini
```

## Command Comparison

| Task | v4.0 Command | v5.0 Command |
|------|-------------|--------------|
| Main pipeline | `run_pipeline.py` | `run_gpt5_pipeline.py` |
| Drive processing | `run_drive.py` | `run_gpt5_drive.py` |
| Batch processing | `run_batch.py` | `run_gpt5_batch.py` |
| Status check | N/A | `knowledge-pipeline-gpt5-drive --status` |
| Quality validation | N/A | `run_gpt5_batch_improved.py --validate-only` |

## Performance Notes

- **Processing Time**: ~40-50 seconds per document
- **Quality Target**: 8.5/10 minimum
- **Token Usage**: 27% reduction from v4.0
- **Cost Savings**: $23,960 annual with intelligent routing

## Troubleshooting

### Command Not Found
```bash
# Ensure proper installation
pip install -e .

# Check Python path
which python3
```

### Permission Errors
```bash
# Make scripts executable
chmod +x scripts/run_gpt5_*.py
```

### Module Import Errors
```bash
# Verify installation
python -c "from src.gpt5 import drive_processor"
```

## Scheduling with Cron

```bash
# Edit crontab
crontab -e

# Add GPT-5 pipeline (daily at 8 AM)
0 8 * * * /usr/bin/python3 /path/to/scripts/run_gpt5_pipeline.py

# Add status check (every 4 hours)
0 */4 * * * /usr/bin/python3 /path/to/scripts/run_gpt5_drive.py --status
```

## Docker Usage

```bash
# Build container
docker build -t knowledge-pipeline:v5 .

# Run GPT-5 pipeline
docker run --env-file .env knowledge-pipeline:v5 python scripts/run_gpt5_pipeline.py
```

---

For detailed usage of each command, use the `--help` flag:
```bash
python scripts/run_gpt5_pipeline.py --help
```