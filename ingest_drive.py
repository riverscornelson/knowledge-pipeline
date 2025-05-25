"""
ingest_drive.py  – push new Drive files into the 📥 Sources database.

ENV VARS REQUIRED  (set in .env or export):
  NOTION_TOKEN            internal integration token
  NOTION_SOURCES_DB       the DB ID printed by setup_notion.py
  GOOGLE_APP_CREDENTIALS  path to your service-account JSON key
  DRIVE_FOLDER_ID         (optional) if you didn’t name the folder “Knowledge-Base”
  CREATED_PROP            (optional) property for created date (default "Created Date")

pip install notion-client google-api-python-client python-dotenv
"""
import os, io, hashlib, time
from dotenv import load_dotenv
from notion_client import Client as Notion
from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials
from googleapiclient.http import MediaIoBaseDownload
from tenacity import retry, wait_exponential, stop_after_attempt

load_dotenv()

# ── Config from env ────────────────────────────────────────────
NOTION_DB   = os.getenv("NOTION_SOURCES_DB")
TOKEN       = os.getenv("NOTION_TOKEN")
SA_PATH     = os.getenv("GOOGLE_APP_CREDENTIALS")
FOLDER_ID   = os.getenv("DRIVE_FOLDER_ID")  # optional
# property storing the created date in Notion
CREATED_PROP = os.getenv("CREATED_PROP", "Created Date")
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
@retry(wait=wait_exponential(2, 30), stop=stop_after_attempt(5))
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


@retry(wait=wait_exponential(2, 30), stop=stop_after_attempt(5))
def sha256_of_drive_file(fid: str) -> str:
    request = drive.files().get_media(fileId=fid)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
    return hashlib.sha256(buf.getvalue()).hexdigest()


@retry(wait=wait_exponential(2, 30), stop=stop_after_attempt(5))
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


def drive_id(url: str) -> str:
    """Extract the file ID from a Google Drive share URL."""
    try:
        return url.split("/d/")[1].split("/")[0]
    except Exception:
        return ""


@retry(wait=wait_exponential(2, 30), stop=stop_after_attempt(5))
def known_drive_files() -> tuple[set[str], set[str]]:
    """Return sets of Drive file IDs and SHA256 hashes already in Notion."""
    filt = {"property": "Drive URL", "url": {"is_not_empty": True}}
    kwargs = dict(database_id=NOTION_DB, filter=filt, page_size=100)
    ids: set[str] = set()
    hashes: set[str] = set()
    while True:
        resp = notion.databases.query(**kwargs)
        for page in resp["results"]:
            url = page["properties"].get("Drive URL", {}).get("url")
            if url:
                fid = drive_id(url)
                if fid:
                    ids.add(fid)
            hprop = page["properties"].get("Hash", {}).get("rich_text", [])
            if hprop:
                text = hprop[0].get("plain_text")
                if text:
                    hashes.add(text)
        if not resp.get("has_more"):
            break
        kwargs["start_cursor"] = resp["next_cursor"]
    return ids, hashes


@retry(wait=wait_exponential(2, 30), stop=stop_after_attempt(5))
def _create_page(props: dict):
    notion.pages.create(parent={"database_id": NOTION_DB}, properties=props)


def create_notion_row(name, web_link, file_hash, created_time):
    props = {
        "Title": {"title": [{"text": {"content": name}}]},
        "Drive URL": {"url": web_link},
        "Status": {"select": {"name": "Inbox"}},
        "Hash": {"rich_text": [{"text": {"content": file_hash}}]},
    }
    if created_time:
        props[CREATED_PROP] = {"date": {"start": created_time}}

    try:
        _create_page(props)
        print(f"Added ⇒ {name}")
    except Exception as exc:
        print(f"   ⚠️  failed to add {name}: {exc}")


# ── Main flow ─────────────────────────────────────────────────
def main():
    global FOLDER_ID
    if not FOLDER_ID:
        FOLDER_ID = get_folder_id_by_name(FOLDER_NAME)
        if not FOLDER_ID:
            raise SystemExit("❌  Could not locate Drive folder.")

    known_ids, known_hashes = known_drive_files()
    if known_ids:
        print(f"Skipping {len(known_ids)} file(s) already linked in Notion")

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
        if f["id"] in known_ids:
            continue
        try:
            file_hash = sha256_of_drive_file(f["id"])
        except Exception as exc:
            print(f"   ⚠️  failed to download {f['name']}: {exc}")
            continue
        if file_hash in known_hashes:
            continue
        create_notion_row(
            f["name"],
            f["webViewLink"],
            file_hash,
            f.get("createdTime")
        )
        new_count += 1
        time.sleep(0.3)  # gentle on Notion rate-limit

    print(f"✅  Ingestion complete – {new_count} new files added.")


if __name__ == "__main__":
    main()
