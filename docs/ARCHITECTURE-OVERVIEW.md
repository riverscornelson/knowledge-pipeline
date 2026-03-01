# Knowledge Pipeline — Architecture Overview

> **Purpose**: Describe the core data flow and identify simplification opportunities for multi-client consulting use.

## What It Does (One Sentence)

Scans a Google Drive folder for PDFs, enriches each document with AI-generated summaries/tags/classification, and writes structured results into a Notion database as a searchable knowledge base.

---

## Data Flow

```
┌──────────────────────┐
│  1. INGESTION        │
│                      │
│  Google Drive folder ─┼──► List files via Drive API
│  (or local ~/Downloads)   Deduplicate (SHA-256 hash or URL)
│                      │    Create Notion page (status=Inbox)
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  2. EXTRACTION       │
│                      │
│  Download PDF ────────┼──► Extract text via pdfplumber
│  from Drive API      │    (fallback: pdfminer → PyPDF2)
│                      │    Clean whitespace/artifacts
└──────────┬───────────┘
           │  raw text
           ▼
┌──────────────────────┐
│  3. ENRICHMENT       │  ← This is the core value
│                      │
│  a. Classify ─────────┼──► Content type, vendor, AI primitives
│     (GPT-4.1)        │    (structured JSON output)
│                      │
│  b. Summarize ────────┼──► Executive summary
│     (GPT-5)          │    (content-type-aware prompts)
│                      │
│  c. Extract Insights ─┼──► 3-5 strategic insights
│     (GPT-5)          │
│                      │
│  d. Tag ──────────────┼──► Topical tags, domain tags
│     (GPT-4.1)        │    (reads existing Notion tags for consistency)
│                      │
│  e. Quality Gate ─────┼──► Score ≥ 8.5/10 → pass
│                      │    Score < 8.5/10 → mark Failed
└──────────┬───────────┘
           │  EnrichmentResult
           ▼
┌──────────────────────┐
│  4. FORMAT           │
│                      │
│  Convert to Notion ───┼──► Callout (quality score)
│  block JSON          │    Headings + bullet lists
│                      │    Toggle blocks (insights)
│                      │    Source link
│                      │    Max 15 blocks (mobile-optimized)
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  5. WRITE TO NOTION  │
│                      │
│  Update page ─────────┼──► Set properties (type, vendor, tags, score)
│                      │    Append content blocks
│                      │    Set status → Enriched
└──────────────────────┘
```

---

## Key Components

| Module | Path | Role |
|--------|------|------|
| **Config** | `src/core/config.py` | Loads all settings from env vars |
| **Models** | `src/core/models.py` | `SourceContent`, `EnrichmentResult` dataclasses |
| **Notion Client** | `src/core/notion_client.py` | CRUD wrapper around Notion API |
| **Drive Ingester** | `src/drive/ingester.py` | Scans Drive folder, deduplicates, creates Inbox pages |
| **PDF Processor** | `src/drive/pdf_processor.py` | Downloads + extracts text from PDFs |
| **Pipeline Processor** | `src/enrichment/pipeline_processor.py` | Orchestrates enrichment (standard path) |
| **GPT5 Drive Processor** | `src/gpt5/drive_processor.py` | Orchestrates enrichment (GPT-5 path) |
| **Classifier** | `src/enrichment/advanced_classifier.py` | Content type + vendor + AI primitive classification |
| **Summarizer** | `src/enrichment/enhanced_summarizer.py` | Executive summary generation |
| **Insights Generator** | `src/enrichment/enhanced_insights.py` | Strategic insight extraction |
| **Content Tagger** | `src/enrichment/content_tagger.py` | Topical and domain tag generation |
| **Formatters** | `src/formatters/` | Convert enrichment results → Notion blocks |
| **Local Uploader** | `src/local_uploader/` | Scan local PDFs, upload to Drive |

---

## External Dependencies (3 APIs)

| Service | Auth Method | Purpose |
|---------|-------------|---------|
| **Google Drive** | Service account JSON | PDF source (read + upload) |
| **OpenAI** | API key | AI analysis (GPT-5 + GPT-4.1) |
| **Notion** | Integration token | Knowledge base storage |

