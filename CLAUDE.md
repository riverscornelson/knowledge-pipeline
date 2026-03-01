# Claude Code Configuration

## Project Overview

Knowledge pipeline: Google Drive PDFs → OpenAI enrichment (with Notion tool-use) → Notion pages.

~800 lines across 8 source files. Python 3.10+.

## File Organization

- `/src` — Source code
- `/tests` — Tests
- `/scripts` — Utility scripts (e.g., OAuth flow)
- Never save working files to the root folder

## Key Architecture

- `src/enrichment.py` — Agentic loop using OpenAI Responses API (`client.responses.create`). Model is `gpt-5.3-codex`. Supports `search_notion` and `fetch_notion_page` tools for mid-enrichment Notion queries. Falls back to single-shot when `notion=None`.
- `src/drive_client.py` — Supports both service account and OAuth desktop flow for Google Drive auth.
- `src/notion_client.py` — Uses `notion-client` v3.0.0 (API version 2025-09-03). Note: `databases.query` is not available in v3; `hash_exists` falls back gracefully.

## Commands

```bash
# Run pipeline
python -m src.run

# Run unit tests
python -m pytest tests/ -k "not real_"

# Run integration tests (requires .env)
python -m pytest tests/ -k "real_" -s

# OAuth setup for Drive
python scripts/authorize_drive.py generate
python scripts/authorize_drive.py exchange "URL"
```

## Environment

Credentials in `.env` (see `.env.example`). Never commit `.env`, `token.json`, or `client_secret.json`.
