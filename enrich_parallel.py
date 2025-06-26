"""
Parallel enrichment engine for RSS articles & website content
Uses asyncio for concurrent processing with rate limiting and monitoring
"""
import os
import asyncio
import aiohttp
import time
from typing import List, Dict, Any, Optional
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from dotenv import load_dotenv

from logger import setup_logger, PipelineMetrics, track_performance, track_api_call
from enrich import (
    inbox_rows, notion_update, summarise, summarise_exec, classify,
    add_summary_block, add_exec_summary_block, add_fulltext_blocks,
    MAX_CHUNK
)
from enrich_rss import (
    is_page_archived, fetch_article_text, extract_date_from_text,
    get_content_from_website_source, RSS_URL_PROP, CREATED_PROP
)
from postprocess import post_process_page
from infer_vendor import infer_vendor_name

load_dotenv()

@dataclass
class ProcessingConfig:
    """Configuration for parallel processing"""
    max_workers: int = int(os.getenv("PARALLEL_MAX_WORKERS", "5"))
    rate_limit_delay: float = float(os.getenv("PARALLEL_RATE_LIMIT", "0.1"))
    enable_parallel: bool = os.getenv("ENABLE_PARALLEL", "true").lower() == "true"
    api_timeout: int = int(os.getenv("API_TIMEOUT", "60"))
    retry_attempts: int = int(os.getenv("RETRY_ATTEMPTS", "3"))
    
