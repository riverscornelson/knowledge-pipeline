"""
ingest_drive.py  – push new Drive files into the 📥 Sources database.

ENV VARS REQUIRED  (set in .env or export):
  NOTION_TOKEN            internal integration token
  NOTION_SOURCES_DB       the DB ID printed by setup_notion.py
  GOOGLE_APP_CREDENTIALS  path to your service-account JSON key
  DRIVE_FOLDER_ID         (optional) if you didn’t name the folder “Knowledge-Base”

pip install notion-client google-api-python-client python-dotenv
"""
import os, io, hashlib, time
from dotenv import load_dotenv
from notion_client import Client as Notion
from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials
from googleapiclient.http import MediaIoBaseDownload

load_dotenv()

# ── Config from env ────────────────────────────────────────────
NOTION_DB   = os.getenv("NOTION_SOURCES_DB")
TOKEN       = os.getenv("NOTION_TOKEN")
SA_PATH     = os.getenv("GOOGLE_APP_CREDENTIALS")
FOLDER_ID   = os.getenv("DRIVE_FOLDER_ID")  # optional
# fallback: find folder called “Knowledge-Base”
FOLDER_NAME = "Knowledge-Base"

# ── Clients ───────────────────────────────────────────────────
notion = Notion(auth=TOKEN)
drive  = build(
    "drive", "v3",
    credentials=Credentials.from_service_account_file(SA_PATH),
    cache_discovery=False,
)

# ── Helpers ───────────────────────────────────────────────────
def get_folder_id_by_name(name: str):
    resp = (
        drive.files()
        .list(
            q=f"mimeType = 'application/vnd.google-apps.folder' and name = '{name}' and trashed=false",
            fields="files(id, name)",
        )
        .execute()
    )
    return resp["files"][0]["id"] if resp["files"] else None


def sha256_of_drive_file(fid: str) -> str:
    request = drive.files().get_media(fileId=fid)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
    return hashlib.sha256(buf.getvalue()).hexdigest()


def notion_page_exists(file_hash: str) -> bool:
    q = notion.databases.query(
        **{
            "database_id": NOTION_DB,
            "filter": {
                "property": "Hash",
                "rich_text": {"equals": file_hash},
            },
        }
    )
    return len(q["results"]) > 0


def create_notion_row(name, web_link, file_hash):
    notion.pages.create(
        parent={"database_id": NOTION_DB},
        properties={
            "Title": {"title": [{"text": {"content": name}}]},
            "Drive URL": {"url": web_link},
            "Status": {"select": {"name": "Inbox"}},
            "Hash": {"rich_text": [{"text": {"content": file_hash}}]},
        },
    )
    print(f"Added ⇒ {name}")


# ── Main flow ─────────────────────────────────────────────────
def main():
    global FOLDER_ID
    if not FOLDER_ID:
        FOLDER_ID = get_folder_id_by_name(FOLDER_NAME)
        if not FOLDER_ID:
            raise SystemExit("❌  Could not locate Drive folder.")

    files = (
        drive.files()
        .list(
            q=f"'{FOLDER_ID}' in parents and trashed=false",
            fields="files(id, name, webViewLink, mimeType, createdTime)",
        )
        .execute()
    )["files"]

    print(f"Found {len(files)} files in Drive folder.")

    new_count = 0
    for f in files:
        file_hash = sha256_of_drive_file(f["id"])
        if notion_page_exists(file_hash):
            continue  # already ingested
        create_notion_row(f["name"], f["webViewLink"], file_hash)
        new_count += 1
        time.sleep(0.3)  # gentle on Notion rate-limit

    print(f"✅  Ingestion complete – {new_count} new files added.")


if __name__ == "__main__":
    main()
