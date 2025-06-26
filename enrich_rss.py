"""
enrich_rss.py  – RSS article & Website content ➜ Notion enrichment
  • Summary (≈250 words) using the Responses API with GPT-4.1
  • Classification with GPT-4.1

ENV (.env)
  NOTION_TOKEN, NOTION_SOURCES_DB
  OPENAI_API_KEY
  MODEL_SUMMARY=gpt-4.1
  MODEL_CLASSIFIER=gpt-4.1
  RSS_URL_PROP=Article URL
"""
import os, re, html, time, urllib.request
from urllib.error import URLError
from datetime import datetime

from dotenv import load_dotenv

load_dotenv()

RSS_URL_PROP  = os.getenv("RSS_URL_PROP", "Article URL")
CREATED_PROP  = os.getenv("CREATED_PROP", "Created Date")

from enrich import (
    inbox_rows,
    add_fulltext_blocks,
    add_summary_block,
    add_exec_summary_block,
    summarise_exec,
    summarise,
    classify,
    notion_update,
    notion,
)
from postprocess import post_process_page
from infer_vendor import infer_vendor_name


def is_page_archived(page_id: str) -> bool:
    """Check if a Notion page is archived."""
    try:
        page = notion.pages.retrieve(page_id)
        return page.get('archived', False)
    except Exception as exc:
        print(f"   ⚠️  Error checking page archive status: {exc}")
        return True  # Assume archived if we can't check


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


DATE_PATTERNS = [
    r"\b(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|September|Oct|October|Nov|November|Dec|December)\s+\d{1,2},\s+\d{4}\b",
    r"\b\d{1,2}\s+(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|September|Oct|October|Nov|November|Dec|December)\s+\d{4}\b",
    r"\b\d{4}-\d{2}-\d{2}\b",
]

DATE_FORMATS = ["%B %d, %Y", "%b %d, %Y", "%d %B %Y", "%Y-%m-%d"]


def extract_date_from_text(text: str) -> str | None:
    """Return an ISO date string if a known date pattern is found."""
    sample = text[:400]
    for pat in DATE_PATTERNS:
        m = re.search(pat, sample)
        if not m:
            continue
        date_str = m.group(0)
        for fmt in DATE_FORMATS:
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.date().isoformat()
            except ValueError:
                continue
    return None


def get_content_from_website_source(row):
    """Extract content from website sources that already have scraped content."""
    # Check if this is a website source with existing content
    blocks = notion.blocks.children.list(block_id=row["id"])
    for block in blocks.get("results", []):
        if (block.get("type") == "toggle" and 
            block.get("toggle", {}).get("rich_text", [{}])[0].get("text", {}).get("content", "").startswith("📄")):
            # Found scraped content block, need to get children separately due to nesting
            toggle_id = block["id"]
            toggle_children = notion.blocks.children.list(block_id=toggle_id)
            
            content = ""
            for child in toggle_children.get("results", []):
                if child.get("type") == "paragraph":
                    for text_obj in child.get("paragraph", {}).get("rich_text", []):
                        content += text_obj.get("text", {}).get("content", "")
            
            if content:
                return content
    return None


def main():
    rows = inbox_rows(require_url=RSS_URL_PROP)
    if not rows:
        print("🚩 Nothing in Inbox."); return
    print(f"🔍 Found {len(rows)} row(s) to enrich\n")

    processed_count = 0
    archived_count = 0

    for row in rows:
        art = row["properties"].get(RSS_URL_PROP)
        title = row["properties"]["Title"]["title"][0]["plain_text"]
        url = art["url"]
        print(f"➡️  {title}")

        # Check if page is archived before processing
        if is_page_archived(row["id"]):
            print("   📦 Skipping archived page")
            archived_count += 1
            continue

        try:
            # Check if this is a website source with existing scraped content
            article_text = get_content_from_website_source(row)
            
            if article_text:
                print("   • Using existing scraped content …")
            else:
                print("   • Fetching article …")
                article_text = fetch_article_text(url)

            # assign created date from article text if missing
            created_prop = row["properties"].get(CREATED_PROP, {})
            date_val = created_prop.get("date", {})
            if not date_val or not date_val.get("start"):
                found = extract_date_from_text(article_text)
                if found:
                    notion.pages.update(row["id"], properties={
                        CREATED_PROP: {"date": {"start": found}}
                    })
                    print(f"     ↳ set Created Date: {found}")

            print("   • Summarising with GPT-4.1 …")
            detail = summarise(article_text)
            add_summary_block(row["id"], detail)

            add_fulltext_blocks(row["id"], article_text)

            print("     ↳ extracted chars:", len(article_text))

            if not article_text.strip():
                raise ValueError("empty text after extraction")

            print("   • Summarising with GPT-4.1 (exec) …")
            summary = summarise_exec(article_text)
            add_exec_summary_block(row["id"], summary)
            print("     ↳ exec summary chars:", len(summary))

            print("   • Classifying with GPT-4.1 …")
            ctype, prim = classify(article_text)
            print(f"     ↳ {ctype}  /  {prim}")

            vendor = None
            vend_prop = row["properties"].get("Vendor", {})
            if not vend_prop.get("select"):
                print("   • Inferring vendor …")
                try:
                    vendor = infer_vendor_name(summary or article_text)
                    if vendor == "Unknown":
                        print("     ↳ Vendor: Unknown")
                        vendor = None
                    else:
                        print(f"     ↳ Vendor: {vendor}")
                except Exception as exc:
                    print(f"     ⚠️ Vendor inference error: {exc}")

            print("   • Post-processing …")
            post_process_page(row["id"], article_text)

            notion_update(row["id"], "Enriched", summary, ctype, prim, vendor)
            print("✅ Updated row → Enriched\n")
            processed_count += 1

        except Exception as err:
            print("❌", err, "\n")
            try:
                notion_update(row["id"], "Failed")
            except Exception as update_err:
                print(f"   ⚠️  Could not update status to Failed (likely archived): {update_err}")
        time.sleep(0.3)
    
    # Print summary
    print(f"\n📊 Enrichment Summary:")
    print(f"   Total pages found: {len(rows)}")
    print(f"   ✅ Successfully enriched: {processed_count}")
    print(f"   📦 Skipped (archived): {archived_count}")
    print(f"   ❌ Failed: {len(rows) - processed_count - archived_count}")


if __name__ == "__main__":
    main()
