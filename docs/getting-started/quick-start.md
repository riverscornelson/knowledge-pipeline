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
```

### 3. Run the Pipeline
```bash
# Full pipeline (Google Drive + AI enrichment)
python scripts/run_pipeline.py

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

1. **Uploads** (optional) local PDFs from Downloads to Google Drive
2. **Ingests** content from Google Drive PDFs
3. **Deduplicates** using content hashing
4. **Enriches** with AI-powered analysis:
   - Executive summaries
   - Content classification
   - Key insights extraction
5. **Stores** in your Notion database with rich formatting

## 🔧 Common Commands

```bash
# Process only new content (default)
python scripts/run_pipeline.py

# Full pipeline with local PDF upload
python scripts/run_pipeline.py --process-local

# Process only local files (no enrichment)
python scripts/run_pipeline.py --process-local --skip-enrichment

# Skip AI enrichment (faster)
python scripts/run_pipeline.py --skip-enrichment

# Dry run to see what would be uploaded
python scripts/run_pipeline.py --process-local --dry-run
```

## 📚 Need Help?

- **Full Documentation**: See [docs navigation](../README.md)
- **Architecture**: See [Architecture Overview](../reference/architecture.md)
- **Configuration**: See `.env.example` in project root

---

Ready to transform your content into intelligence? Run the pipeline and watch your knowledge base grow!