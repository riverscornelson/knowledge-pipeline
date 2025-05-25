"""
capture_rss.py – add new RSS items to the 📥 Sources database.

ENV (.env)
  NOTION_TOKEN, NOTION_SOURCES_DB
  RSS_FEEDS      comma-separated list of feed URLs or Substack newsletter URLs
  RSS_URL_PROP   property name for the article URL (default 'Article URL')
  CREATED_PROP   (optional) property for created date (default "Created Date")
"""
import os, hashlib, time, re
from urllib.parse import urlparse
from email.utils import parsedate_to_datetime
from tenacity import retry, wait_exponential, stop_after_attempt

from dotenv import load_dotenv
from notion_client import Client as Notion
import feedparser

load_dotenv()

NOTION_DB     = os.getenv("NOTION_SOURCES_DB")
RSS_FEEDS     = os.getenv("RSS_FEEDS", "")
RSS_URL_PROP  = os.getenv("RSS_URL_PROP", "Article URL")
CREATED_PROP  = os.getenv("CREATED_PROP", "Created Date")

notion = Notion(auth=os.getenv("NOTION_TOKEN"))


def feed_url(url: str) -> str:
    """Return a usable RSS feed URL. Adds /feed for Substack."""
    if not url:
        return ""
    url = url.strip()
    parsed = urlparse(url)
    if not parsed.scheme:
        url = "https://" + url
        parsed = urlparse(url)
    if "substack.com" in parsed.netloc and not url.endswith("/feed"):
        url = url.rstrip("/") + "/feed"
    return url


def entry_hash(link: str) -> str:
    return hashlib.sha256(link.encode("utf-8")).hexdigest()


def entry_date(entry) -> str | None:
    date_str = entry.get("published") or entry.get("updated")
    if not date_str:
        return None
    try:
        return parsedate_to_datetime(date_str).isoformat()
    except Exception:
        return None


def notion_page_exists(h: str) -> bool:
    q = notion.databases.query(
        database_id=NOTION_DB,
        filter={"property": "Hash", "rich_text": {"equals": h}},
    )
    return len(q["results"]) > 0


@retry(wait=wait_exponential(2, 30), stop=stop_after_attempt(5))
def _create_page(props: dict):
    notion.pages.create(parent={"database_id": NOTION_DB}, properties=props)


def create_row(title: str, link: str, h: str, created_time: str | None) -> None:
    props = {
        "Title": {"title": [{"text": {"content": title}}]},
        RSS_URL_PROP: {"url": link},
        "Status": {"select": {"name": "Inbox"}},
        "Hash": {"rich_text": [{"text": {"content": h}}]},
    }
    if created_time:
        props[CREATED_PROP] = {"date": {"start": created_time}}
    try:
        _create_page(props)
        print(f"Added ⇒ {title}")
    except Exception as exc:
        print(f"   ⚠️  failed to add {title}: {exc}")


def main():
    feeds = [feed_url(f) for f in RSS_FEEDS.split(",") if f.strip()]
    if not feeds:
        raise SystemExit("❌ RSS_FEEDS not provided")

    for url in feeds:
        print(f"📡 {url}")
        parsed = feedparser.parse(url)
        if parsed.bozo:
            print("   ⚠️  failed to parse feed")
            continue

        for entry in parsed.entries:
            link = entry.get("link")
            if not link:
                continue
            h = entry_hash(link)
            try:
                if notion_page_exists(h):
                    continue
            except Exception as exc:
                print(f"   ⚠️  error checking existing pages: {exc}")
                continue
            title = entry.get("title", link)
            created = entry_date(entry)
            create_row(title, link, h, created)
            time.sleep(0.3)


if __name__ == "__main__":
    main()
