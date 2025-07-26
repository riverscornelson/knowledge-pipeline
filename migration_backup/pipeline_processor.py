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
from .content_tagger import ContentTagger
from ..utils.notion_formatter import NotionFormatter  # Enhanced formatting
from ..core.prompt_config import PromptConfig
from ..core.prompt_config_enhanced import EnhancedPromptConfig
# Import enhanced attribution formatter later to avoid circular import
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
        # Use enhanced config if NOTION_PROMPTS_DB_ID is set
        if os.getenv('NOTION_PROMPTS_DB_ID'):
            self.logger.info("Using enhanced prompt configuration with Notion database")
            self.prompt_config = EnhancedPromptConfig(
                notion_db_id=os.getenv('NOTION_PROMPTS_DB_ID')
            )
        else:
            self.logger.info("Using standard prompt configuration from YAML")
            self.prompt_config = PromptConfig()
        
        # Initialize Notion formatter for enhanced content presentation
        self.notion_formatter = NotionFormatter()
        self.use_enhanced_formatting = os.getenv('USE_ENHANCED_FORMATTING', 'true').lower() == 'true'
        
        # Initialize enhanced attribution formatter (import here to avoid circular import)
        try:
            from ..formatters.enhanced_attribution_formatter import EnhancedAttributionFormatter
            self.attribution_formatter = EnhancedAttributionFormatter(prompt_config=self.prompt_config)
        except ImportError:
            self.logger.warning("Enhanced attribution formatter not available")
            self.attribution_formatter = None
        if self.use_enhanced_formatting:
            self.logger.info("Enhanced Notion formatting enabled")
        
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
        
        # Initialize content tagger
        tagger_config = self.prompt_config.get_prompt("tagger", None)
        if tagger_config.get("enabled", True):  # Default to enabled
            self.logger.info("Initializing ContentTagger for intelligent tagging")
            self.content_tagger = ContentTagger(config, notion_client, self.prompt_config)
        else:
            self.content_tagger = None
            self.logger.info("ContentTagger disabled by configuration")
        
        # Initialize additional analyzers if enabled
        self.additional_analyzers = []
        
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
            "processing_times": [],
            "quality_breakdown": {
                "summary_scores": [],
                "insights_scores": [],
                "classification_scores": [],
                "efficiency_scores": []
            },
            "content_type_performance": {},
            "validation_failures": []
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
                    
                    # Track content type performance
                    content_type = result.content_type
                    if content_type not in self.quality_metrics["content_type_performance"]:
                        self.quality_metrics["content_type_performance"][content_type] = {
                            "count": 0,
                            "total_score": 0.0,
                            "processing_times": []
                        }
                    
                    self.quality_metrics["content_type_performance"][content_type]["count"] += 1
                    self.quality_metrics["content_type_performance"][content_type]["total_score"] += result.quality_score
                    self.quality_metrics["content_type_performance"][content_type]["processing_times"].append(result.processing_time)
                
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
            summary_result = None
            if self.enhanced_summarizer:
                # Get full result to capture web citations
                summary_result = self.enhanced_summarizer.analyze(content, title, semantic_content_type)
                core_summary = summary_result.get("analysis", "") if summary_result.get("success") else ""
                if not core_summary:
                    core_summary = self.summarizer.generate_summary(content, title)
            else:
                core_summary = self.summarizer.generate_summary(content, title)
            
            # Strategic insights with semantic content type
            insights_result = None
            if self.enhanced_insights:
                # Get full result to capture web citations
                insights_result = self.enhanced_insights.analyze(content, title, semantic_content_type)
                key_insights = []
                if insights_result.get("success") and insights_result.get("analysis"):
                    # Parse insights from the analysis text
                    insights_text = insights_result["analysis"]
                    # Extract bullet points or numbered items, but skip section headers
                    import re
                    # Split by lines and process each line
                    lines = insights_text.split('\n')
                    for line in lines:
                        line = line.strip()
                        # Skip empty lines and markdown headers
                        if not line or line.startswith('#'):
                            continue
                        # Extract bullet point content
                        bullet_match = re.match(r'^[•\-\*]\s*(.+)$', line)
                        if bullet_match:
                            insight = bullet_match.group(1).strip()
                            # Skip if it looks like a section header (ends with colon or contains "Actions", "Opportunities", etc.)
                            if not (insight.endswith(':') or 
                                    any(header in insight for header in ['Immediate Actions', 'Strategic Opportunities', 
                                                                         'Risk Factors', 'Market Implications', 
                                                                         'Innovation Potential'])):
                                key_insights.append(insight)
                if not key_insights:
                    key_insights = self.insights_generator.generate_insights(content, title)
            else:
                key_insights = self.insights_generator.generate_insights(content, title)
            
            # Generate content tags if enabled
            tag_result = None
            if self.content_tagger:
                try:
                    tag_result = self.content_tagger.analyze(content, title, semantic_content_type)
                    if tag_result.get("success"):
                        self.logger.info(
                            f"ContentTagger generated {len(tag_result.get('topical_tags', []))} topical and "
                            f"{len(tag_result.get('domain_tags', []))} domain tags"
                        )
                except Exception as e:
                    self.logger.error(f"ContentTagger failed: {e}")
                    tag_result = None
            
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
            tag_result = None  # No tags on fallback
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
        
        # Store the full structured insights text if available
        if insights_result and insights_result.get("success"):
            result.structured_insights = insights_result.get("analysis", "")
        
        # Add quality metadata
        result.quality_score = quality_score
        result.classification_reasoning = classification.get("reasoning", "")
        
        # Add detailed quality validation metadata
        result.temperature = getattr(self.summarizer, 'temperature', 0.3)
        result.web_search_used = getattr(self.enhanced_summarizer, 'web_search_enabled', False) if self.enhanced_summarizer else False
        
        # Add web citations from analyzer results
        result.summary_web_citations = summary_result.get("web_citations", []) if summary_result else []
        result.insights_web_citations = insights_result.get("web_citations", []) if insights_result else []
        result.summary_web_search_used = summary_result.get("web_search_used", False) if summary_result else False
        result.insights_web_search_used = insights_result.get("web_search_used", False) if insights_result else False
        
        # Track prompt configuration used
        result.prompt_config = {
            "content_type": semantic_content_type,
            "original_type": existing_content_type,
            "prompt_version": "2.0",
            "analyzers_used": ["summarizer", "classifier", "insights"] + list(additional_analyses.keys())
        }
        
        # Add additional analyses if any
        if additional_analyses:
            result.additional_analyses = additional_analyses
        
        # Track prompt sources and page IDs from analyzer results
        if summary_result and summary_result.get('prompt_source'):
            result.summary_prompt_source = summary_result['prompt_source']
            if summary_result.get('prompt_page_id'):
                result.summary_prompt_page_id = summary_result['prompt_page_id']
        if insights_result and insights_result.get('prompt_source'):
            result.insights_prompt_source = insights_result['prompt_source']
            if insights_result.get('prompt_page_id'):
                result.insights_prompt_page_id = insights_result['prompt_page_id']
        if tag_result and tag_result.get('prompt_source'):
            result.tagger_prompt_source = tag_result['prompt_source']
            if tag_result.get('prompt_page_id'):
                result.tagger_prompt_page_id = tag_result['prompt_page_id']
        
        # Add tag results if available
        if tag_result and tag_result.get("success"):
            result.topical_tags = tag_result.get("topical_tags", [])
            result.domain_tags = tag_result.get("domain_tags", [])
            result.tag_metadata = {
                "reasoning": tag_result.get("tag_selection_reasoning", {}),
                "confidence": tag_result.get("confidence_scores", {}),
                "cache_size": tag_result.get("existing_tags_cache", {})
            }
        
        return result
    
    def _calculate_quality_score(self, summary_length: int, insights_count: int, 
                                classification_confidence: str, processing_time: float) -> float:
        """Calculate a quality score for the enrichment and track detailed metrics."""
        score = 0.0
        
        # Summary quality (0-0.3)
        summary_score = 0.0
        if summary_length > 500:
            summary_score = 0.3
        elif summary_length > 200:
            summary_score = 0.2
        elif summary_length > 100:
            summary_score = 0.1
        score += summary_score
        self.quality_metrics["quality_breakdown"]["summary_scores"].append(summary_score)
        
        # Insights quality (0-0.3)
        insights_score = 0.0
        if insights_count >= 5:
            insights_score = 0.3
        elif insights_count >= 3:
            insights_score = 0.2
        elif insights_count >= 1:
            insights_score = 0.1
        score += insights_score
        self.quality_metrics["quality_breakdown"]["insights_scores"].append(insights_score)
        
        # Classification confidence (0-0.3)
        confidence_scores = {"high": 0.3, "medium": 0.2, "low": 0.1}
        classification_score = confidence_scores.get(classification_confidence, 0.1)
        score += classification_score
        self.quality_metrics["quality_breakdown"]["classification_scores"].append(classification_score)
        
        # Processing efficiency (0-0.1)
        efficiency_score = 0.0
        if processing_time < 10:
            efficiency_score = 0.1
        elif processing_time < 20:
            efficiency_score = 0.05
        score += efficiency_score
        self.quality_metrics["quality_breakdown"]["efficiency_scores"].append(efficiency_score)
        
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
            
            # Log content length for debugging
            if len(text_content) > 50000:
                self.logger.info(f"Large document detected: {len(text_content)} chars - processing full content")
            
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
        """Extract content from web URL using basic extraction."""
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
            "Content-Type": {"select": {"name": result.content_type}},
        }
        
        if result.ai_primitives:
            properties["AI-Primitive"] = {
                "multi_select": [{"name": p} for p in result.ai_primitives]
            }
        
        if result.vendor:
            properties["Vendor"] = {"select": {"name": result.vendor}}
        
        # Add tags if available
        if hasattr(result, 'topical_tags') and result.topical_tags:
            properties["Topical-Tags"] = {
                "multi_select": [{"name": tag} for tag in result.topical_tags]
            }
        
        if hasattr(result, 'domain_tags') and result.domain_tags:
            properties["Domain-Tags"] = {
                "multi_select": [{"name": tag} for tag in result.domain_tags]
            }
        
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
        
        # Add enhanced attribution dashboard
        if hasattr(self, 'attribution_formatter'):
            try:
                # Create analyzer results for attribution
                analyzer_results = self._create_analyzer_results_for_attribution(result)
                
                # Track prompt sources and page IDs
                prompt_sources = self._track_prompt_sources_from_result(result)
                notion_page_ids = self._track_notion_page_ids_from_result(result)
                
                # Create attribution dashboard with hyperlinks
                attribution_blocks = self.attribution_formatter.create_attribution_dashboard(
                    analyzer_results,
                    result.processing_time,
                    prompt_sources,
                    notion_page_ids
                )
                blocks.extend(attribution_blocks)
                blocks.append({"type": "divider", "divider": {}})
                self.logger.info("Added enhanced attribution dashboard")
            except Exception as e:
                self.logger.error(f"Failed to create attribution dashboard: {e}")
        
        # Try enhanced formatting if enabled
        if self.use_enhanced_formatting:
            try:
                # Create combined content for formatting
                combined_content = self._create_combined_content_for_formatting(result)
                content_type = result.content_type.lower().replace(" ", "_") if result.content_type else None
                
                # Apply enhanced formatting
                formatted_blocks = self.notion_formatter.format_content(combined_content, content_type)
                if formatted_blocks:
                    blocks.extend(formatted_blocks)
                    self.logger.info(f"Applied enhanced formatting: {len(formatted_blocks)} blocks created")
                    
                    # Add divider before raw content
                    blocks.append({"type": "divider", "divider": {}})
            except Exception as e:
                self.logger.error(f"Enhanced formatting failed, using original: {e}")
                # Continue with original formatting below
        
        
        # Raw Content toggle - limit to 100 children per Notion API requirements
        raw_content_blocks = self._chunk_text_to_blocks(raw_content)
        if len(raw_content_blocks) > 100:
            # Split into multiple toggles if too many blocks
            self.logger.warning(f"Raw content has {len(raw_content_blocks)} blocks, splitting into multiple toggles")
            for i in range(0, len(raw_content_blocks), 100):
                chunk_blocks = raw_content_blocks[i:i+100]
                part_num = (i // 100) + 1
                total_parts = (len(raw_content_blocks) + 99) // 100
                blocks.append({
                    "object": "block",
                    "type": "toggle",
                    "toggle": {
                        "rich_text": [{"type": "text", "text": {"content": f"📄 Raw Content (Part {part_num}/{total_parts})"}}],
                        "children": chunk_blocks
                    }
                })
        else:
            blocks.append({
                "object": "block",
                "type": "toggle",
                "toggle": {
                    "rich_text": [{"type": "text", "text": {"content": "📄 Raw Content"}}],
                    "children": raw_content_blocks
                }
            })
        
        # Core Summary toggle (enhanced with quality indicator)
        quality_indicator = ""
        if hasattr(result, 'quality_score'):
            if result.quality_score >= 0.8:
                quality_indicator = " ⭐"
            elif result.quality_score >= 0.6:
                quality_indicator = " ✓"
        
        # Create summary children blocks with citations if available
        summary_children = self._markdown_to_blocks(result.core_summary)
        
        # Add web search citations if available
        if hasattr(result, 'summary_web_citations') and result.summary_web_citations:
            citation_text = self._format_web_citations(result.summary_web_citations)
            summary_children.extend(self._markdown_to_blocks(citation_text))
        
        blocks.append({
            "object": "block",
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": f"📋 Core Summary{quality_indicator}"}}],
                "children": summary_children
            }
        })
        
        # Key Insights toggle
        # Use structured insights if available, otherwise fall back to bullet list
        if hasattr(result, 'structured_insights') and result.structured_insights:
            # Use the NotionFormatter to properly format the structured insights
            formatter = NotionFormatter()
            insights_children = formatter.format_content(result.structured_insights, content_type="insights")
        else:
            # Fallback to simple bullet list
            insights_text = "\n".join(f"• {insight}" for insight in result.key_insights)
            insights_children = self._markdown_to_blocks(insights_text)
        
        # Add web search citations if available
        if hasattr(result, 'insights_web_citations') and result.insights_web_citations:
            citation_text = self._format_web_citations(result.insights_web_citations)
            insights_children.extend(self._markdown_to_blocks(citation_text))
        
        blocks.append({
            "object": "block",
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": "💡 Key Insights"}}],
                "children": insights_children
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
        
        # Tags toggle (if available)
        if hasattr(result, 'topical_tags') and (result.topical_tags or result.domain_tags):
            tags_text = f"""
**Topical Tags**: {', '.join(result.topical_tags) if result.topical_tags else 'None'}
**Domain Tags**: {', '.join(result.domain_tags) if result.domain_tags else 'None'}
"""
            
            # Add tag metadata if available
            if hasattr(result, 'tag_metadata') and result.tag_metadata:
                reasoning = result.tag_metadata.get('reasoning', {})
                if reasoning.get('existing_tags_used'):
                    tags_text += f"\n**Existing Tags Used**: {', '.join(reasoning['existing_tags_used'])}"
                if reasoning.get('new_tags_created'):
                    tags_text += f"\n**New Tags Created**: {', '.join(reasoning['new_tags_created'])}"
                
                cache_info = result.tag_metadata.get('cache_size', {})
                if cache_info:
                    tags_text += f"\n**Tag Cache**: {cache_info.get('topical_count', 0)} topical, {cache_info.get('domain_count', 0)} domain tags available"
            
            blocks.append({
                "object": "block",
                "type": "toggle",
                "toggle": {
                    "rich_text": [{"type": "text", "text": {"content": "🏷️ Content Tags"}}],
                    "children": self._markdown_to_blocks(tags_text)
                }
            })
        
        # Processing Metadata toggle (new)
        if hasattr(result, 'quality_score'):
            # Add web search status to metadata
            web_search_status = []
            if hasattr(result, 'summary_web_search_used') and result.summary_web_search_used:
                web_search_status.append(f"Summary ({len(getattr(result, 'summary_web_citations', []))} sources)")
            if hasattr(result, 'insights_web_search_used') and result.insights_web_search_used:
                web_search_status.append(f"Insights ({len(getattr(result, 'insights_web_citations', []))} sources)")
            
            web_search_line = "**Web Search**: " + (", ".join(web_search_status) if web_search_status else "Not used")
            
            metadata_text = f"""
**Quality Score**: {result.quality_score:.2f}/1.00
**Processing Time**: {result.processing_time:.2f}s
**Token Usage**: {result.token_usage.get('total_tokens', 0):,} tokens
{web_search_line}
"""
            blocks.append({
                "object": "block",
                "type": "toggle",
                "toggle": {
                    "rich_text": [{"type": "text", "text": {"content": "📊 Processing Metadata"}}],
                    "children": self._markdown_to_blocks(metadata_text)
                }
            })
        
        # Quality Control & Validation toggle (detailed breakdown)
        if hasattr(result, 'quality_score'):
            quality_details = self._create_quality_validation_report(result, raw_content)
            blocks.append({
                "object": "block",
                "type": "toggle",
                "toggle": {
                    "rich_text": [{"type": "text", "text": {"content": "✅ Quality Control & Validation"}}],
                    "children": self._markdown_to_blocks(quality_details)
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
        """
        Chunk text using hierarchical separators to preserve formatting.
        Uses industry-standard recursive character splitting approach.
        """
        if not text or not text.strip():
            return []
            
        # Hierarchical separators: paragraphs -> lines -> sentences -> words -> characters
        separators = ["\n\n", "\n", ". ", " ", ""]
        return self._recursive_split(text, separators, max_length)
    
    def _recursive_split(self, text: str, separators: List[str], max_length: int) -> List[Dict]:
        """Recursively split text using separator hierarchy."""
        # Base case: text fits within limit or no separators left
        if len(text) <= max_length or not separators:
            return [self._create_paragraph_block(text)] if text.strip() else []
        
        separator = separators[0]
        remaining_separators = separators[1:]
        
        # Handle empty separator (character-by-character splitting)
        # This is the final fallback when no other separators work
        if separator == "":
            # Split text into chunks of max_length characters
            # This prevents ValueError: empty separator when calling text.split("")
            blocks = []
            for i in range(0, len(text), max_length):
                chunk = text[i:i + max_length]
                if chunk.strip():
                    blocks.append(self._create_paragraph_block(chunk))
            return blocks
        
        # If current separator not found, try next separator
        if separator not in text:
            return self._recursive_split(text, remaining_separators, max_length)
        
        # Split by current separator
        chunks = text.split(separator)
        blocks = []
        current_chunk = ""
        
        for i, chunk in enumerate(chunks):
            # Build potential chunk with separator (except for last chunk)
            if current_chunk:
                test_chunk = current_chunk + separator + chunk
            else:
                test_chunk = chunk
            
            if len(test_chunk) <= max_length:
                # Chunk fits, add to current
                current_chunk = test_chunk
            else:
                # Current chunk is full, process it
                if current_chunk:
                    # Process accumulated chunk recursively
                    blocks.extend(self._recursive_split(current_chunk, remaining_separators, max_length))
                
                # Start new chunk with current piece
                current_chunk = chunk
        
        # Process final chunk
        if current_chunk:
            blocks.extend(self._recursive_split(current_chunk, remaining_separators, max_length))
        
        return blocks
    
    def _create_paragraph_block(self, content: str) -> Dict:
        """Create a Notion paragraph block."""
        return {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{"type": "text", "text": {"content": content.strip()}}]
            }
        }
    
    
    def _create_combined_content_for_formatting(self, result: EnrichmentResult) -> str:
        """Create a combined markdown string from enrichment result for formatting."""
        content_parts = []
        
        # Add summary
        content_parts.append("## Executive Summary")
        content_parts.append(result.core_summary)
        
        # Add key insights  
        if result.key_insights:
            content_parts.append("\n## Key Insights")
            for insight in result.key_insights:
                content_parts.append(f"• {insight}")
        
        # Add strategic implications if using enhanced
        if hasattr(result, 'strategic_implications') and result.strategic_implications:
            content_parts.append("\n## Strategic Implications")
            for impl in result.strategic_implications:
                content_parts.append(f"• {impl}")
        
        # Add classification
        content_parts.append("\n## Classification")
        content_parts.append(f"Content Type: {result.content_type}")
        content_parts.append(f"AI Primitives: {', '.join(result.ai_primitives)}")
        content_parts.append(f"Vendor: {result.vendor or 'N/A'}")
        content_parts.append(f"Confidence: {result.confidence_scores.get('classification', 0.7):.0%}")
        
        # Add reasoning if available
        if hasattr(result, 'classification_reasoning') and result.classification_reasoning:
            content_parts.append(f"\nReasoning: {result.classification_reasoning}")
        
        # Add tags
        if hasattr(result, 'topical_tags') and (result.topical_tags or result.domain_tags):
            content_parts.append("\n## Content Tags")
            if result.topical_tags:
                content_parts.append(f"Topical: {', '.join(result.topical_tags)}")
            if result.domain_tags:
                content_parts.append(f"Domain: {', '.join(result.domain_tags)}")
        
        return '\n'.join(content_parts)
    
    
    def _format_web_citations(self, citations: List[Dict]) -> str:
        """Format web search citations as markdown."""
        if not citations:
            return ""
        
        lines = ["", "---", f"🔍 **Web Search Sources** ({len(citations)} consulted):"]
        
        for citation in citations:
            title = citation.get('title', 'Unknown')
            url = citation.get('url', '')
            domain = citation.get('domain', '')
            
            if url:
                lines.append(f"• [{title}]({url}) - {domain}")
            else:
                lines.append(f"• {title}")
        
        return "\n".join(lines)
    
    def _markdown_to_blocks(self, markdown: str) -> List[Dict]:
        """Convert markdown to Notion blocks."""
        # Use the existing chunk method that respects Notion's character limits
        # This will create far fewer blocks by putting ~1900 chars in each block
        return self._chunk_text_to_blocks(markdown, max_length=1900)
    
    def _create_analyzer_results_for_attribution(self, result: EnrichmentResult) -> List[Any]:
        """Create analyzer results list for attribution formatter."""
        analyzer_results = []
        
        # Create a simple object that has the required attributes
        class AnalyzerResult:
            def __init__(self, name, quality, time, tokens, source="yaml"):
                self.analyzer_name = name
                self.quality_score = quality
                self.processing_time = time
                self.token_usage = {"total_tokens": tokens}
                self.prompt_source = source
        
        # Add summarizer result
        if result.core_summary:
            analyzer_results.append(AnalyzerResult(
                "summarizer",
                getattr(result, 'summary_quality_score', result.quality_score),
                result.processing_time / 3,
                result.token_usage.get('total_tokens', 0) // 3,
                getattr(result, 'summary_prompt_source', 'yaml')
            ))
        
        # Add insights result
        if result.key_insights:
            analyzer_results.append(AnalyzerResult(
                "insights", 
                getattr(result, 'insights_quality_score', result.quality_score),
                result.processing_time / 3,
                result.token_usage.get('total_tokens', 0) // 3,
                getattr(result, 'insights_prompt_source', 'yaml')
            ))
        
        # Add classifier/tagger result
        if hasattr(result, 'topical_tags') or hasattr(result, 'domain_tags'):
            analyzer_results.append(AnalyzerResult(
                "tagger",
                getattr(result, 'tagger_quality_score', result.quality_score),
                result.processing_time / 3,
                result.token_usage.get('total_tokens', 0) // 3,
                getattr(result, 'tagger_prompt_source', 'yaml')
            ))
        
        return analyzer_results
    
    def _track_prompt_sources_from_result(self, result: EnrichmentResult) -> Dict[str, str]:
        """Extract prompt source information from enrichment result."""
        sources = {}
        
        # Check for prompt source attributes
        if hasattr(result, 'prompt_sources') and isinstance(result.prompt_sources, dict):
            sources.update(result.prompt_sources)
        
        # Individual analyzer sources
        if hasattr(result, 'summary_prompt_source'):
            sources['summarizer'] = result.summary_prompt_source
        if hasattr(result, 'insights_prompt_source'):
            sources['insights'] = result.insights_prompt_source
        if hasattr(result, 'tagger_prompt_source'):
            sources['tagger'] = result.tagger_prompt_source
            
        # Default to yaml if no source found
        for analyzer in ['summarizer', 'insights', 'tagger']:
            if analyzer not in sources:
                sources[analyzer] = 'yaml'
                
        return sources
    
    def _track_notion_page_ids_from_result(self, result: EnrichmentResult) -> Dict[str, str]:
        """Extract Notion page IDs for prompts used in enrichment."""
        page_ids = {}
        
        # Check for page ID attributes
        if hasattr(result, 'prompt_page_ids') and isinstance(result.prompt_page_ids, dict):
            page_ids.update(result.prompt_page_ids)
        
        # Individual analyzer page IDs
        if hasattr(result, 'summary_prompt_page_id'):
            page_ids['summarizer'] = result.summary_prompt_page_id
        if hasattr(result, 'insights_prompt_page_id'):
            page_ids['insights'] = result.insights_prompt_page_id
        if hasattr(result, 'tagger_prompt_page_id'):
            page_ids['tagger'] = result.tagger_prompt_page_id
            
        return page_ids
    
    def _create_quality_validation_report(self, result: EnrichmentResult, raw_content: str) -> str:
        """Create a detailed quality control and validation report."""
        # Calculate individual quality components
        summary_length = len(result.core_summary)
        insights_count = len(result.key_insights)
        
        # Summary quality assessment
        summary_score = 0.0
        summary_status = "❌ Below Standard"
        if summary_length > 500:
            summary_score = 0.3
            summary_status = "✅ Excellent"
        elif summary_length > 200:
            summary_score = 0.2
            summary_status = "✓ Good"
        elif summary_length > 100:
            summary_score = 0.1
            summary_status = "⚠️ Minimal"
        
        # Insights quality assessment
        insights_score = 0.0
        insights_status = "❌ Below Standard"
        if insights_count >= 5:
            insights_score = 0.3
            insights_status = "✅ Excellent"
        elif insights_count >= 3:
            insights_score = 0.2
            insights_status = "✓ Good"
        elif insights_count >= 1:
            insights_score = 0.1
            insights_status = "⚠️ Minimal"
        
        # Classification confidence
        confidence_str = result.confidence_scores.get('classification', 0.7)
        if isinstance(confidence_str, float):
            confidence_percent = confidence_str * 100
        else:
            confidence_percent = 70  # Default
        
        confidence_status = "❌ Low"
        if confidence_percent >= 80:
            confidence_status = "✅ High"
        elif confidence_percent >= 60:
            confidence_status = "✓ Medium"
        
        # Processing efficiency
        efficiency_status = "❌ Slow"
        if result.processing_time < 10:
            efficiency_status = "✅ Fast"
        elif result.processing_time < 20:
            efficiency_status = "✓ Acceptable"
        
        # Content coverage analysis
        content_length = len(raw_content)
        compression_ratio = len(result.core_summary) / content_length if content_length > 0 else 0
        
        # Cost calculation based on GPT-4.1 pricing
        # GPT-4.1 standard: $2/million input, $8/million output tokens
        # Approximate token count: chars / 4
        input_tokens = result.token_usage.get('prompt_tokens', 0)
        output_tokens = result.token_usage.get('completion_tokens', 0)
        
        # Calculate costs in dollars
        input_cost = (input_tokens / 1_000_000) * 2.00  # $2 per million
        output_cost = (output_tokens / 1_000_000) * 8.00  # $8 per million
        total_cost = input_cost + output_cost
        
        # Check if caching would apply (same content within 5-10 mins)
        cached_input_cost = (input_tokens / 1_000_000) * 0.50  # $0.50 per million (75% discount)
        cached_total_cost = cached_input_cost + output_cost
        
        # Actionability checks
        action_items = sum(1 for insight in result.key_insights if any(
            keyword in insight.lower() for keyword in ['should', 'must', 'need to', 'recommend', 'action', 'consider']
        ))
        
        # Evidence quality
        evidence_markers = sum(1 for marker in ['%', '$', 'data', 'study', 'report', 'analysis'] 
                              if marker in result.core_summary.lower())
        
        # Build the detailed report
        report = f"""## Quality Control Report

### 📊 Overall Quality Score: {result.quality_score:.2f}/1.00

### Component Breakdown:

#### 1. Summary Quality ({summary_score:.1f}/0.3) - {summary_status}
- **Length**: {summary_length} characters
- **Target**: 200-500+ characters for comprehensive coverage
- **Compression Ratio**: {compression_ratio:.1%} of original content
- **Readability**: {"✅ Concise" if compression_ratio < 0.2 else "⚠️ May be too detailed"}

#### 2. Insights Quality ({insights_score:.1f}/0.3) - {insights_status}
- **Count**: {insights_count} key insights extracted
- **Target**: 3-5+ insights for comprehensive analysis
- **Actionable Items**: {action_items} insights with clear actions
- **Strategic Value**: {"✅ High" if action_items >= 2 else "⚠️ Could be more actionable"}

#### 3. Classification Confidence ({confidence_percent:.0f}%) - {confidence_status}
- **Content Type**: {result.content_type}
- **AI Primitives**: {len(result.ai_primitives)} identified
- **Vendor Detection**: {"✅ Identified" if result.vendor else "⚠️ Not detected"}
- **Taxonomy Match**: {"✅ Standard category" if result.content_type != "Other" else "⚠️ Generic category"}

#### 4. Processing Efficiency - {efficiency_status}
- **Time**: {result.processing_time:.2f} seconds
- **Tokens Used**: {result.token_usage.get('total_tokens', 0):,} (Input: {input_tokens:,}, Output: {output_tokens:,})
- **Cost Estimate (GPT-4.1)**: ${total_cost:.4f} (Input: ${input_cost:.4f} @ $2/M, Output: ${output_cost:.4f} @ $8/M)
- **With Caching**: ${cached_total_cost:.4f} (75% input discount if reused within 5-10 mins)
- **Performance**: {"✅ Optimal" if result.processing_time < 10 else "⚠️ Consider optimization"}

### 📋 Content Analysis Metrics:

#### Coverage & Completeness
- **Original Content**: {content_length:,} characters
- **Summary Coverage**: {summary_length:,} characters ({compression_ratio:.1%})
- **Key Topics Identified**: {insights_count}
- **Evidence Markers**: {evidence_markers} data points referenced

#### Cost Comparison (for {result.token_usage.get('total_tokens', 0):,} tokens)
- **GPT-4.1**: ${total_cost:.4f} (current model - $2/$8 per M tokens)
- **o3 (June 2025)**: ${(input_tokens / 1_000_000) * 2.00 + (output_tokens / 1_000_000) * 8.00:.4f} (same pricing as GPT-4.1)
- **o3-pro**: ${(input_tokens / 1_000_000) * 20.00 + (output_tokens / 1_000_000) * 80.00:.4f} ($20/$80 per M tokens)

#### Actionability Assessment
- **Action Items**: {action_items} specific recommendations
- **Decision Points**: {"✅ Clear next steps" if action_items >= 2 else "⚠️ Needs more specific actions"}
- **Time Sensitivity**: {"Detected" if any(word in str(result.key_insights).lower() for word in ['urgent', 'immediate', 'asap', 'deadline']) else "Not indicated"}

#### Prompt Configuration Used
- **Content Type**: {result.content_type}
- **Temperature**: {getattr(result, 'temperature', 'Default')}
- **Web Search**: {"Enabled" if getattr(result, 'web_search_used', False) else "Disabled"}
- **Analysis Framework**: {"Content-specific" if result.content_type != "Other" else "Default"}

### 🎯 Quality Assurance Checklist:

✓ **Completeness**: {"✅ Pass" if summary_length > 100 else "❌ Fail"} - Summary captures key information
✓ **Actionability**: {"✅ Pass" if action_items > 0 else "❌ Fail"} - Contains actionable insights
✓ **Evidence-Based**: {"✅ Pass" if evidence_markers > 0 else "❌ Fail"} - Supported by data/facts
✓ **Classification**: {"✅ Pass" if confidence_percent >= 60 else "❌ Fail"} - Accurate categorization
✓ **Efficiency**: {"✅ Pass" if result.processing_time < 30 else "❌ Fail"} - Processed in reasonable time

### 💡 Improvement Suggestions:
"""
        
        # Add specific improvement suggestions based on scores
        suggestions = []
        if summary_score < 0.2:
            suggestions.append("- Consider adjusting prompts to generate more comprehensive summaries")
        if insights_score < 0.2:
            suggestions.append("- Enhance insight extraction prompts to identify more strategic opportunities")
        if confidence_percent < 70:
            suggestions.append("- Review classification taxonomy or improve content type detection")
        if result.processing_time > 20:
            suggestions.append("- Optimize prompt length or consider using a faster model for initial analysis")
        if action_items == 0:
            suggestions.append("- Modify prompts to emphasize actionable recommendations")
        
        if suggestions:
            report += "\n".join(suggestions)
        else:
            report += "- All quality metrics meet or exceed standards ✅"
        
        return report
    
    def _mark_failed(self, page_id: str, error_msg: str):
        """Mark a page as failed with detailed error analysis."""
        self.notion_client.update_page_status(
            page_id, 
            ContentStatus.FAILED,
            f"Pipeline processing failed: {error_msg}"
        )
    
    def get_quality_report(self) -> Dict[str, Any]:
        """Get a detailed report of quality metrics collected during processing."""
        avg_quality = 0.0
        if self.quality_metrics["total_processed"] > 0:
            avg_quality = self.quality_metrics["total_quality_score"] / self.quality_metrics["total_processed"]
        
        avg_processing_time = 0.0
        if self.quality_metrics["processing_times"]:
            avg_processing_time = sum(self.quality_metrics["processing_times"]) / len(self.quality_metrics["processing_times"])
        
        # Calculate component averages
        breakdown = self.quality_metrics["quality_breakdown"]
        avg_summary = sum(breakdown["summary_scores"]) / len(breakdown["summary_scores"]) if breakdown["summary_scores"] else 0
        avg_insights = sum(breakdown["insights_scores"]) / len(breakdown["insights_scores"]) if breakdown["insights_scores"] else 0
        avg_classification = sum(breakdown["classification_scores"]) / len(breakdown["classification_scores"]) if breakdown["classification_scores"] else 0
        avg_efficiency = sum(breakdown["efficiency_scores"]) / len(breakdown["efficiency_scores"]) if breakdown["efficiency_scores"] else 0
        
        return {
            "total_processed": self.quality_metrics["total_processed"],
            "average_quality_score": avg_quality,
            "average_processing_time": avg_processing_time,
            "processing_time_range": {
                "min": min(self.quality_metrics["processing_times"]) if self.quality_metrics["processing_times"] else 0,
                "max": max(self.quality_metrics["processing_times"]) if self.quality_metrics["processing_times"] else 0
            },
            "quality_breakdown": {
                "summary_average": avg_summary,
                "insights_average": avg_insights,
                "classification_average": avg_classification,
                "efficiency_average": avg_efficiency
            },
            "content_type_performance": self.quality_metrics["content_type_performance"],
            "validation_failures": len(self.quality_metrics["validation_failures"]),
            "quality_distribution": {
                "excellent": sum(1 for i in range(len(breakdown["summary_scores"])) 
                               if (breakdown["summary_scores"][i] + breakdown["insights_scores"][i] + 
                                   breakdown["classification_scores"][i] + breakdown["efficiency_scores"][i]) >= 0.8),
                "good": sum(1 for i in range(len(breakdown["summary_scores"])) 
                           if 0.6 <= (breakdown["summary_scores"][i] + breakdown["insights_scores"][i] + 
                                      breakdown["classification_scores"][i] + breakdown["efficiency_scores"][i]) < 0.8),
                "acceptable": sum(1 for i in range(len(breakdown["summary_scores"])) 
                                if 0.4 <= (breakdown["summary_scores"][i] + breakdown["insights_scores"][i] + 
                                           breakdown["classification_scores"][i] + breakdown["efficiency_scores"][i]) < 0.6),
                "poor": sum(1 for i in range(len(breakdown["summary_scores"])) 
                           if (breakdown["summary_scores"][i] + breakdown["insights_scores"][i] + 
                               breakdown["classification_scores"][i] + breakdown["efficiency_scores"][i]) < 0.4)
            }
        }