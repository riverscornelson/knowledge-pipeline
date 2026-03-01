# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Knowledge pipeline for Cornelson Advisory: Google Drive PDFs → OpenAI enrichment (with Notion tool-use) → Notion pages. ~800 lines across 8 source files. Python 3.10+.

## Commands

```bash
# Install (editable)
pip install -e .

# Run pipeline
python -m src.run

# Run Gmail ingest (fetches labeled emails → Drive → pipeline)
python -m src.ingest

# Run unit tests
python -m pytest tests/ -k "not real_"

# Run a single test
python -m pytest tests/test_pipeline.py::test_enrich_parses_response -v

# Run integration tests (requires .env with real credentials)
python -m pytest tests/ -k "real_" -s

# OAuth setup for Google Drive (headless environments)
python scripts/authorize_drive.py generate
python scripts/authorize_drive.py exchange "REDIRECT_URL"
```

## File Organization

- `/src` — Source code
- `/tests` — Tests (prefix integration tests with `real_`, unit tests are mocked)
- `/scripts` — Utility scripts (e.g., OAuth flow, assessment scripts)
- Never save working files to the root folder

## Key Architecture

**Pipeline flow** (`src/pipeline.py`): Lists PDFs from Drive → deduplicates via `Source File` property and content hash → downloads and extracts text → creates a Notion page as "Processing" → calls enrichment → updates page properties and blocks from `EnrichmentResult` → marks "Enriched".

**Enrichment** (`src/enrichment.py`): Agentic loop using OpenAI Responses API (`client.responses.create`). Model is `gpt-5.3-codex`. Three tools are available to the model during enrichment:
- `list_clients` — queries a separate Clients database in Notion
- `search_notion` — searches the workspace for related pages
- `fetch_notion_page` — reads a specific page's content

Falls back to single-shot (no tools, `json_object` format) when `notion=None`.

**Notion client** (`src/notion_client.py`): Uses `notion-client` v3.0.0 (API version 2025-09-03). `databases.query` is not available in v3; `hash_exists` uses `client.request()` with raw path as a fallback. Dedup methods (`hash_exists`, `title_exists`, `source_file_exists`) are best-effort and return `False` on failure.

**Drive client** (`src/drive_client.py`): Supports both service account and OAuth desktop flow. Text extraction uses `pdfminer.six`. Also supports `upload_pdf()` for ingest.

**Gmail client** (`src/gmail_client.py`): Label-driven email ingestion. Searches for emails with a configurable label, extracts PDF attachments (or converts body to PDF), and swaps labels on success.

**Ingest** (`src/ingest.py`): Gmail → Drive → Notion pipeline. `ingest()` fetches labeled emails, uploads PDFs to Drive, swaps labels. `main()` chains ingest with the existing pipeline.

**Shared auth** (`src/google_auth.py`): Extracted credential builder shared by Drive and Gmail clients. Supports service account and OAuth desktop flow with configurable scopes.

**Retry** (`src/retry.py`): `retry_on_transient()` wraps any callable with exponential backoff (2s → 4s → 8s, 3 retries) for HTTP 429/5xx from Google, Notion, and OpenAI.

**Models** (`src/models.py`): `SourceContent` (input) and `EnrichmentResult` (output) dataclasses. `ContentStatus` enum: Inbox → Processing → Enriched/Failed.

**Formatter** (`src/formatter.py`): Converts `EnrichmentResult` to Notion block dicts. Chunks text at the 2000-char Notion rich-text limit.

## Notion Database Properties

The Sources database uses these properties: Title, Status (select), Hash (rich_text), Source File (rich_text), Content-Type (select), AI-Primitive (multi_select), Vendor (select), Topical-Tags (multi_select), Domain-Tags (multi_select), Client-Relevance (rich_text), Drive URL (url), Created Date (date).

## Environment

Credentials in `.env` (see `.env.example`). Never commit `.env`, `token.json`, or `client_secret.json`.

## Code Style

Black formatter with 88-char line length. Type hints enforced via mypy (`disallow_untyped_defs`).
