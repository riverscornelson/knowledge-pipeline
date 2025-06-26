"""
Resilient RSS enrichment with improved error handling for archived pages and API timeouts
Drop-in replacement for enrich_rss.py with better reliability
"""
import os
import time
from dotenv import load_dotenv

# Import original functions
from enrich_rss import (
    RSS_URL_PROP, CREATED_PROP, fetch_article_text, extract_date_from_text,
    get_content_from_website_source, DATE_PATTERNS, DATE_FORMATS
)
from enrich import (
    inbox_rows, summarise, summarise_exec, classify, notion_update,
    add_summary_block, add_exec_summary_block, add_fulltext_blocks, notion
)
from postprocess import post_process_page
from infer_vendor import infer_vendor_name

# Import resilience features
from api_resilience import (
    ResilientNotionOps, safe_notion_update, safe_post_process, safe_add_blocks,
    quick_fix_archived_handling
)

load_dotenv()

# Create resilient notion client
resilient_notion = ResilientNotionOps(notion)

def is_page_archived_resilient(page_id: str) -> bool:
    """Check if a Notion page is archived with resilience."""
    try:
        page = resilient_notion.retrieve_page(page_id)
        if page is None:  # Resilient client returns None for archived pages
            return True
        return page.get('archived', False)
    except Exception as exc:
        print(f"   ⚠️  Error checking page archive status: {exc}")
        return True  # Assume archived if we can't check

def get_content_from_website_source_resilient(row):
    """Extract content from website sources with resilience."""
    try:
        # Check if this is a website source with existing content
        blocks = resilient_notion.list_blocks(row["id"])
        if blocks is None:  # Page is archived
            return None
            
        for block in blocks.get("results", []):
            if (block.get("type") == "toggle" and 
                block.get("toggle", {}).get("rich_text", [{}])[0].get("text", {}).get("content", "").startswith("📄")):
                # Found scraped content block
                toggle_id = block["id"]
                toggle_children = resilient_notion.list_blocks(toggle_id)
                
                if toggle_children is None:
                    continue
                
                content = ""
                for child in toggle_children.get("results", []):
                    if child.get("type") == "paragraph":
                        for text_obj in child.get("paragraph", {}).get("rich_text", []):
                            content += text_obj.get("text", {}).get("content", "")
                
                if content:
                    return content
        return None
    except Exception as e:
        print(f"   ⚠️  Error getting website content: {e}")
        return None

@quick_fix_archived_handling
def add_summary_block_safe(page_id: str, summary: str):
    """Add summary block with archived page handling"""
    return add_summary_block(page_id, summary)

@quick_fix_archived_handling  
def add_exec_summary_block_safe(page_id: str, summary: str):
    """Add executive summary block with archived page handling"""
    return add_exec_summary_block(page_id, summary)

@quick_fix_archived_handling
def add_fulltext_blocks_safe(page_id: str, text: str):
    """Add fulltext blocks with archived page handling"""
    return add_fulltext_blocks(page_id, text)

def process_date_resilient(row, article_text):
    """Process date extraction with resilience"""
    try:
        created_prop = row["properties"].get(CREATED_PROP, {})
        date_val = created_prop.get("date", {})
        if not date_val or not date_val.get("start"):
            found = extract_date_from_text(article_text)
            if found:
                result = resilient_notion.update_page(row["id"], properties={
                    CREATED_PROP: {"date": {"start": found}}
                })
                if result is not None:
                    print(f"     ↳ set Created Date: {found}")
    except Exception as e:
        print(f"   ⚠️  Error processing date: {e}")

def main():
    """Main function with improved resilience"""
    print("🚀 Starting resilient RSS enrichment...")
    
    try:
        rows = inbox_rows(require_url=RSS_URL_PROP)
    except Exception as e:
        print(f"❌ Error querying inbox: {e}")
        print("   This might be a temporary Notion API issue. Try again in a few minutes.")
        return
    
    if not rows:
        print("🚩 Nothing in Inbox.")
        return
        
    print(f"🔍 Found {len(rows)} row(s) to enrich\n")

    processed_count = 0
    archived_count = 0
    failed_count = 0

    for i, row in enumerate(rows):
        try:
            art = row["properties"].get(RSS_URL_PROP)
            if not art:
                print(f"⚠️  Row {i+1}: No RSS URL property found, skipping")
                failed_count += 1
                continue
                
            title = row["properties"]["Title"]["title"][0]["plain_text"]
            url = art["url"]
            item_id = row["id"]
            
            print(f"➡️  {title}")

            # Check if page is archived before processing
            if is_page_archived_resilient(item_id):
                print("   📦 Skipping archived page")
                archived_count += 1
                continue

            # Extract content with resilience
            article_text = get_content_from_website_source_resilient(row)
            
            if article_text:
                print("   • Using existing scraped content …")
            else:
                print("   • Fetching article …")
                try:
                    article_text = fetch_article_text(url)
                except Exception as e:
                    print(f"   ❌ Failed to fetch article: {e}")
                    failed_count += 1
                    continue

            if not article_text or not article_text.strip():
                print("   ❌ Empty content after extraction")
                failed_count += 1
                continue

            # Process date
            process_date_resilient(row, article_text)

            print("   • Summarising with GPT-4.1 …")
            try:
                detail = summarise(article_text)
                add_summary_block_safe(item_id, detail)
                add_fulltext_blocks_safe(item_id, article_text)
                print("     ↳ extracted chars:", len(article_text))
            except Exception as e:
                print(f"   ⚠️  Error in summarization: {e}")

            print("   • Summarising with GPT-4.1 (exec) …")
            try:
                summary = summarise_exec(article_text)
                add_exec_summary_block_safe(item_id, summary)
                print("     ↳ exec summary chars:", len(summary))
            except Exception as e:
                print(f"   ⚠️  Error in exec summarization: {e}")
                summary = detail  # Fallback to regular summary

            print("   • Classifying with GPT-4.1 …")
            try:
                ctype, prim = classify(article_text)
                print(f"     ↳ {ctype}  /  {prim}")
            except Exception as e:
                print(f"   ⚠️  Error in classification: {e}")
                ctype, prim = "Market News", "Research"  # Fallback

            # Vendor inference
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

            # Post-processing with resilience
            print("   • Post-processing …")
            try:
                result = safe_post_process(post_process_page, item_id, article_text)
                if result is None:
                    print("     ↳ Skipped post-processing (archived page)")
            except Exception as e:
                print(f"   ⚠️  Error in post-processing: {e}")

            # Update Notion with resilience
            try:
                result = safe_notion_update(notion_update, item_id, "Enriched", summary, ctype, prim, vendor)
                if result is None:
                    print("   📦 Cannot update archived page status")
                    archived_count += 1
                else:
                    print("✅ Updated row → Enriched\n")
                    processed_count += 1
            except Exception as e:
                print(f"   ❌ Failed to update status: {e}")
                failed_count += 1

        except Exception as err:
            print(f"❌ Unexpected error processing item {i+1}: {err}\n")
            failed_count += 1
        
        # Rate limiting
        time.sleep(0.3)
    
    # Print summary
    print(f"\n📊 Resilient Enrichment Summary:")
    print(f"   Total pages found: {len(rows)}")
    print(f"   ✅ Successfully enriched: {processed_count}")
    print(f"   📦 Skipped (archived): {archived_count}")
    print(f"   ❌ Failed: {failed_count}")
    
    if failed_count > 0:
        print(f"\n💡 Tip: Failed items might succeed on retry due to temporary API issues")

if __name__ == "__main__":
    main()