class ParallelEnricher:
    """Parallel content enrichment processor"""
    
    def __init__(self, config: ProcessingConfig = None):
        self.config = config or ProcessingConfig()
        self.logger = setup_logger("parallel_enricher")
        self.metrics = PipelineMetrics(self.logger)
        self.semaphore = asyncio.Semaphore(self.config.max_workers)
        
    async def enrich_item_async(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Enrich a single item asynchronously"""
        async with self.semaphore:
            start_time = time.time()
            item_id = row["id"]
            title = row["properties"]["Title"]["title"][0]["plain_text"]
            
            self.logger.info(f"Starting enrichment for: {title}", extra={
                "extra_fields": {
                    "event_type": "item_start",
                    "item_id": item_id,
                    "title": title
                }
            })
            
            try:
                # Check if page is archived
                if await self._check_archived_async(item_id):
                    self.metrics.increment_skipped()
                    self.logger.info(f"Skipping archived page: {title}", extra={
                        "extra_fields": {
                            "event_type": "item_skipped", 
                            "item_id": item_id,
                            "reason": "archived"
                        }
                    })
                    return {"status": "skipped", "reason": "archived", "title": title}
                
                # Extract content
                content = await self._extract_content_async(row)
                if not content or not content.strip():
                    raise ValueError("Empty content after extraction")
                
                # Process date if missing
                await self._process_date_async(row, content)
                
                # Run AI processing tasks in parallel
                summary_task = asyncio.create_task(self._summarise_async(content))
                exec_summary_task = asyncio.create_task(self._summarise_exec_async(content))
                classify_task = asyncio.create_task(self._classify_async(content))
                vendor_task = asyncio.create_task(self._infer_vendor_async(row, content))
                
                # Wait for all AI tasks to complete
                summary, exec_summary, (ctype, prim), vendor = await asyncio.gather(
                    summary_task, exec_summary_task, classify_task, vendor_task
                )
                
                # Add content blocks (these need to be sequential due to Notion API)
                await self._add_content_blocks_async(item_id, content, summary, exec_summary)
                
                # Post-process
                await self._post_process_async(item_id, content)
                
                # Update Notion
                await self._update_notion_async(item_id, "Enriched", exec_summary, ctype, prim, vendor)
                
                duration = time.time() - start_time
                self.metrics.add_processing_time(duration)
                self.metrics.increment_processed()
                
                self.logger.info(f"Completed enrichment for: {title}", extra={
                    "extra_fields": {
                        "event_type": "item_complete",
                        "item_id": item_id,
                        "title": title,
                        "duration": duration,
                        "content_length": len(content)
                    }
                })
                
                return {
                    "status": "success", 
                    "title": title, 
                    "duration": duration,
                    "content_length": len(content)
                }
                
            except Exception as e:
                duration = time.time() - start_time
                self.metrics.increment_failed()
                
                self.logger.error(f"Failed to enrich: {title} - {str(e)}", extra={
                    "extra_fields": {
                        "event_type": "item_error",
                        "item_id": item_id,
                        "title": title,
                        "duration": duration,
                        "error": str(e)
                    }
                })
                
                # Update status to failed
                try:
                    await self._update_notion_async(item_id, "Failed")
                except Exception as update_err:
                    self.logger.error(f"Could not update status to Failed: {update_err}")
                
                return {
                    "status": "failed", 
                    "title": title, 
                    "error": str(e),
                    "duration": duration
                }
            
            finally:
                # Rate limiting
                await asyncio.sleep(self.config.rate_limit_delay)
    
    async def _check_archived_async(self, page_id: str) -> bool:
        """Check if page is archived asynchronously"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, is_page_archived, page_id)
    
    async def _extract_content_async(self, row: Dict[str, Any]) -> str:
        """Extract content asynchronously"""
        loop = asyncio.get_event_loop()
        
        # Try website content first
        content = await loop.run_in_executor(None, get_content_from_website_source, row)
        if content:
            return content
        
        # Fetch from URL
        art = row["properties"].get(RSS_URL_PROP)
        if not art:
            raise ValueError("No URL found")
        
        url = art["url"]
        
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(self.config.api_timeout)) as session:
            return await self._fetch_article_async(session, url)
    
    async def _fetch_article_async(self, session: aiohttp.ClientSession, url: str) -> str:
        """Fetch article content asynchronously"""
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120 Safari/537.36"
            )
        }
        
        async with session.get(url, headers=headers) as response:
            if response.status != 200:
                raise RuntimeError(f"HTTP {response.status} for {url}")
            
            content = await response.text()
            
            # Clean HTML (run in thread pool)
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, self._clean_html, content)
    
    def _clean_html(self, content: str) -> str:
        """Clean HTML content (CPU-bound, run in thread pool)"""
        import re
        import html
        
        # Remove script and style tags
        content = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", content, flags=re.I | re.S)
        # Remove HTML tags
        content = re.sub(r"<[^>]+>", " ", content)
        # Unescape HTML entities
        content = html.unescape(content)
        return " ".join(content.split())
    
    async def _process_date_async(self, row: Dict[str, Any], content: str):
        """Process date extraction asynchronously"""
        created_prop = row["properties"].get(CREATED_PROP, {})
        date_val = created_prop.get("date", {})
        
        if not date_val or not date_val.get("start"):
            loop = asyncio.get_event_loop()
            found_date = await loop.run_in_executor(None, extract_date_from_text, content)
            
            if found_date:
                from enrich import notion
                await loop.run_in_executor(
                    None, 
                    notion.pages.update, 
                    row["id"], 
                    {"properties": {CREATED_PROP: {"date": {"start": found_date}}}}
                )
    
    async def _summarise_async(self, text: str) -> str:
        """Summarise text asynchronously"""
        start_time = time.time()
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, summarise, text)
            duration = time.time() - start_time
            self.metrics.track_api_call("openai", duration, 0)
            return result
        except Exception as e:
            duration = time.time() - start_time
            self.logger.error(f"Summarisation failed: {e}")
            raise
    
    async def _summarise_exec_async(self, text: str) -> str:
        """Executive summary asynchronously"""
        start_time = time.time()
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, summarise_exec, text)
            duration = time.time() - start_time
            self.metrics.track_api_call("openai", duration, 0)
            return result
        except Exception as e:
            duration = time.time() - start_time
            self.logger.error(f"Executive summarisation failed: {e}")
            raise
    
    async def _classify_async(self, text: str) -> tuple[str, str]:
        """Classify content asynchronously"""
        start_time = time.time()
        try:
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, classify, text)
            duration = time.time() - start_time
            self.metrics.track_api_call("openai", duration, 0)
            return result
        except Exception as e:
            duration = time.time() - start_time
            self.logger.error(f"Classification failed: {e}")
            raise
    
    async def _infer_vendor_async(self, row: Dict[str, Any], content: str) -> Optional[str]:
        """Infer vendor asynchronously"""
        vend_prop = row["properties"].get("Vendor", {})
        if vend_prop.get("select"):
            return None
        
        try:
            loop = asyncio.get_event_loop()
            vendor = await loop.run_in_executor(None, infer_vendor_name, content)
            return vendor if vendor != "Unknown" else None
        except Exception as e:
            self.logger.warning(f"Vendor inference failed: {e}")
            return None
    
    async def _add_content_blocks_async(self, page_id: str, content: str, summary: str, exec_summary: str):
        """Add content blocks asynchronously"""
        loop = asyncio.get_event_loop()
        
        # These need to be sequential due to Notion API limitations
        await loop.run_in_executor(None, add_summary_block, page_id, summary)
        await loop.run_in_executor(None, add_fulltext_blocks, page_id, content)
        await loop.run_in_executor(None, add_exec_summary_block, page_id, exec_summary)
    
    async def _post_process_async(self, page_id: str, content: str):
        """Post-process page asynchronously"""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, post_process_page, page_id, content)
    
    async def _update_notion_async(self, page_id: str, status: str, summary: str = None, 
                                  ctype: str = None, prim: str = None, vendor: str = None):
        """Update Notion page asynchronously"""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, notion_update, page_id, status, summary, ctype, prim, vendor)
    
    async def process_items_parallel(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process multiple items in parallel"""
        if not self.config.enable_parallel:
            self.logger.info("Parallel processing disabled, falling back to sequential")
            return await self._process_sequential(rows)
        
        self.logger.info(f"Starting parallel processing of {len(rows)} items", extra={
            "extra_fields": {
                "event_type": "parallel_start",
                "total_items": len(rows),
                "max_workers": self.config.max_workers,
                "rate_limit": self.config.rate_limit_delay
            }
        })
        
        # Metrics tracking is now handled within each async method
        
        # Process all items concurrently
        tasks = [self.enrich_item_async(row) for row in rows]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results and handle exceptions
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                self.logger.error(f"Unhandled exception for item {i}: {result}")
                processed_results.append({
                    "status": "failed", 
                    "error": str(result),
                    "title": f"Item {i}"
                })
            else:
                processed_results.append(result)
        
        self.metrics.log_summary()
        return processed_results
    
    async def _process_sequential(self, rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Fallback sequential processing"""
        results = []
        for row in rows:
            result = await self.enrich_item_async(row)
            results.append(result)
        return results

async def main_parallel():
    """Main parallel processing entry point"""
    logger = setup_logger("main")
    config = ProcessingConfig()
    
    logger.info("Starting parallel enrichment process", extra={
        "extra_fields": {
            "event_type": "process_start",
            "config": {
                "max_workers": config.max_workers,
                "rate_limit": config.rate_limit_delay,
                "parallel_enabled": config.enable_parallel
            }
        }
    })
    
    try:
        # Get items to process
        rows = inbox_rows(require_url=RSS_URL_PROP)
        if not rows:
            logger.info("No items found in inbox")
            return
        
        # Process items
        enricher = ParallelEnricher(config)
        results = await enricher.process_items_parallel(rows)
        
        # Log summary
        successful = len([r for r in results if r["status"] == "success"])
        failed = len([r for r in results if r["status"] == "failed"])
        skipped = len([r for r in results if r["status"] == "skipped"])
        
        logger.info("Parallel enrichment completed", extra={
            "extra_fields": {
                "event_type": "process_complete",
                "summary": {
                    "total": len(results),
                    "successful": successful,
                    "failed": failed,
                    "skipped": skipped
                }
            }
        })
        
        print(f"\n📊 Parallel Enrichment Summary:")
        print(f"   Total pages found: {len(rows)}")
        print(f"   ✅ Successfully enriched: {successful}")
        print(f"   📦 Skipped (archived): {skipped}")
        print(f"   ❌ Failed: {failed}")
        
    except Exception as e:
        logger.error(f"Parallel enrichment process failed: {e}", extra={
            "extra_fields": {
                "event_type": "process_error",
                "error": str(e)
            }
        })
        raise

def main():
    """Synchronous main entry point"""
    asyncio.run(main_parallel())

if __name__ == "__main__":
    main()