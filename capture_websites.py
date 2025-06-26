"""
capture_websites.py – add new website content to the 📥 Sources database using Firecrawl.

ENV (.env)
  NOTION_TOKEN, NOTION_SOURCES_DB
  FIRECRAWL_API_KEY         Firecrawl API key
  WEBSITE_SOURCES           comma-separated list of URLs to scrape
  WEBSITE_AUTH_CONFIGS      path to JSON file with auth configs (optional)
  WEBSITE_URL_PROP          property name for the source URL (default 'Article URL')
  CREATED_PROP              property for created date (default "Created Date")
  WEBSITE_WINDOW_DAYS       recency window for content (default 30)
"""
import os, hashlib, time, json
from urllib.parse import urlparse
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv
from notion_client import Client as Notion
from firecrawl import FirecrawlApp

load_dotenv()

NOTION_DB = os.getenv("NOTION_SOURCES_DB")
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")
WEBSITE_SOURCES = os.getenv("WEBSITE_SOURCES", "")
WEBSITE_AUTH_CONFIGS = os.getenv("WEBSITE_AUTH_CONFIGS", "")
WEBSITE_URL_PROP = os.getenv("WEBSITE_URL_PROP", "Article URL")
CREATED_PROP = os.getenv("CREATED_PROP", "Created Date")
WINDOW_DAYS = int(os.getenv("WEBSITE_WINDOW_DAYS", "30"))

notion = Notion(auth=os.getenv("NOTION_TOKEN"))
firecrawl = FirecrawlApp(api_key=FIRECRAWL_API_KEY)


def load_auth_configs() -> dict:
    """Load authentication configurations from JSON file."""
    if not WEBSITE_AUTH_CONFIGS or not os.path.exists(WEBSITE_AUTH_CONFIGS):
        return {}
    
    try:
        with open(WEBSITE_AUTH_CONFIGS, 'r') as f:
            return json.load(f)
    except Exception as exc:
        print(f"⚠️  Failed to load auth configs: {exc}")
        return {}


def get_domain(url: str) -> str:
    """Extract domain from URL."""
    parsed = urlparse(url)
    return parsed.netloc


def content_hash(url: str, content: str) -> str:
    """Generate hash from URL and content snippet for deduplication."""
    content_snippet = content[:500] if content else ""
    combined = f"{url}:{content_snippet}"
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()


def notion_page_exists(h: str) -> bool:
    """Check if a page with this hash already exists in Notion."""
    q = notion.databases.query(
        database_id=NOTION_DB,
        filter={"property": "Hash", "rich_text": {"equals": h}},
    )
    return len(q["results"]) > 0


def build_scrape_params(url: str, auth_configs: dict) -> dict:
    """Build Firecrawl scrape parameters with authentication if needed."""
    domain = get_domain(url)
    params = {
        "formats": ["markdown", "html"],
        "onlyMainContent": True
    }
    
    # Add authentication if configured for this domain
    if domain in auth_configs:
        auth_config = auth_configs[domain]
        auth_type = auth_config.get("type", "")
        
        if auth_type == "cookies":
            params["headers"] = {
                "Cookie": auth_config["cookies"]
            }
        elif auth_type == "bearer":
            params["headers"] = {
                "Authorization": f"Bearer {auth_config['token']}"
            }
        elif auth_type == "basic":
            params["headers"] = {
                "Authorization": f"Basic {auth_config['credentials']}"
            }
    
    return params


def extract_title_from_content(content: str, url: str) -> str:
    """Extract title from markdown content or fallback to URL."""
    if not content:
        return url
    
    lines = content.split('\n')
    for line in lines:
        line = line.strip()
        if line.startswith('# '):
            return line[2:].strip()
    
    # Fallback to URL domain
    return get_domain(url)


def create_row(title: str, url: str, h: str, content: str):
    """Create a new row in the Notion database."""
    props = {
        "Title": {"title": [{"text": {"content": title}}]},
        WEBSITE_URL_PROP: {"url": url},
        "Status": {"select": {"name": "Inbox"}},
        "Hash": {"rich_text": [{"text": {"content": h}}]},
        CREATED_PROP: {"date": {"start": datetime.now(timezone.utc).isoformat()}},
    }
    
    # Create the page
    page = notion.pages.create(
        parent={"database_id": NOTION_DB},
        properties=props,
    )
    
    # Add content as chunked blocks in the page body
    if content:
        # Chunk content into blocks (Notion limit is ~2000 chars per text block)
        chunk_size = 1500  # Conservative limit
        chunks = [content[i:i+chunk_size] for i in range(0, len(content), chunk_size)]
        
        # Create paragraph blocks for each chunk
        content_blocks = []
        for i, chunk in enumerate(chunks):
            content_blocks.append({
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"type": "text", "text": {"content": chunk}}]
                }
            })
        
        # Add toggle block with all content chunks
        notion.blocks.children.append(
            block_id=page["id"],
            children=[
                {
                    "object": "block",
                    "type": "toggle",
                    "toggle": {
                        "rich_text": [{"type": "text", "text": {"content": f"📄 Scraped Content ({len(chunks)} blocks)"}}],
                        "children": content_blocks
                    }
                }
            ]
        )
    
    print(f"Added ⇒ {title}")


def scrape_website(url: str, auth_configs: dict) -> tuple[str, str] | None:
    """Scrape a website using Firecrawl and return (title, content)."""
    try:
        # Build parameters with authentication
        params = build_scrape_params(url, auth_configs)
        result = firecrawl.scrape_url(url, **params)
        
        # Handle new Firecrawl API response format
        if not result.success:
            print(f"   ❌ Failed to scrape {url}: {getattr(result, 'error', 'Unknown error')}")
            return None
            
        # Get markdown content
        content = getattr(result, 'markdown', '')
        if not content:
            print(f"   ⚠️  No content extracted from {url}")
            return None
            
        title = extract_title_from_content(content, url)
        print(f"   ✅ Extracted {len(content)} characters")
        return title, content
        
    except Exception as exc:
        print(f"   ❌ Error scraping {url}: {exc}")
        return None


def main():
    if not FIRECRAWL_API_KEY:
        raise SystemExit("❌ FIRECRAWL_API_KEY not provided")
    
    urls = [url.strip() for url in WEBSITE_SOURCES.split(",") if url.strip()]
    if not urls:
        raise SystemExit("❌ WEBSITE_SOURCES not provided")
    
    auth_configs = load_auth_configs()
    cutoff = datetime.now(timezone.utc) - timedelta(days=WINDOW_DAYS)
    
    for url in urls:
        print(f"🔥 {url}")
        
        # Scrape the website
        result = scrape_website(url, auth_configs)
        if not result:
            continue
            
        title, content = result
        h = content_hash(url, content)
        
        # Check if we already have this content
        if notion_page_exists(h):
            print(f"   ⏭️  Already exists: {title}")
            continue
            
        # Create the Notion page
        create_row(title, url, h, content)
        time.sleep(0.5)  # Rate limiting


if __name__ == "__main__":
    main()