---

## Two Processing Paths (Current State)

The codebase has two largely parallel implementations of the same pipeline:

### Path A: Standard (`PipelineProcessor`)
- Entry: `scripts/run_pipeline.py`
- Ingestion and enrichment are separate phases
- Uses `BaseAnalyzer` subclasses with YAML/Notion prompt configs
- Formatter: `NotionFormatter` or `EnhancedAttributionFormatter`

### Path B: GPT-5 (`GPT5DriveProcessor`)
- Entry: `scripts/run_gpt5_drive.py`
- Ingestion, extraction, enrichment, and formatting in one class (~600 lines)
- Hardcodes model names (`gpt-5`, `gpt-4.1`)
- Formatter: `GPT5SimpleFormatter` or `PromptAwareNotionFormatter`
- Adds GPT-4.1 structured tagging with 1M context window

**Both paths do the same thing**: classify → summarize → extract insights → tag → format → write to Notion.

---

## Configuration

All configuration is environment-variable driven. Key settings:

```bash
# Required
OPENAI_API_KEY=...
NOTION_TOKEN=...
NOTION_SOURCES_DB=...
GOOGLE_APP_CREDENTIALS=path/to/service-account.json
DRIVE_FOLDER_NAME=Knowledge-Base

# Model selection
MODEL_SUMMARY=gpt-5          # or gpt-4.1
MODEL_CLASSIFIER=gpt-4.1     # structured tagging
MODEL_INSIGHTS=gpt-5

# Processing
BATCH_SIZE=10
RATE_LIMIT_DELAY=0.3
MIN_QUALITY_SCORE=8.5
MAX_NOTION_BLOCKS=15

# Optional
NOTION_PROMPTS_DB_ID=...     # Dynamic prompts from Notion
LOCAL_UPLOADER_ENABLED=true
```

Prompt templates live in `config/prompts.yaml` (or a Notion database if `NOTION_PROMPTS_DB_ID` is set).

---

## Codebase Stats

- **64 Python source files** across `src/`
- **~23,000 lines** total
- **83 test scenarios** in `tests/`

---

## Simplification Opportunities

These are the areas where the codebase can be streamlined for consulting org use:

### 1. Merge the two processing paths
`PipelineProcessor` and `GPT5DriveProcessor` implement the same pipeline differently. Consolidating into a single processor with configurable model selection would eliminate ~1,500 lines of duplication and one entire entry point.

### 2. Consolidate formatters
There are 6 formatter classes (`NotionFormatter`, `GPT5SimpleFormatter`, `PromptAwareNotionFormatter`, `EnhancedAttributionFormatter`, `OptimizedNotionFormatter`, `FormatterIntegration`). These are evolutionary layers. A single formatter with options for attribution tracking and block limits would cover all cases.

### 3. Remove hardcoded domain assumptions
Prompts reference "a Generative AI consultant's knowledge base" and classification taxonomies (AI primitives, vendor lists) are AI/ML-specific. Making the domain context and taxonomy configurable would allow the pipeline to serve clients in any industry.

### 4. Add client/project scoping
Currently single-tenant: one Notion DB, one Drive folder, one config. Supporting multiple clients could be as simple as named config profiles (e.g., `CLIENT=acme python scripts/run_pipeline.py`) that swap env var sets.

### 5. Extract model names from code
`GPT5DriveProcessor` hardcodes `"gpt-5"` and `"gpt-4.1"` in API calls, bypassing the config system. Routing all model selection through `OpenAIConfig` would make model upgrades a one-line env change.

### 6. Slim the enrichment module
`src/enrichment/` has 13 files. Several are unused or redundant:
- `prompt_aware_pipeline.py` and `prompt_aware_enrichment.py` overlap with `pipeline_processor.py`
- `quality_validator.py` is superseded by `enhanced_quality_validator.py`
- `technical_analyzer.py` appears unused in the main flow

### 7. Clean up root directory
Root contains files that belong elsewhere: `validate_production_readiness.py`, `check_final_status.py`, `reprocess_failed_pdfs.py`, `test_gpt5_processing.py`, `test_pdf_extraction.py`. These should move to `scripts/` or `tests/`.
