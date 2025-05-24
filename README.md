# Knowledge Pipeline

This repository holds small utilities for capturing information from external sources and pushing it into a Notion database.  The current focus is on ingesting PDF files from Google Drive and enriching them with OpenAI models.

## Contents

- `ingest_drive.py` – scans a Google Drive folder and creates rows in the Notion **Sources** database for any new files.
- `enrich.py` – downloads PDFs referenced in the database, extracts text, generates a summary, performs a simple classification and updates the Notion page.
- `capture_rss.py` – placeholder script for future RSS ingestion.
- `requirements.txt` – Python dependencies for the utilities.

## Installation

1. Create a virtual environment (optional).
2. Install the dependencies:

```bash
pip install -r requirements.txt
```

3. Provide the required environment variables either via a `.env` file or through the shell.

## Environment variables

The following variables are referenced by the scripts:

| Variable | Purpose |
|----------|---------|
| `NOTION_TOKEN` | Notion integration token |
| `NOTION_SOURCES_DB` | ID of the target Notion database |
| `GOOGLE_APP_CREDENTIALS` | Path to a Google service‑account JSON key |
| `OPENAI_API_KEY` | OpenAI API key (used by `enrich.py`) |
| `MODEL_SUMMARY` | Model for summarisation (default `gpt-4.1`) |
| `MODEL_CLASSIFIER` | Model for classification (default `gpt-4.1`) |
| `DRIVE_FOLDER_ID` | Optional Google Drive folder ID for `ingest_drive.py` |

## Usage

First, run the ingestion script to populate Notion with new Drive files:

```bash
python ingest_drive.py
```

Then run the enrichment script to summarise and classify rows whose status is `Inbox`:

```bash
python enrich.py
```

`capture_rss.py` currently contains no implementation.

---

These utilities were built using `python-dotenv`, `google-api-python-client`, `notion-client` and OpenAI's API.  The repository also contains some IDE metadata under `.idea/` which can be ignored.

