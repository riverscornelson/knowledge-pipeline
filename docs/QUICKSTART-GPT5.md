# GPT-5 Quick Start Guide

*Get started with GPT-5 processing in 5 minutes*

## Prerequisites

✅ Python 3.8+
✅ OpenAI API key with GPT-5 access
✅ Notion integration token
✅ Google Drive service account (optional)

## 1. Install Pipeline

```bash
# Clone repository
git clone https://github.com/riverscornelson/knowledge-pipeline.git
cd knowledge-pipeline

# Install dependencies
pip install -e .
```

## 2. Configure Environment

Create `.env` file:

```bash
# Essential Configuration
OPENAI_API_KEY=sk-...
NOTION_TOKEN=secret_...
NOTION_SOURCES_DB=your_database_id

# GPT-5 Models
MODEL_SUMMARY=gpt-5
MODEL_CLASSIFIER=gpt-4.1
MIN_QUALITY_SCORE=8.5
```

## 3. Run Your First Processing

```bash
# Test with 3 documents
python scripts/run_gpt5_pipeline.py --limit 3

# Expected output:
# 🚀 Starting GPT-5 Pipeline v5.0.0
# 📊 Found 3 documents to process
# ⚙️ Processing document 1/3...
# ✅ Quality: 9.2/10 (40.5 seconds)
```

## 4. Verify Results

Check your Notion database for:
- ✅ Enriched status
- ⭐ Quality score (>8.5)
- 📱 Mobile-optimized blocks (≤15)
- 🔗 Drive links (not raw content)

## Common Configurations

### Cost-Optimized Setup
```bash
# 92% performance at 25% cost
MODEL_SUMMARY=gpt-5-mini
MAX_PROCESSING_TIME=30
```

### High-Quality Setup
```bash
# Maximum quality
MODEL_SUMMARY=gpt-5
MIN_QUALITY_SCORE=9.0
MAX_NOTION_BLOCKS=20
```

### Development Setup
```bash
# Fast iteration
MODEL_SUMMARY=gpt-5-mini
BATCH_SIZE=2
--dry-run flag
```

## Processing Workflows

### Daily Research Papers
```bash
# Morning routine
python scripts/run_gpt5_drive.py \
  --folder-name "Daily Research" \
  --content-type "Research Paper"
```

### Executive Briefings
```bash
# Mobile-optimized for executives
python scripts/run_gpt5_pipeline.py \
  --content-type "Market Intelligence" \
  --max-blocks 10
```

### Batch Processing
```bash
# Cost-efficient bulk processing
python scripts/run_gpt5_batch.py \
  --model gpt-5-mini \
  --batch-size 20
```

## Performance Expectations

| Documents | Time | Cost | Quality |
|-----------|------|------|---------|
| 1 | ~45s | $0.15 | 9.2/10 |
| 10 | ~7-8 min | $1.50 | 9.2/10 |
| 100 | ~75 min | $15 | 9.2/10 |

**Note**: Using `gpt-5-mini` reduces cost by 75% with minimal quality impact.

## Quick Troubleshooting

### "No documents found"
```bash
# Check Notion connection
curl -H "Authorization: Bearer $NOTION_TOKEN" \
     https://api.notion.com/v1/databases/$NOTION_SOURCES_DB
```

### "Quality below threshold"
- Normal: GPT-5 has stricter standards (8.5 vs 6.0)
- Documents scoring 7-8 may need manual review

### "Processing timeout"
- Expected: GPT-5 takes 40-50s for deep analysis
- Use `gpt-5-mini` for faster processing

## Next Steps

1. **Schedule Automation**
   ```bash
   # Add to crontab
   0 8 * * * python /path/to/run_gpt5_pipeline.py
   ```

2. **Monitor Performance**
   ```bash
   knowledge-pipeline-gpt5-drive --status
   ```

3. **Customize Prompts**
   - Edit `config/prompts-gpt5-optimized.yaml`
   - Or manage via Notion prompts database

## Getting Help

- 📚 [Full Documentation](README.md)
- 🔄 [Migration from v4](MIGRATION-v5.0.0.md)
- 🛠️ [Troubleshooting](docs/operations/troubleshooting.md)
- 💬 [GitHub Issues](https://github.com/riverscornelson/knowledge-pipeline/issues)

---

**Pro Tip**: Start with `gpt-5-mini` to validate your setup, then upgrade to full `gpt-5` for production.