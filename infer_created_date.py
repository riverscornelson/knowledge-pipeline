"""
infer_created_date.py – fill blank Created Date fields.

ENV (.env)
  NOTION_TOKEN, NOTION_SOURCES_DB
  RSS_URL_PROP=Article URL
  CREATED_PROP=Created Date
"""
import os, time, argparse
from dotenv import load_dotenv
from notion_client import Client as Notion

from enrich_rss import fetch_article_text, extract_date_from_text, RSS_URL_PROP, CREATED_PROP

load_dotenv()

NOTION_DB = os.getenv("NOTION_SOURCES_DB")

notion = Notion(auth=os.getenv("NOTION_TOKEN"))


def query_pages():
    filt = {
        "and": [
            {"property": RSS_URL_PROP, "url": {"is_not_empty": True}},
            {"property": CREATED_PROP, "date": {"is_empty": True}},
        ]
    }
    results = []
    kwargs = dict(database_id=NOTION_DB, filter=filt, page_size=100)
    while True:
        resp = notion.databases.query(**kwargs)
        results.extend(resp["results"])
        if not resp.get("has_more"):
            break
        kwargs["start_cursor"] = resp["next_cursor"]
    return results


def main():
    ap = argparse.ArgumentParser(description="Populate missing Created Dates")
    ap.add_argument("--dry-run", action="store_true", help="Preview changes")
    args = ap.parse_args()

    rows = query_pages()
    if not rows:
        print("🚩 Nothing to update."); return
    print(f"🔍 Found {len(rows)} page(s)\n")

    for row in rows:
        title = row["properties"]["Title"]["title"][0]["plain_text"]
        url = row["properties"][RSS_URL_PROP]["url"]
        print(f"➡️  {title}")
        try:
            print("   • Fetching article …")
            text = fetch_article_text(url)
        except Exception as exc:
            print("   ⚠️", exc, "\n")
            continue
        found = extract_date_from_text(text)
        if not found:
            print("   ↳ No date found\n")
            continue
        print(f"   ↳ Date: {found}")
        if args.dry_run:
            print("   (dry run)\n")
            continue
        try:
            notion.pages.update(row["id"], properties={
                CREATED_PROP: {"date": {"start": found}}
            })
            print("   ✓ Updated\n")
        except Exception as exc:
            print("   ⚠️  Failed to update:", exc, "\n")
        time.sleep(0.3)


if __name__ == "__main__":
    main()
