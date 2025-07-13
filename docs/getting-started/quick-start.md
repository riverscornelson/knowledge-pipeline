# Knowledge Pipeline - Quick Start Guide

## 🚀 5-Minute Setup

### 1. Install Dependencies
```bash
pip install -e .
```

### 2. Configure Credentials
```bash
cp .env.example .env
# Edit .env with your credentials:
# - Notion token & database ID
# - OpenAI API key
# - Google Drive service account JSON path
# - (Optional) Gmail OAuth credentials
# - (Optional) Firecrawl API key
```

### 3. Run the Pipeline
```bash
# Full pipeline (all sources + AI enrichment)
python scripts/run_pipeline.py

# Drive only (highest priority)
python scripts/run_pipeline.py --source drive

# Test mode (no changes)
python scripts/run_pipeline.py --dry-run
```

## 📊 Monitor Progress

```bash
# Watch logs in real-time
tail -f logs/pipeline.jsonl | jq .

# Check Notion database
# Status="Inbox" → Being processed
# Status="Enriched" → Complete
```

## 🎯 What It Does

1. **Ingests** content from Google Drive, Gmail, and websites
2. **Deduplicates** using content hashing
3. **Enriches** with AI-powered analysis:
   - Executive summaries
   - Content classification
   - Key insights extraction
4. **Stores** in your Notion database with rich formatting

## 🔧 Common Commands

```bash
# Process only new content (default)
python scripts/run_pipeline.py

# Skip AI enrichment (faster)
python scripts/run_pipeline.py --skip-enrichment

# Process specific source
python scripts/run_pipeline.py --source gmail
python scripts/run_pipeline.py --source firecrawl
```

## 📚 Need Help?

- **Full Documentation**: See [docs navigation](../README.md)
- **Architecture**: See [Architecture Overview](../reference/architecture.md)
- **Configuration**: See `.env.example` in project root

---

Ready to transform your content into intelligence? Run the pipeline and watch your knowledge base grow!