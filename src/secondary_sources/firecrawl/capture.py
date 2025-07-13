"""
Firecrawl website capture module.
"""
import os
import hashlib
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from urllib.parse import urlparse

import requests
from tenacity import retry, wait_exponential, stop_after_attempt

from ...core.config import PipelineConfig
from ...core.models import SourceContent, ContentStatus, ContentType
from ...core.notion_client import NotionClient
from ...utils.logging import setup_logger


class FirecrawlCapture:
    """Captures content from websites using Firecrawl API."""
    
    def __init__(self, config: PipelineConfig, notion_client: NotionClient):
        """Initialize Firecrawl capture with configuration."""
        self.config = config
        self.notion_client = notion_client
        self.logger = setup_logger(__name__)
        
        # Firecrawl configuration
        self.api_key = os.getenv("FIRECRAWL_API_KEY")
        self.base_url = "https://api.firecrawl.dev/v1"
        self.window_days = int(os.getenv("WEBSITE_WINDOW_DAYS", "30"))
        
        # Website configurations
        self.websites = self._load_website_config()
    
    def _load_website_config(self) -> List[Dict]:
        """Load website configurations from environment or config file."""
        # Default websites to monitor
        default_websites = [
            {
                "url": "https://www.theverge.com/ai-artificial-intelligence",
                "name": "The Verge AI",
                "auth": None
            },
            {
                "url": "https://techcrunch.com/category/artificial-intelligence/",
                "name": "TechCrunch AI",
                "auth": None
            }
        ]
        
        # Load from config file if exists
        config_path = "config/websites.json"
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                return json.load(f)
        
        return default_websites
    
    def capture_websites(self, limit: Optional[int] = None) -> Dict[str, int]:
        """
        Capture content from configured websites.
        
        Returns:
            Dict with counts: {"total": n, "new": n, "skipped": n}
        """
        stats = {"total": 0, "new": 0, "skipped": 0}
        
        for website in self.websites[:limit] if limit else self.websites:
            try:
                self.logger.info(f"Scraping {website['name']}: {website['url']}")
                
                # Scrape website
                articles = self._scrape_website(website)
                stats["total"] += len(articles)
                
                # Process each article
                for article in articles:
                    try:
                        # Create source content
                        source_content = self._create_source_content(article, website)
                        if not source_content:
                            stats["skipped"] += 1
                            continue
                        
                        # Check if already exists
                        if self.notion_client.check_hash_exists(source_content.hash):
                            self.logger.info(f"Skipping duplicate: {source_content.title}")
                            stats["skipped"] += 1
                            continue
                        
                        # Create Notion page
                        page_id = self.notion_client.create_page(source_content)
                        self.logger.info(f"✓ Added: {source_content.title}")
                        stats["new"] += 1
                        
                    except Exception as e:
                        self.logger.error(f"Error processing article: {e}")
                        stats["skipped"] += 1
                
            except Exception as e:
                self.logger.error(f"Error scraping {website['name']}: {e}")
        
        self.logger.info(f"Website capture complete: {stats['new']} new articles added")
        return stats
    
    @retry(
        wait=wait_exponential(multiplier=1, min=4, max=10),
        stop=stop_after_attempt(3)
    )
    def _scrape_website(self, website: Dict) -> List[Dict]:
        """Scrape a website using Firecrawl API."""
        if not self.api_key:
            raise ValueError("FIRECRAWL_API_KEY not configured")
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        # Build request payload
        payload = {
            "url": website["url"],
            "formats": ["markdown", "links"],
            "includeTags": ["article", "main", "content"],
            "excludeTags": ["nav", "footer", "sidebar"],
            "onlyMainContent": True
        }
        
        # Add authentication if needed
        if website.get("auth"):
            payload["authentication"] = website["auth"]
        
        # Make API request
        response = requests.post(
            f"{self.base_url}/scrape",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code != 200:
            raise Exception(f"Firecrawl API error: {response.status_code} - {response.text}")
        
        data = response.json()
        
        # Extract articles from scraped content
        if data.get("success"):
            return self._extract_articles(data.get("data", {}))
        else:
            raise Exception(f"Firecrawl scrape failed: {data.get('error')}")
    
    def _extract_articles(self, scraped_data: Dict) -> List[Dict]:
        """Extract individual articles from scraped data."""
        articles = []
        
        # Get links that look like articles
        links = scraped_data.get("links", [])
        cutoff_date = datetime.now() - timedelta(days=self.window_days)
        
        for link in links:
            # Filter for article-like URLs
            if self._is_article_url(link):
                articles.append({
                    "url": link,
                    "title": link.split('/')[-1].replace('-', ' ').title(),  # Basic title extraction
                    "content": None  # Will be fetched separately if needed
                })
        
        # Also check if the main page has article content
        if scraped_data.get("markdown"):
            articles.append({
                "url": scraped_data.get("url", ""),
                "title": scraped_data.get("title", "Main Page"),
                "content": scraped_data.get("markdown")
            })
        
        return articles
    
    def _is_article_url(self, url: str) -> bool:
        """Check if URL looks like an article."""
        # Basic heuristics for article URLs
        article_patterns = [
            r'/\d{4}/\d{2}/',  # Date patterns
            r'/article/',
            r'/post/',
            r'/blog/',
            r'/news/',
            r'-\d{6,}',  # ID patterns
        ]
        
        import re
        for pattern in article_patterns:
            if re.search(pattern, url):
                return True
        
        return False
    
    def _create_source_content(self, article: Dict, website: Dict) -> Optional[SourceContent]:
        """Create SourceContent from article data."""
        try:
            # Generate hash from URL
            url_hash = hashlib.sha256(article["url"].encode()).hexdigest()
            
            # Get content if not already present
            content = article.get("content")
            if not content and article["url"]:
                # Fetch individual article content
                content = self._fetch_article_content(article["url"])
            
            if not content:
                return None
            
            return SourceContent(
                title=article.get("title", "Untitled"),
                status=ContentStatus.INBOX,
                hash=url_hash,
                content_type=ContentType.WEBSITE,
                article_url=article["url"],
                created_date=datetime.now(),  # Could be extracted from content
                raw_content=content
            )
            
        except Exception as e:
            self.logger.error(f"Failed to create source content: {e}")
            return None
    
    @retry(
        wait=wait_exponential(multiplier=1, min=4, max=10),
        stop=stop_after_attempt(3)
    )
    def _fetch_article_content(self, url: str) -> Optional[str]:
        """Fetch content for a specific article URL."""
        if not self.api_key:
            return None
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "url": url,
            "formats": ["markdown"],
            "onlyMainContent": True
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/scrape",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    return data.get("data", {}).get("markdown")
        except Exception as e:
            self.logger.error(f"Failed to fetch article content: {e}")
        
        return None