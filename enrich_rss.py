"""
enrich_rss.py  – RSS article ➜ Notion enrichment
  • Summary (≈250 words) with GPT-4.1
  • Classification with GPT-4.1 (tool call)

ENV (.env)
  NOTION_TOKEN, NOTION_SOURCES_DB
  OPENAI_API_KEY
  MODEL_SUMMARY=gpt-4.1
  MODEL_CLASSIFIER=gpt-4.1
  RSS_URL_PROP=Article URL
"""
import os, re, html, time, urllib.request
from urllib.error import URLError

from dotenv import load_dotenv

load_dotenv()

RSS_URL_PROP = os.getenv("RSS_URL_PROP", "Article URL")

from enrich import (
    inbox_rows,
    add_fulltext_blocks,
    summarise_exec,
    classify,
    notion_update,
)


def fetch_article_text(url: str) -> str:
    """Download the article and return crude plain text."""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120 Safari/537.36"
            )
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = resp.read().decode("utf-8", "ignore")
    except URLError as exc:
        raise RuntimeError(f"failed to fetch {url}: {exc}")

    data = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", data, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", data)
    text = html.unescape(text)
    return " ".join(text.split())


def main():
    rows = inbox_rows()
    if not rows:
        print("🚩 Nothing in Inbox."); return
    print(f"🔍 Found {len(rows)} row(s) to enrich\n")

    for row in rows:
        art = row["properties"].get(RSS_URL_PROP)
        if not art or not art.get("url"):
            continue
        title = row["properties"]["Title"]["title"][0]["plain_text"]
        url = art["url"]
        print(f"➡️  {title}")

        try:
            print("   • Fetching article …")
            article_text = fetch_article_text(url)
            add_fulltext_blocks(row["id"], article_text)
            print("     ↳ extracted chars:", len(article_text))

            if not article_text.strip():
                raise ValueError("empty text after extraction")

            print("   • Summarising with GPT-4.1 (exec) …")
            summary = summarise_exec(article_text)
            print("     ↳ exec summary chars:", len(summary))

            print("   • Classifying with GPT-4.1 …")
            ctype, prim = classify(article_text)
            print(f"     ↳ {ctype}  /  {prim}")

            notion_update(row["id"], "Enriched", summary, ctype, prim)
            print("✅ Updated row → Enriched\n")

        except Exception as err:
            print("❌", err, "\n")
            notion_update(row["id"], "Failed")
        time.sleep(0.3)


if __name__ == "__main__":
    main()
