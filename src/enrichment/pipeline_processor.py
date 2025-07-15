"""
Pipeline processor - The main enrichment orchestrator with advanced AI analysis.
"""
import json
import os
import time
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from ..core.config import PipelineConfig
from ..core.models import SourceContent, EnrichmentResult, ContentStatus
from ..core.notion_client import NotionClient
from ..utils.logging import setup_logger
from .advanced_summarizer import AdvancedContentSummarizer
from .advanced_classifier import AdvancedContentClassifier
from .advanced_insights import AdvancedInsightsGenerator
from .enhanced_summarizer import EnhancedContentSummarizer
from .enhanced_insights import EnhancedInsightsGenerator
from .technical_analyzer import TechnicalAnalyzer
from ..core.prompt_config import PromptConfig
from ..drive.pdf_processor import PDFProcessor
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
import re


class PipelineProcessor:
    """Main pipeline processor with sophisticated AI-powered enrichment."""
    
    def __init__(self, config: PipelineConfig, notion_client: NotionClient):
        """Initialize pipeline processor with advanced AI components."""
        self.config = config
        self.notion_client = notion_client
        self.logger = setup_logger(__name__)
        
        # Initialize prompt configuration
        self.prompt_config = PromptConfig()
        
        # Initialize advanced AI components with backward compatibility
        # Use enhanced versions if web search is enabled, otherwise use original
        if self.prompt_config.web_search_enabled:
            self.logger.info("Using enhanced analyzers with web search capability")
            self.enhanced_summarizer = EnhancedContentSummarizer(config, self.prompt_config)
            self.summarizer = self.enhanced_summarizer  # For backward compatibility
            self.enhanced_insights = EnhancedInsightsGenerator(config, self.prompt_config)
            self.insights_generator = self.enhanced_insights  # For backward compatibility
        else:
            self.summarizer = AdvancedContentSummarizer(config.openai)
            self.enhanced_summarizer = None
            self.insights_generator = AdvancedInsightsGenerator(config.openai)
            self.enhanced_insights = None
            
        self.classifier = AdvancedContentClassifier(config.openai, self._load_taxonomy())
        
        # Initialize additional analyzers if enabled
        self.additional_analyzers = []
        # Check if technical analysis is enabled
        if self.prompt_config.is_analyzer_enabled("technical"):
            self.logger.info("Technical analysis enabled")
            self.additional_analyzers.append(TechnicalAnalyzer(config, self.prompt_config))
        
        # Initialize content extraction components
        self.pdf_processor = PDFProcessor()
        
        # Initialize Drive service if credentials available
        self.drive_service = None
        if config.google_drive.service_account_path:
            try:
                credentials = Credentials.from_service_account_file(
                    config.google_drive.service_account_path
                )
                self.drive_service = build("drive", "v3", credentials=credentials, cache_discovery=False)
            except Exception as e:
                self.logger.warning(f"Could not initialize Drive service: {e}")
        
        # Quality control metrics
        self.quality_metrics = {
            "total_processed": 0,
            "total_quality_score": 0.0,
            "content_type_accuracy": [],
            "processing_times": []
        }
    
    def _load_taxonomy(self) -> Dict[str, List[str]]:
        """Load classification taxonomies from Notion database schema."""
        try:
            db_info = self.notion_client.client.databases.retrieve(
                self.notion_client.db_id
            )
            properties = db_info.get("properties", {})
            
            # Extract taxonomies
            taxonomy = {
                "content_types": self._extract_options(properties, "Content-Type", "select"),
                "ai_primitives": self._extract_options(properties, "AI-Primitive", "multi_select"),
                "vendors": self._extract_options(properties, "Vendor", "select")
            }
            
            self.logger.info(
                f"Loaded taxonomy: {len(taxonomy['content_types'])} content types, "
                f"{len(taxonomy['ai_primitives'])} AI primitives, "
                f"{len(taxonomy['vendors'])} vendors"
            )
            
            return taxonomy
            
        except Exception as e:
            self.logger.error(f"Failed to fetch taxonomy: {e}")
            return {"content_types": [], "ai_primitives": [], "vendors": []}
    
    def _extract_options(self, properties: Dict, prop_name: str, prop_type: str) -> List[str]:
        """Extract options from a Notion property."""
        if prop_name not in properties:
            return []
        
        prop_config = properties[prop_name].get(prop_type, {})
        options = prop_config.get("options", [])
        return [opt["name"] for opt in options]
    
    def process_batch(self, limit: Optional[int] = None) -> Dict[str, int]:
        """
        Process a batch of items with advanced enrichment and quality control.
        
        Returns:
            Dict with enhanced metrics: {"processed": n, "failed": n, "skipped": n, "quality_score": float}
        """
        stats = {"processed": 0, "failed": 0, "skipped": 0, "quality_score": 0.0}
        batch_quality_scores = []
        
        # Get items to process
        for item in self.notion_client.get_inbox_items(limit):
            try:
                self.logger.info(f"Processing: {item['properties']['Title']['title'][0]['text']['content']}")
                
                # Extract content
                content = self._extract_content(item)
                if not content:
                    self.logger.warning(f"No content found for item {item['id']}")
                    stats["skipped"] += 1
                    continue
                
                # Perform advanced enrichment
                result = self.enrich_content(content, item)
                
                # Store results with quality metadata
                self._store_results(item, result, content)
                
                stats["processed"] += 1
                
                # Track quality metrics
                if hasattr(result, 'quality_score'):
                    batch_quality_scores.append(result.quality_score)
                
                # Rate limiting
                time.sleep(self.config.rate_limit_delay)
                
            except Exception as e:
                self.logger.error(f"Failed to process item {item['id']}: {e}")
                self._mark_failed(item['id'], str(e))
                stats["failed"] += 1
        
        # Calculate batch quality score
        if batch_quality_scores:
            stats["quality_score"] = sum(batch_quality_scores) / len(batch_quality_scores)
            self.quality_metrics["total_processed"] += len(batch_quality_scores)
            self.quality_metrics["total_quality_score"] += sum(batch_quality_scores)
        
        self.logger.info(f"Pipeline enrichment complete: {stats}")
        return stats
    
    def enrich_content(self, content: str, item: Dict) -> EnrichmentResult:
        """
        Perform advanced AI enrichment with sophisticated prompting techniques.
        
        Args:
            content: The text content to analyze
            item: The Notion page item
            
        Returns:
            Enhanced EnrichmentResult with quality metrics
        """
        start_time = time.time()
        
        # Extract title
        title = item['properties']['Title']['title'][0]['text']['content']
        
        # Extract existing content type if already classified
        existing_content_type = None
        if 'Content-Type' in item['properties'] and item['properties']['Content-Type'].get('select'):
            existing_content_type = item['properties']['Content-Type']['select'].get('name')
        
        # Generate analyses with advanced components
        try:
            # FIRST: Run classification to get semantic content type
            classification = self.classifier.classify_content(content, title)
            
            # Use the semantic content type for all subsequent analyses
            # Ignore existing_content_type if it's just "PDF", "Email", etc.
            semantic_content_type = classification.get("content_type", "Other")
            
            # Log the content type being used
            self.logger.info(f"Using semantic content type '{semantic_content_type}' for analyses (was: {existing_content_type})")
            
            # Advanced multi-step summarization with semantic content type
            if self.enhanced_summarizer:
                core_summary = self.enhanced_summarizer.generate_summary(content, title, semantic_content_type)
            else:
                core_summary = self.summarizer.generate_summary(content, title)
            
            # Strategic insights with semantic content type
            if self.enhanced_insights:
                key_insights = self.enhanced_insights.generate_insights(content, title, semantic_content_type)
            else:
                key_insights = self.insights_generator.generate_insights(content, title)
            
            # Run additional analyzers with semantic content type
            additional_analyses = {}
            
            for analyzer in self.additional_analyzers:
                try:
                    analysis_result = analyzer.analyze(content, title, semantic_content_type)
                    if analysis_result.get("success"):
                        additional_analyses[analyzer.__class__.__name__] = analysis_result
                        self.logger.info(
                            f"{analyzer.__class__.__name__} completed "
                            f"(web_search: {analysis_result.get('web_search_used', False)})"
                        )
                except Exception as e:
                    self.logger.error(f"Additional analyzer {analyzer.__class__.__name__} failed: {e}")
            
        except Exception as e:
            self.logger.error(f"AI analysis failed: {e}")
            # Fallback to basic analysis
            core_summary = f"Analysis failed. Document '{title}' contains approximately {len(content)} characters of content."
            classification = {"content_type": "Other", "ai_primitives": [], "vendor": None, "confidence": "low"}
            key_insights = ["Content requires manual review due to processing error."]
            additional_analyses = {}  # Empty on fallback
        
        # Calculate processing time
        processing_time = time.time() - start_time
        self.quality_metrics["processing_times"].append(processing_time)
        
        # Calculate quality score based on multiple factors
        quality_score = self._calculate_quality_score(
            summary_length=len(core_summary),
            insights_count=len(key_insights),
            classification_confidence=classification.get("confidence", "medium"),
            processing_time=processing_time
        )
        
        # Token usage tracking (enhanced from base)
        token_usage = {
            "prompt_tokens": len(content) // 4,  # Rough estimate
            "completion_tokens": (len(core_summary) + len(str(key_insights))) // 4,
            "total_tokens": 0
        }
        token_usage["total_tokens"] = token_usage["prompt_tokens"] + token_usage["completion_tokens"]
        
        # Convert string confidence to numeric score
        confidence_str = classification.get("confidence", "medium")
        confidence_mapping = {"high": 0.9, "medium": 0.7, "low": 0.5}
        confidence_score = confidence_mapping.get(confidence_str, 0.7)
        
        # Create enhanced result
        result = EnrichmentResult(
            core_summary=core_summary,
            key_insights=key_insights,
            content_type=classification.get("content_type", "Other"),
            ai_primitives=classification.get("ai_primitives", []),
            vendor=classification.get("vendor"),
            confidence_scores={
                "classification": confidence_score,
                "overall_quality": quality_score
            },
            processing_time=processing_time,
            token_usage=token_usage
        )
        
        # Add quality metadata
        result.quality_score = quality_score
        result.classification_reasoning = classification.get("reasoning", "")
        
        # Add additional analyses if any
        if additional_analyses:
            result.additional_analyses = additional_analyses
        
        return result
    
    def _calculate_quality_score(self, summary_length: int, insights_count: int, 
                                classification_confidence: str, processing_time: float) -> float:
        """Calculate a quality score for the enrichment."""
        score = 0.0
        
        # Summary quality (0-0.3)
        if summary_length > 500:
            score += 0.3
        elif summary_length > 200:
            score += 0.2
        elif summary_length > 100:
            score += 0.1
        
        # Insights quality (0-0.3)
        if insights_count >= 5:
            score += 0.3
        elif insights_count >= 3:
            score += 0.2
        elif insights_count >= 1:
            score += 0.1
        
        # Classification confidence (0-0.3)
        confidence_scores = {"high": 0.3, "medium": 0.2, "low": 0.1}
        score += confidence_scores.get(classification_confidence, 0.1)
        
        # Processing efficiency (0-0.1)
        if processing_time < 10:
            score += 0.1
        elif processing_time < 20:
            score += 0.05
        
        return min(score, 1.0)  # Cap at 1.0
    
    def _extract_content(self, item: Dict) -> Optional[str]:
        """Extract content from various sources."""
        # Check for Drive URL
        drive_url = item['properties'].get('Drive URL', {}).get('url')
        if drive_url:
            return self._extract_drive_content(drive_url)
        
        # Check for Article URL
        article_url = item['properties'].get('Article URL', {}).get('url')
        if article_url:
            return self._extract_web_content(article_url)
        
        # Check existing page content
        return self._extract_page_content(item['id'])
    
    def _extract_drive_content(self, drive_url: str) -> Optional[str]:
        """Extract content from Google Drive with enhanced error handling."""
        if not self.drive_service:
            self.logger.error("Google Drive service not initialized")
            return None
            
        try:
            # Extract file ID from Drive URL
            file_id = self._extract_drive_file_id(drive_url)
            if not file_id:
                self.logger.error(f"Could not extract file ID from URL: {drive_url}")
                return None
            
            # Download PDF content
            pdf_content = self.pdf_processor.download_file(self.drive_service, file_id)
            
            # Extract text from PDF
            text_content = self.pdf_processor.extract_text_from_pdf(pdf_content)
            
            if not text_content:
                self.logger.warning(f"No text extracted from PDF: {drive_url}")
                return None
                
            self.logger.info(f"Successfully extracted {len(text_content)} characters from Drive PDF")
            return text_content
            
        except Exception as e:
            self.logger.error(f"Failed to extract Drive content: {e}")
            return None
    
    def _extract_drive_file_id(self, drive_url: str) -> Optional[str]:
        """Extract Google Drive file ID from URL."""
        try:
            # Handle various Google Drive URL formats
            # Format: https://drive.google.com/file/d/FILE_ID/view
            # Format: https://drive.google.com/open?id=FILE_ID
            if "/d/" in drive_url:
                return drive_url.split("/d/")[1].split("/")[0]
            elif "id=" in drive_url:
                return drive_url.split("id=")[1].split("&")[0]
            else:
                return None
        except Exception as e:
            self.logger.error(f"Error parsing Drive URL {drive_url}: {e}")
            return None
    
    def _extract_web_content(self, article_url: str) -> Optional[str]:
        """Extract content from web URL with multiple fallback strategies."""
        import os
        import requests
        from tenacity import retry, wait_exponential, stop_after_attempt
        
        # Try Firecrawl API first
        api_key = os.getenv("FIRECRAWL_API_KEY")
        if api_key:
            try:
                headers = {
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
                
                payload = {
                    "url": article_url,
                    "formats": ["markdown"],
                    "onlyMainContent": True
                }
                
                response = requests.post(
                    "https://api.firecrawl.dev/v1/scrape",
                    headers=headers,
                    json=payload,
                    timeout=30
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success"):
                        content = data.get("data", {}).get("markdown")
                        if content:
                            self.logger.info(f"Successfully extracted {len(content)} characters from web URL using Firecrawl")
                            return content
                
                self.logger.warning(f"Firecrawl extraction failed, falling back to basic method")
                
            except Exception as e:
                self.logger.error(f"Failed to extract web content with Firecrawl: {e}")
        
        # Fallback to basic extraction
        return self._extract_web_content_basic(article_url)
    
    def _extract_web_content_basic(self, article_url: str) -> Optional[str]:
        """Basic web content extraction using requests and BeautifulSoup."""
        try:
            import requests
            from bs4 import BeautifulSoup
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            
            response = requests.get(article_url, headers=headers, timeout=15)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Remove unwanted elements
            for element in soup(['script', 'style', 'nav', 'footer', 'header', 'aside']):
                element.decompose()
            
            # Try to find main content
            main_content = None
            content_selectors = ['article', 'main', '[role="main"]', '.content', '.post-content']
            
            for selector in content_selectors:
                main_content = soup.select_one(selector)
                if main_content:
                    break
            
            if not main_content:
                main_content = soup
            
            # Extract text
            text = main_content.get_text(separator='\n', strip=True)
            
            if text and len(text) > 100:  # Minimum content length
                self.logger.info(f"Successfully extracted {len(text)} characters using basic method")
                return text
            else:
                self.logger.warning(f"Insufficient content extracted from {article_url}")
                return None
                
        except Exception as e:
            self.logger.error(f"Failed to extract web content: {e}")
            return None
    
    def _extract_page_content(self, page_id: str) -> Optional[str]:
        """Extract existing content from Notion page with enhanced parsing."""
        try:
            blocks = self.notion_client.client.blocks.children.list(block_id=page_id)
            content_parts = []
            
            for block in blocks['results']:
                block_type = block.get('type')
                text_content = None
                
                # Extract text from different block types
                if block_type == 'paragraph':
                    text_content = self._extract_rich_text(block['paragraph'].get('rich_text', []))
                elif block_type == 'heading_1':
                    text_content = self._extract_rich_text(block['heading_1'].get('rich_text', []))
                elif block_type == 'heading_2':
                    text_content = self._extract_rich_text(block['heading_2'].get('rich_text', []))
                elif block_type == 'heading_3':
                    text_content = self._extract_rich_text(block['heading_3'].get('rich_text', []))
                elif block_type == 'bulleted_list_item':
                    text_content = self._extract_rich_text(block['bulleted_list_item'].get('rich_text', []))
                elif block_type == 'numbered_list_item':
                    text_content = self._extract_rich_text(block['numbered_list_item'].get('rich_text', []))
                elif block_type == 'toggle':
                    text_content = self._extract_rich_text(block['toggle'].get('rich_text', []))
                elif block_type == 'code':
                    text_content = self._extract_rich_text(block['code'].get('rich_text', []))
                elif block_type == 'quote':
                    text_content = self._extract_rich_text(block['quote'].get('rich_text', []))
                
                if text_content and text_content.strip():
                    content_parts.append(text_content.strip())
            
            content = '\n'.join(content_parts) if content_parts else None
            
            if content and len(content) > 50:  # Minimum content threshold
                self.logger.info(f"Successfully extracted {len(content)} characters from Notion page")
                return content
            else:
                self.logger.warning(f"Insufficient content found in Notion page {page_id}")
                return None
            
        except Exception as e:
            self.logger.error(f"Failed to extract page content: {e}")
            return None
    
    def _extract_rich_text(self, rich_text_array: List[Dict]) -> str:
        """Extract plain text from Notion rich text array."""
        if not rich_text_array:
            return ""
        
        text_parts = []
        for text_item in rich_text_array:
            if text_item.get('type') == 'text':
                text_parts.append(text_item.get('text', {}).get('content', ''))
            elif text_item.get('plain_text'):
                text_parts.append(text_item['plain_text'])
        
        return ''.join(text_parts)
    
    def _store_results(self, item: Dict, result: EnrichmentResult, raw_content: str):
        """Store enrichment results with enhanced metadata and quality metrics."""
        page_id = item['id']
        
        # Update properties
        properties = {
            "Status": {"select": {"name": "Enriched"}},
            "Summary": {"rich_text": [{"text": {"content": result.core_summary[:200]}}]},
            "Content-Type": {"select": {"name": result.content_type}},
        }
        
        if result.ai_primitives:
            properties["AI-Primitive"] = {
                "multi_select": [{"name": p} for p in result.ai_primitives]
            }
        
        if result.vendor:
            properties["Vendor"] = {"select": {"name": result.vendor}}
        
        self.notion_client.client.pages.update(page_id=page_id, properties=properties)
        
        # Add enhanced content blocks
        blocks = self._create_content_blocks(result, raw_content)
        self.notion_client.add_content_blocks(page_id, blocks)
        
        # Log quality metrics
        if hasattr(result, 'quality_score'):
            self.logger.info(f"Content enriched with quality score: {result.quality_score:.2f}")
    
    def _create_content_blocks(self, result: EnrichmentResult, raw_content: str) -> List[Dict]:
        """Create Notion blocks for enriched content with quality indicators."""
        blocks = []
        
        # Raw Content toggle
        blocks.append({
            "object": "block",
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": "📄 Raw Content"}}],
                "children": self._chunk_text_to_blocks(raw_content)
            }
        })
        
        # Core Summary toggle (enhanced with quality indicator)
        quality_indicator = ""
        if hasattr(result, 'quality_score'):
            if result.quality_score >= 0.8:
                quality_indicator = " ⭐"
            elif result.quality_score >= 0.6:
                quality_indicator = " ✓"
        
        blocks.append({
            "object": "block",
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": f"📋 Core Summary{quality_indicator}"}}],
                "children": self._markdown_to_blocks(result.core_summary)
            }
        })
        
        # Key Insights toggle
        insights_text = "\n".join(f"• {insight}" for insight in result.key_insights)
        blocks.append({
            "object": "block",
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": "💡 Key Insights"}}],
                "children": self._markdown_to_blocks(insights_text)
            }
        })
        
        # Classification toggle (enhanced with reasoning)
        classification_text = f"""
**Content Type**: {result.content_type}
**AI Primitives**: {', '.join(result.ai_primitives)}
**Vendor**: {result.vendor or 'N/A'}
**Confidence**: {result.confidence_scores.get('classification', 0.7):.0%}
"""
        
        if hasattr(result, 'classification_reasoning') and result.classification_reasoning:
            classification_text += f"\n**Reasoning**: {result.classification_reasoning}"
        
        blocks.append({
            "object": "block",
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": "🎯 Classification"}}],
                "children": self._markdown_to_blocks(classification_text)
            }
        })
        
        # Processing Metadata toggle (new)
        if hasattr(result, 'quality_score'):
            metadata_text = f"""
**Quality Score**: {result.quality_score:.2f}/1.00
**Processing Time**: {result.processing_time:.2f}s
**Token Usage**: {result.token_usage.get('total_tokens', 0):,} tokens
"""
            blocks.append({
                "object": "block",
                "type": "toggle",
                "toggle": {
                    "rich_text": [{"type": "text", "text": {"content": "📊 Processing Metadata"}}],
                    "children": self._markdown_to_blocks(metadata_text)
                }
            })
        
        # Additional analyses toggles (new)
        if hasattr(result, 'additional_analyses'):
            for analyzer_name, analysis in result.additional_analyses.items():
                blocks.append({
                    "object": "block",
                    "type": "toggle",
                    "toggle": {
                        "rich_text": [{"type": "text", "text": {"content": analysis.get("toggle_title", "🔍 Additional Analysis")}}],
                        "children": self._markdown_to_blocks(analysis.get("analysis", ""))
                    }
                })
        
        return blocks
    
    def _chunk_text_to_blocks(self, text: str, max_length: int = 1900) -> List[Dict]:
        """Chunk text into Notion paragraph blocks."""
        blocks = []
        
        for i in range(0, len(text), max_length):
            chunk = text[i:i + max_length]
            blocks.append({
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"type": "text", "text": {"content": chunk}}]
                }
            })
        
        return blocks
    
    def _markdown_to_blocks(self, markdown: str) -> List[Dict]:
        """Convert markdown to Notion blocks."""
        # Use the existing chunk method that respects Notion's character limits
        # This will create far fewer blocks by putting ~1900 chars in each block
        return self._chunk_text_to_blocks(markdown, max_length=1900)
    
    def _mark_failed(self, page_id: str, error_msg: str):
        """Mark a page as failed with detailed error analysis."""
        self.notion_client.update_page_status(
            page_id, 
            ContentStatus.FAILED,
            f"Pipeline processing failed: {error_msg}"
        )
    
    def get_quality_report(self) -> Dict[str, Any]:
        """Get a report of quality metrics collected during processing."""
        avg_quality = 0.0
        if self.quality_metrics["total_processed"] > 0:
            avg_quality = self.quality_metrics["total_quality_score"] / self.quality_metrics["total_processed"]
        
        avg_processing_time = 0.0
        if self.quality_metrics["processing_times"]:
            avg_processing_time = sum(self.quality_metrics["processing_times"]) / len(self.quality_metrics["processing_times"])
        
        return {
            "total_processed": self.quality_metrics["total_processed"],
            "average_quality_score": avg_quality,
            "average_processing_time": avg_processing_time,
            "processing_time_range": {
                "min": min(self.quality_metrics["processing_times"]) if self.quality_metrics["processing_times"] else 0,
                "max": max(self.quality_metrics["processing_times"]) if self.quality_metrics["processing_times"] else 0
            }
        }