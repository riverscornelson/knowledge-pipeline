# Knowledge Pipeline

Small utilities for capturing PDFs and RSS articles and storing them in a Notion database. The scripts can summarise and classify content using OpenAI models.

## Utilities

| Script | Description |
|--------|-------------|
| `ingest_drive.py` | Scan a Google Drive folder for new PDFs and create pages in the **Sources** database. |
| `enrich.py` | Download PDFs referenced in the database, extract text, generate summaries, classify topics and update each page. |
| `capture_rss.py` | Pull new entries from RSS feeds or Substack newsletters and add them to the database. |
| `enrich_rss.py` | Summarise and classify RSS articles already stored in Notion. |

## Setup

1. *(Optional)* Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Provide configuration via environment variables or a `.env` file.

### Environment variables

| Variable | Purpose |
|----------|---------|
| `NOTION_TOKEN` | Notion integration token |
| `NOTION_SOURCES_DB` | ID of the target Notion database |
| `GOOGLE_APP_CREDENTIALS` | Path to a Google service-account JSON key |
| `OPENAI_API_KEY` | OpenAI API key |
| `MODEL_SUMMARY` | Model used for summary generation (default `gpt-4.1`) |
| `MODEL_CLASSIFIER` | Model for classification (default `gpt-4.1`) |
| `DRIVE_FOLDER_ID` | Google Drive folder ID for `ingest_drive.py` (optional) |
| `RSS_FEEDS` | Comma-separated RSS or Substack URLs for `capture_rss.py` |
| `RSS_URL_PROP` | Property name for the article URL (default `Article URL`) |
| `CREATED_PROP` | Property name for the created date (default `Created Date`) |

Ensure your database includes a **Created Date** property.

## Usage

1. Ingest new PDFs from Drive:

```bash
python ingest_drive.py
```

2. Summarise and classify them:

```bash
python enrich.py
```

3. Summarise existing RSS articles:

```bash
python enrich_rss.py
```

4. Capture new items from RSS feeds:

```bash
python capture_rss.py
```

If a feed URL points to a Substack homepage, `capture_rss.py` automatically appends `/feed`. Use `RSS_URL_PROP` if your database stores article URLs under a different property name.

---

These utilities rely on `python-dotenv`, `google-api-python-client`, `notion-client` and the OpenAI API. Any `.idea/` directory can be ignored.
