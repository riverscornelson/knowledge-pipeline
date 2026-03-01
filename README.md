# Knowledge Pipeline

Ingest PDFs from Google Drive, enrich with AI, store in Notion.

## How it works

1. Lists PDFs in a Google Drive folder
2. Downloads each PDF and extracts text
3. Sends text to OpenAI (gpt-5.3-codex via Responses API) for enrichment
4. During enrichment, the model can search your Notion workspace for related clients/projects
5. Creates a Notion page with summary, insights, tags, and client relevance

## Setup

```bash
pip install -e .
cp .env.example .env
# Fill in your credentials (see .env.example)
```

### Google Drive auth

**Option A — Service account** (if your org allows it):
```
GOOGLE_APP_CREDENTIALS=path/to/service-account-key.json
```

**Option B — OAuth desktop flow**:
```bash
# 1. Create OAuth client ID (Desktop app) in Google Cloud Console
# 2. Download JSON as client_secret.json
# 3. Run the auth script:
python scripts/authorize_drive.py generate
# Visit the URL, authorize, paste the redirect URL back:
python scripts/authorize_drive.py exchange "PASTE_REDIRECT_URL"
```

### Notion

1. Create an integration at https://www.notion.so/profile/integrations
2. Share your Sources database with the integration (with edit access)
3. Set `NOTION_TOKEN` and `NOTION_SOURCES_DB` in `.env`

## Run

```bash
python -m src.run
```

## Project structure

```
src/
  config.py          # Environment config (Notion, Drive, OpenAI)
  models.py          # SourceContent, EnrichmentResult dataclasses
  drive_client.py    # Google Drive: list, download, extract text
  enrichment.py      # Agentic OpenAI loop with Notion tool-use
  notion_client.py   # Notion: pages, blocks, search, fetch
  formatter.py       # Convert EnrichmentResult to Notion blocks
  pipeline.py        # Main pipeline orchestration
  run.py             # CLI entry point
tests/
  test_pipeline.py   # 11 mocked + 4 real integration tests
scripts/
  authorize_drive.py # One-time OAuth flow for headless environments
```

## Tests

```bash
# Unit tests (mocked, fast):
python -m pytest tests/ -k "not real_"

# Integration tests (requires .env credentials):
python -m pytest tests/ -k "real_" -s
```

## License

MIT
