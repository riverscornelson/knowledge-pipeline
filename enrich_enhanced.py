"""
Enhanced PDF enrichment with structured logging and monitoring
Backward compatible with existing pipeline while adding performance tracking
"""
import os
import sys
import time
from dotenv import load_dotenv

# Import original functions for compatibility
from enrich import (
    inbox_rows, drive_id, download_pdf, extract_text, io,
    summarise, summarise_exec, classify, notion_update,
    add_summary_block, add_exec_summary_block, add_fulltext_blocks,
    main as original_main
)
from postprocess import post_process_page
from infer_vendor import infer_vendor_name

# Import new logging
from logger import setup_logger, PipelineMetrics, track_performance, track_api_call

load_dotenv()

class EnhancedPDFEnricher:
    """Enhanced PDF enricher with logging and performance tracking"""
    
    def __init__(self):
        self.logger = setup_logger("pdf_enricher")
        self.metrics = PipelineMetrics(self.logger)
        
        self.logger.info("Enhanced PDF enricher initialized", extra={
            "extra_fields": {"event_type": "enricher_init"}
        })
    
    @track_performance(None, "pdf_document")
    def enrich_single_pdf(self, row):
        """Enrich a single PDF with performance tracking"""
        title = row["properties"]["Title"]["title"][0]["plain_text"]
        item_id = row["id"]
        
        self.logger.info(f"Processing PDF: {title}", extra={
            "extra_fields": {
                "event_type": "item_start",
                "item_id": item_id,
                "title": title
            }
        })
        
        try:
            drive_prop = row["properties"].get("Drive URL")
            url = drive_prop.get("url") if drive_prop else None
            
            if not url:
                raise ValueError("No Drive URL found")
            
            # Download and extract PDF content
            fid = drive_id(url)
            
            self.logger.debug("Downloading PDF", extra={
                "extra_fields": {
                    "event_type": "pdf_download_start",
                    "file_id": fid,
                    "url": url
                }
            })
            
            pdf_bytes = self._download_with_logging(fid)
            pdf_text = self._extract_text_with_logging(pdf_bytes)
            
            if not pdf_text.strip():
                raise ValueError("empty text after extraction")
            
            self.logger.debug(f"Extracted PDF content", extra={
                "extra_fields": {
                    "event_type": "pdf_extracted",
                    "content_length": len(pdf_text),
                    "file_size": len(pdf_bytes)
                }
            })
            
            # AI processing with API tracking
            summary = self._summarise_with_logging(pdf_text)
            add_summary_block(item_id, summary)
            add_fulltext_blocks(item_id, pdf_text)
            
            exec_summary = self._summarise_exec_with_logging(pdf_text)
            add_exec_summary_block(item_id, exec_summary)
            
            ctype, prim = self._classify_with_logging(pdf_text)
            
            vendor = self._infer_vendor_with_logging(row, exec_summary or pdf_text)
            
            # Post-processing
            self.logger.debug("Running post-processing", extra={
                "extra_fields": {"event_type": "post_processing"}
            })
            post_process_page(item_id, pdf_text)
            
            # Update Notion
            notion_update(item_id, "Enriched", exec_summary, ctype, prim, vendor)
            
            self.logger.info(f"Successfully enriched PDF: {title}", extra={
                "extra_fields": {
                    "event_type": "item_complete",
                    "item_id": item_id,
                    "title": title,
                    "content_type": ctype,
                    "ai_primitive": prim,
                    "vendor": vendor,
                    "content_length": len(pdf_text)
                }
            })
            
            return "success"
            
        except Exception as err:
            self.logger.error(f"Failed to enrich PDF {title}: {str(err)}", extra={
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
    
    def _download_with_logging(self, file_id: str) -> bytes:
        """Download PDF with API call tracking"""
        @track_api_call(self.metrics, "drive")
        def _download():
            return download_pdf(file_id)
        return _download()
    
    def _extract_text_with_logging(self, pdf_bytes: bytes) -> str:
        """Extract text with performance tracking"""
        start_time = time.time()
        text = extract_text(io.BytesIO(pdf_bytes))
        duration = time.time() - start_time
        
        self.logger.debug(f"PDF text extraction completed", extra={
            "extra_fields": {
                "event_type": "text_extraction",
                "duration": duration,
                "input_size": len(pdf_bytes),
                "output_length": len(text)
            }
        })
        
        return text
    
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
    
    def process_pdfs(self, rows):
        """Process PDFs with enhanced logging"""
        self.logger.info(f"Starting PDF processing of {len(rows)} items", extra={
            "extra_fields": {
                "event_type": "processing_start",
                "total_items": len(rows)
            }
        })
        
        # Fix metrics reference for decorators
        for method in [self.enrich_single_pdf]:
            if hasattr(method, '__wrapped__'):
                method.__wrapped__.__globals__['metrics'] = self.metrics
        
        results = {"success": 0, "failed": 0}
        
        for i, row in enumerate(rows):
            result = self.enrich_single_pdf(row)
            results[result] += 1
            
            # Progress logging
            if (i + 1) % 3 == 0 or i == len(rows) - 1:
                self.logger.info(f"Progress: {i + 1}/{len(rows)} PDFs processed", extra={
                    "extra_fields": {
                        "event_type": "progress_update",
                        "completed": i + 1,
                        "total": len(rows),
                        "current_results": results
                    }
                })
            
            # Rate limiting (kept from original)
            time.sleep(0.3)
        
        self.metrics.log_summary()
        return results
    
    def run(self):
        """Main run method"""
        rows = inbox_rows(require_url="Drive URL")
        if not rows:
            self.logger.info("No PDF items found in inbox")
            print("🚩 Nothing in Inbox.")
            return
        
        self.logger.info(f"Found {len(rows)} PDFs to enrich", extra={
            "extra_fields": {
                "event_type": "run_start",
                "total_items": len(rows)
            }
        })
        
        print(f"🔍 Found {len(rows)} PDF(s) to enrich")
        
        results = self.process_pdfs(rows)
        
        # Print summary
        print(f"\n📊 PDF Enrichment Summary:")
        print(f"   Total PDFs found: {len(rows)}")
        print(f"   ✅ Successfully enriched: {results['success']}")
        print(f"   ❌ Failed: {results['failed']}")

def main():
    """Enhanced main function"""
    if "--help" in sys.argv:
        print("""
Enhanced PDF Enrichment
Usage: python enrich_enhanced.py [options]

Options:
  --original    Use original sequential implementation
  --help        Show this help message

Environment Variables:
  LOG_DIR=logs                  Directory for log files
        """)
        return
    
    if "--original" in sys.argv:
        print("🔄 Using original PDF implementation")
        original_main()
        return
    
    # Use enhanced implementation
    enricher = EnhancedPDFEnricher()
    enricher.run()

if __name__ == "__main__":
    main()