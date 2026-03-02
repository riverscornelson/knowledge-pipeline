"""Read-only assessment of existing Notion DB entries."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config import NotionConfig
from notion_client import Client


def main():
    config = NotionConfig.from_env()
    client = Client(auth=config.token)
    db_id = config.sources_db_id

    try:
        results = []
        resp = client.databases.query(database_id=db_id, page_size=100)
        results.extend(resp.get("results", []))
        while resp.get("has_more"):
            resp = client.databases.query(
                database_id=db_id,
                page_size=100,
                start_cursor=resp["next_cursor"],
            )
            results.extend(resp.get("results", []))

        print(f"Existing pages in DB: {len(results)}")

        statuses = {}
        for page in results:
            status = page.get("properties", {}).get("Status", {}).get("select")
            s = status.get("name", "None") if status else "None"
            statuses[s] = statuses.get(s, 0) + 1
        print(f"Status breakdown: {statuses}")

        has_hash = sum(1 for p in results
                       if p.get("properties", {}).get("Hash", {}).get("rich_text", []))
        print(f"Pages with hashes: {has_hash}/{len(results)}")

    except Exception as e:
        print(f"Query failed (expected with v3 SDK): {e}")
        # Try search fallback
        try:
            resp = client.search(
                filter={"property": "object", "value": "page"},
                page_size=100,
            )
            pages = [p for p in resp.get("results", [])
                     if p.get("parent", {}).get("database_id", "").replace("-", "") == db_id.replace("-", "")]
            print(f"Found ~{len(pages)} pages via search (may be incomplete)")
        except Exception as e2:
            print(f"Search also failed: {e2}")


if __name__ == "__main__":
    main()
