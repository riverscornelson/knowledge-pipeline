"""
Enhanced RSS enrichment with structured logging and parallel processing support
Backward compatible with existing pipeline while adding performance monitoring
"""
import os
import sys
import asyncio
from dotenv import load_dotenv

# Import original functions for compatibility
from enrich_rss import (
    inbox_rows, is_page_archived, fetch_article_text, extract_date_from_text,
    get_content_from_website_source, RSS_URL_PROP, CREATED_PROP, main as original_main
)
from enrich import (
    summarise, summarise_exec, classify, notion_update,
    add_summary_block, add_exec_summary_block, add_fulltext_blocks
)
from postprocess import post_process_page
from infer_vendor import infer_vendor_name

# Import new logging and parallel processing
from logger import setup_logger, PipelineMetrics, track_performance, track_api_call

load_dotenv()

class EnhancedEnricher:
    """Enhanced enricher with logging and optional parallel processing"""
    
    def __init__(self, enable_parallel: bool = None):
        self.enable_parallel = enable_parallel if enable_parallel is not None else \
                             os.getenv("ENABLE_PARALLEL", "false").lower() == "true"
        self.logger = setup_logger("enhanced_enricher")
        self.metrics = PipelineMetrics(self.logger)
        
        self.logger.info("Enhanced enricher initialized", extra={
            "extra_fields": {
                "event_type": "enricher_init",
                "parallel_enabled": self.enable_parallel
            }
        })
    
    @track_performance(None, "rss_article")
    def enrich_single_item(self, row):
        """Enrich a single item with performance tracking"""
        title = row["properties"]["Title"]["title"][0]["plain_text"]
        item_id = row["id"]
        
        self.logger.info(f"Processing: {title}", extra={
            "extra_fields": {
                "event_type": "item_start",
                "item_id": item_id,
                "title": title
            }
        })
        
        # Check if page is archived before processing
        if is_page_archived(item_id):
            self.logger.info(f"Skipping archived page: {title}", extra={
                "extra_fields": {
                    "event_type": "item_skipped",
                    "item_id": item_id,
                    "reason": "archived"
                }
            })
            self.metrics.increment_skipped()
            return "skipped"
        
        try:
            # Content extraction with logging
            article_text = get_content_from_website_source(row)
            if article_text:
                self.logger.debug("Using existing scraped content", extra={
                    "extra_fields": {"event_type": "content_source", "source": "scraped"}
                })
            else:
                self.logger.debug("Fetching article from URL", extra={
                    "extra_fields": {"event_type": "content_source", "source": "url"}
                })
                art = row["properties"].get(RSS_URL_PROP)
                url = art["url"]
                article_text = self._fetch_with_logging(url)
            
            if not article_text.strip():
                raise ValueError("empty text after extraction")
            
            self.logger.debug(f"Extracted content", extra={
                "extra_fields": {
                    "event_type": "content_extracted",
                    "content_length": len(article_text)
                }
            })
            
            # Date processing
            self._process_date_with_logging(row, article_text)
            
            # AI processing with API tracking
            summary = self._summarise_with_logging(article_text)
            add_summary_block(item_id, summary)
            add_fulltext_blocks(item_id, article_text)
            
            exec_summary = self._summarise_exec_with_logging(article_text)
            add_exec_summary_block(item_id, exec_summary)
            
            ctype, prim = self._classify_with_logging(article_text)
            
            vendor = self._infer_vendor_with_logging(row, exec_summary or article_text)
            
            # Post-processing
            self.logger.debug("Running post-processing", extra={
                "extra_fields": {"event_type": "post_processing"}
            })
            post_process_page(item_id, article_text)
            
            # Update Notion
            notion_update(item_id, "Enriched", exec_summary, ctype, prim, vendor)
            
            self.logger.info(f"Successfully enriched: {title}", extra={
                "extra_fields": {
                    "event_type": "item_complete",
                    "item_id": item_id,
                    "title": title,
                    "content_type": ctype,
                    "ai_primitive": prim,
                    "vendor": vendor
                }
            })
            
            return "success"
            
        except Exception as err:
            self.logger.error(f"Failed to enrich {title}: {str(err)}", extra={
                "extra_fields": {
                    "event_type": "item_error",
                    "item_id": item_id,
                    "title": title,
                    "error": str(err)
                }
            })
            
            try:
                notion_update(item_id, "Failed")
            except Exception as update_err:
                self.logger.error(f"Could not update status to Failed: {update_err}")
            
            return "failed"
    
    def _fetch_with_logging(self, url: str) -> str:
        """Fetch article with API call tracking"""
        @track_api_call(self.metrics, "web_fetch")
        def _fetch():
            return fetch_article_text(url)
        return _fetch()
    
    def _summarise_with_logging(self, text: str) -> str:
        """Summarise with API call tracking"""
        @track_api_call(self.metrics, "openai")
        def _summarise():
            return summarise(text)
        return _summarise()
    
    def _summarise_exec_with_logging(self, text: str) -> str:
        """Executive summarise with API call tracking"""
        @track_api_call(self.metrics, "openai")
        def _summarise_exec():
            return summarise_exec(text)
        return _summarise_exec()
    
    def _classify_with_logging(self, text: str) -> tuple[str, str]:
        """Classify with API call tracking"""
        @track_api_call(self.metrics, "openai")
        def _classify():
            return classify(text)
        return _classify()
    
    def _process_date_with_logging(self, row, article_text):
        """Process date with logging"""
        created_prop = row["properties"].get(CREATED_PROP, {})
        date_val = created_prop.get("date", {})
        if not date_val or not date_val.get("start"):
            found = extract_date_from_text(article_text)
            if found:
                from enrich import notion
                notion.pages.update(row["id"], properties={
                    CREATED_PROP: {"date": {"start": found}}
                })
                self.logger.debug(f"Set created date: {found}", extra={
                    "extra_fields": {"event_type": "date_extracted", "date": found}
                })
    
    def _infer_vendor_with_logging(self, row, text):
        """Infer vendor with logging"""
        vend_prop = row["properties"].get("Vendor", {})
        if not vend_prop.get("select"):
            try:
                vendor = infer_vendor_name(text)
                if vendor == "Unknown":
                    self.logger.debug("Vendor inference returned Unknown")
                    return None
                else:
                    self.logger.debug(f"Inferred vendor: {vendor}", extra={
                        "extra_fields": {"event_type": "vendor_inferred", "vendor": vendor}
                    })
                    return vendor
            except Exception as exc:
                self.logger.warning(f"Vendor inference error: {exc}")
                return None
        return None
    
    def process_sequential(self, rows):
        """Process items sequentially with enhanced logging"""
        self.logger.info(f"Starting sequential processing of {len(rows)} items", extra={
            "extra_fields": {
                "event_type": "sequential_start",
                "total_items": len(rows)
            }
        })
        
        # Fix metrics reference for decorators
        for method in [self.enrich_single_item]:
            if hasattr(method, '__wrapped__'):
                method.__wrapped__.__globals__['metrics'] = self.metrics
        
        results = {"success": 0, "failed": 0, "skipped": 0}
        
        for i, row in enumerate(rows):
            result = self.enrich_single_item(row)
            results[result] += 1
            
            # Progress logging
            if (i + 1) % 5 == 0 or i == len(rows) - 1:
                self.logger.info(f"Progress: {i + 1}/{len(rows)} items processed", extra={
                    "extra_fields": {
                        "event_type": "progress_update",
                        "completed": i + 1,
                        "total": len(rows),
                        "current_results": results
                    }
                })
        
        self.metrics.log_summary()
        return results
    
    async def process_parallel(self, rows):
        """Process items in parallel using the parallel enricher"""
        try:
            from enrich_parallel import ParallelEnricher, ProcessingConfig
            
            self.logger.info(f"Starting parallel processing of {len(rows)} items", extra={
                "extra_fields": {
                    "event_type": "parallel_start",
                    "total_items": len(rows)
                }
            })
            
            config = ProcessingConfig()
            enricher = ParallelEnricher(config)
            results = await enricher.process_items_parallel(rows)
            
            # Aggregate results
            aggregated = {"success": 0, "failed": 0, "skipped": 0}
            for result in results:
                status = result.get("status", "failed")
                if status in aggregated:
                    aggregated[status] += 1
            
            return aggregated
            
        except ImportError as e:
            self.logger.error(f"Failed to import parallel enricher: {e}")
            self.logger.info("Falling back to sequential processing")
            return self.process_sequential(rows)
    
    def run(self):
        """Main run method with mode selection"""
        rows = inbox_rows(require_url=RSS_URL_PROP)
        if not rows:
            self.logger.info("No items found in inbox")
            print("🚩 Nothing in Inbox.")
            return
        
        self.logger.info(f"Found {len(rows)} items to enrich", extra={
            "extra_fields": {
                "event_type": "run_start",
                "total_items": len(rows),
                "processing_mode": "parallel" if self.enable_parallel else "sequential"
            }
        })
        
        print(f"🔍 Found {len(rows)} row(s) to enrich")
        print(f"🚀 Processing mode: {'Parallel' if self.enable_parallel else 'Sequential'}")
        
        if self.enable_parallel:
            results = asyncio.run(self.process_parallel(rows))
        else:
            results = self.process_sequential(rows)
        
        # Print summary
        print(f"\n📊 Enrichment Summary:")
        print(f"   Total pages found: {len(rows)}")
        print(f"   ✅ Successfully enriched: {results['success']}")
        print(f"   📦 Skipped (archived): {results['skipped']}")
        print(f"   ❌ Failed: {results['failed']}")

def main():
    """Enhanced main function with mode selection"""
    # Check for parallel mode flag
    enable_parallel = "--parallel" in sys.argv or os.getenv("ENABLE_PARALLEL", "false").lower() == "true"
    
    if "--help" in sys.argv:
        print("""
Enhanced RSS Enrichment
Usage: python enrich_rss_enhanced.py [options]

Options:
  --parallel    Enable parallel processing
  --original    Use original sequential implementation
  --help        Show this help message

Environment Variables:
  ENABLE_PARALLEL=true|false    Enable/disable parallel processing
  PARALLEL_MAX_WORKERS=5        Number of parallel workers
  PARALLEL_RATE_LIMIT=0.1       Rate limit delay between requests
  LOG_DIR=logs                  Directory for log files
        """)
        return
    
    if "--original" in sys.argv:
        print("🔄 Using original sequential implementation")
        original_main()
        return
    
    # Use enhanced implementation
    enricher = EnhancedEnricher(enable_parallel=enable_parallel)
    enricher.run()

if __name__ == "__main__":
    main()