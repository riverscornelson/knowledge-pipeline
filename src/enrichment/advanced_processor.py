"""
Advanced enrichment processor integrating sophisticated prompting techniques.
"""
import json
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
from ..drive.pdf_processor import PDFProcessor
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
import re


class AdvancedEnrichmentProcessor:
    """Advanced enrichment processor with sophisticated prompting and quality control."""
    
    def __init__(self, config: PipelineConfig, notion_client: NotionClient):
        """Initialize advanced enrichment processor."""
        self.config = config
        self.notion_client = notion_client
        self.logger = setup_logger(__name__)
        
        # Initialize advanced AI components
        self.summarizer = AdvancedContentSummarizer(config.openai)
        self.classifier = AdvancedContentClassifier(config.openai, self._load_taxonomy())
        self.insights_generator = AdvancedInsightsGenerator(config.openai)
        
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
            "quality_scores": [],
            "processing_times": [],
            "validation_failures": 0
        }
    
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
                start_time = time.time()
                
                title = item['properties']['Title']['title'][0]['text']['content']
                self.logger.info(f"Advanced processing: {title}")
                
                # Step 1: Extract content with intelligent preprocessing
                content = self._extract_content_advanced(item)
                if not content:
                    self.logger.warning(f"No content found for item {item['id']}")
                    stats["skipped"] += 1
                    continue
                
                # Step 2: Quality pre-assessment
                content_quality = self._assess_content_quality(content, title)
                if content_quality < 0.3:  # Minimum quality threshold
                    self.logger.warning(f"Content quality too low ({content_quality:.2f}) for {title}")
                    stats["skipped"] += 1
                    continue
                
                # Step 3: Advanced enrichment with parallel processing simulation
                enrichment_result = self.enrich_content_advanced(content, item)
                
                # Step 4: Quality validation and enhancement
                validated_result = self._validate_enrichment_quality(enrichment_result, content, title)
                
                # Step 5: Store results with enhanced metadata
                self._store_results_advanced(item, validated_result, content)
                
                processing_time = time.time() - start_time
                self.quality_metrics["processing_times"].append(processing_time)
                
                quality_score = validated_result.get("quality_score", 0.7)
                batch_quality_scores.append(quality_score)
                
                stats["processed"] += 1
                self.quality_metrics["total_processed"] += 1
                
                # Rate limiting with adaptive delays
                delay = self._calculate_adaptive_delay(processing_time, quality_score)
                time.sleep(delay)
                
            except Exception as e:
                self.logger.error(f"Failed to process item {item['id']}: {e}")
                self._mark_failed_advanced(item['id'], str(e))
                stats["failed"] += 1
                self.quality_metrics["validation_failures"] += 1
        
        # Calculate batch quality metrics
        if batch_quality_scores:
            stats["quality_score"] = sum(batch_quality_scores) / len(batch_quality_scores)
            self.quality_metrics["quality_scores"].extend(batch_quality_scores)
        
        self.logger.info(f"Advanced enrichment complete: {stats}")
        self._log_quality_metrics()
        
        return stats
    
    def enrich_content_advanced(self, content: str, item: Dict) -> Dict[str, Any]:
        """
        Perform advanced AI enrichment with sophisticated prompting techniques.
        
        Args:
            content: The text content to analyze
            item: The Notion page item
            
        Returns:
            Enhanced EnrichmentResult with quality metrics
        """
        start_time = time.time()
        title = item['properties']['Title']['title'][0]['text']['content']
        
        # Advanced parallel processing simulation (sequential for now, but structured for async)
        enrichment_tasks = []
        
        try:
            # Task 1: Advanced summarization
            self.logger.debug(f"Starting advanced summarization for: {title}")
            summary_start = time.time()
            core_summary = self.summarizer.generate_summary(content, title)
            summary_time = time.time() - summary_start
            enrichment_tasks.append(("summarization", summary_time, len(core_summary)))
            
            # Task 2: Advanced classification
            self.logger.debug(f"Starting advanced classification for: {title}")
            classification_start = time.time()
            classification = self.classifier.classify_content(content, title)
            classification_time = time.time() - classification_start
            enrichment_tasks.append(("classification", classification_time, classification.get("validation_score", 1.0)))
            
            # Task 3: Advanced insights generation
            self.logger.debug(f"Starting advanced insights generation for: {title}")
            insights_start = time.time()
            key_insights = self.insights_generator.generate_insights(content, title)
            insights_time = time.time() - insights_start
            enrichment_tasks.append(("insights", insights_time, len(key_insights)))
            
        except Exception as e:
            self.logger.error(f"Enrichment task failed for {title}: {e}")
            raise
        
        # Calculate comprehensive metrics
        total_processing_time = time.time() - start_time
        
        # Advanced token usage estimation (enhanced approximation)
        estimated_tokens = self._estimate_token_usage_advanced(content, core_summary, key_insights)
        
        # Quality scoring based on multiple factors
        quality_score = self._calculate_quality_score(
            classification.get("validation_score", 0.7),
            len(core_summary),
            len(key_insights),
            total_processing_time
        )
        
        # Convert classification confidence to numeric score
        confidence_str = classification.get("confidence", "medium")
        confidence_mapping = {"high": 0.9, "medium": 0.7, "low": 0.5}
        confidence_score = confidence_mapping.get(confidence_str, 0.7)
        
        return {
            "core_summary": core_summary,
            "key_insights": key_insights,
            "content_type": classification.get("content_type", "Unknown"),
            "ai_primitives": classification.get("ai_primitives", []),
            "vendor": classification.get("vendor"),
            "confidence_scores": {
                "classification": confidence_score,
                "overall": quality_score
            },
            "processing_time": total_processing_time,
            "token_usage": estimated_tokens,
            "quality_score": quality_score,
            "enrichment_metadata": {
                "tasks_completed": len(enrichment_tasks),
                "task_breakdown": enrichment_tasks,
                "validation_score": classification.get("validation_score", 1.0),
                "processing_timestamp": datetime.now().isoformat()
            }
        }
    
    def _extract_content_advanced(self, item: Dict) -> Optional[str]:
        """Extract content with enhanced preprocessing and validation."""
        # Check for Drive URL with enhanced validation
        drive_url = item['properties'].get('Drive URL', {}).get('url')
        if drive_url:
            content = self._extract_drive_content(drive_url)
            if content:
                return self._preprocess_content(content, source_type="drive")
        
        # Check for Article URL with enhanced validation
        article_url = item['properties'].get('Article URL', {}).get('url')
        if article_url:
            content = self._extract_web_content_advanced(article_url)
            if content:
                return self._preprocess_content(content, source_type="web")
        
        # Check existing page content with enhanced extraction
        page_content = self._extract_page_content_advanced(item['id'])
        if page_content:
            return self._preprocess_content(page_content, source_type="notion")
        
        return None
    
    def _preprocess_content(self, content: str, source_type: str) -> str:
        """Advanced content preprocessing for optimal AI analysis."""
        # Clean and normalize content
        cleaned_content = self._clean_content(content)
        
        # Source-specific preprocessing
        if source_type == "drive":
            cleaned_content = self._preprocess_pdf_content(cleaned_content)
        elif source_type == "web":
            cleaned_content = self._preprocess_web_content(cleaned_content)
        elif source_type == "notion":
            cleaned_content = self._preprocess_notion_content(cleaned_content)
        
        return cleaned_content
    
    def _clean_content(self, content: str) -> str:
        """Basic content cleaning and normalization."""
        # Remove excessive whitespace
        content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)
        content = re.sub(r' {3,}', ' ', content)
        
        # Remove common PDF artifacts
        content = re.sub(r'Page \d+ of \d+', '', content)
        content = re.sub(r'\f', '\n', content)  # Form feed characters
        
        # Normalize quotes and dashes
        content = content.replace('"', '"').replace('"', '"')
        content = content.replace('–', '-').replace('—', '-')
        
        return content.strip()
    
    def _assess_content_quality(self, content: str, title: str) -> float:
        """Assess content quality for processing viability."""
        quality_score = 1.0
        
        # Length assessment
        if len(content) < 100:
            quality_score -= 0.5
        elif len(content) < 500:
            quality_score -= 0.2
        
        # Content coherence
        sentences = content.split('.')
        if len(sentences) < 3:
            quality_score -= 0.3
        
        # Language and structure
        word_count = len(content.split())
        if word_count < 50:
            quality_score -= 0.4
        
        # Check for meaningful content vs. metadata
        metadata_indicators = ['copyright', 'all rights reserved', 'page', 'download', 'print']
        metadata_ratio = sum(1 for indicator in metadata_indicators if indicator in content.lower()) / max(len(metadata_indicators), 1)
        quality_score -= metadata_ratio * 0.3
        
        return max(0.0, quality_score)
    
    def _validate_enrichment_quality(self, result: Dict[str, Any], content: str, title: str) -> Dict[str, Any]:
        """Comprehensive validation and quality enhancement of enrichment results."""
        validated = result.copy()
        quality_issues = []
        
        # Summary validation
        summary = result.get("core_summary", "")
        if len(summary) < 100:
            quality_issues.append("Summary too brief")
        elif len(summary) > 3000:
            quality_issues.append("Summary too verbose")
        
        # Insights validation
        insights = result.get("key_insights", [])
        if len(insights) < 3:
            quality_issues.append("Insufficient insights generated")
        
        actionable_insights = sum(1 for insight in insights if any(
            term in insight.lower() for term in ['should', 'opportunity', 'risk', 'advantage', 'strategy']
        ))
        if actionable_insights < len(insights) * 0.6:
            quality_issues.append("Insights lack actionability")
        
        # Classification validation
        classification_score = result.get("enrichment_metadata", {}).get("validation_score", 1.0)
        if classification_score < 0.7:
            quality_issues.append("Classification confidence low")
        
        # Overall quality scoring
        base_quality = result.get("quality_score", 0.7)
        issue_penalty = len(quality_issues) * 0.1
        final_quality = max(0.3, base_quality - issue_penalty)
        
        validated["quality_score"] = final_quality
        validated["validation_issues"] = quality_issues
        
        if quality_issues:
            self.logger.warning(f"Quality issues for '{title}': {quality_issues}")
        
        return validated
    
    def _calculate_quality_score(self, classification_score: float, summary_length: int, 
                                insights_count: int, processing_time: float) -> float:
        """Calculate comprehensive quality score for enrichment results."""
        # Base score from classification
        score = classification_score * 0.4
        
        # Summary quality (optimal length around 800-1500 chars)
        summary_score = 1.0
        if summary_length < 400:
            summary_score = summary_length / 400
        elif summary_length > 2000:
            summary_score = max(0.5, 2000 / summary_length)
        score += summary_score * 0.3
        
        # Insights quality (optimal 3-5 insights)
        insights_score = min(1.0, insights_count / 4.0)
        score += insights_score * 0.2
        
        # Processing efficiency (penalty for very slow processing)
        if processing_time > 30:  # 30 seconds threshold
            efficiency_penalty = min(0.1, (processing_time - 30) / 60 * 0.1)
            score -= efficiency_penalty
        
        return max(0.3, min(1.0, score))
    
    def _estimate_token_usage_advanced(self, content: str, summary: str, insights: List[str]) -> Dict[str, int]:
        """Enhanced token usage estimation with detailed breakdown."""
        # Improved estimation based on actual usage patterns
        content_tokens = len(content.split()) * 1.3  # Account for tokenization
        summary_tokens = len(summary.split()) * 1.3
        insights_tokens = sum(len(insight.split()) for insight in insights) * 1.3
        
        # Prompt overhead estimation
        prompt_overhead = 800  # System messages, instructions, formatting
        
        total_prompt = int(content_tokens + prompt_overhead)
        total_completion = int(summary_tokens + insights_tokens)
        
        return {
            "prompt_tokens": total_prompt,
            "completion_tokens": total_completion,
            "total_tokens": total_prompt + total_completion,
            "breakdown": {
                "content": int(content_tokens),
                "summary": int(summary_tokens), 
                "insights": int(insights_tokens),
                "prompt_overhead": prompt_overhead
            }
        }
    
    def _calculate_adaptive_delay(self, processing_time: float, quality_score: float) -> float:
        """Calculate adaptive delay based on processing time and quality."""
        base_delay = self.config.rate_limit_delay
        
        # Longer delay for poor quality (needs more careful processing)
        if quality_score < 0.6:
            base_delay *= 1.5
        
        # Shorter delay for very fast processing (likely cached or simple content)
        if processing_time < 5:
            base_delay *= 0.8
        
        return base_delay
    
    def _log_quality_metrics(self):
        """Log comprehensive quality metrics for monitoring."""
        if not self.quality_metrics["quality_scores"]:
            return
        
        avg_quality = sum(self.quality_metrics["quality_scores"]) / len(self.quality_metrics["quality_scores"])
        avg_time = sum(self.quality_metrics["processing_times"]) / len(self.quality_metrics["processing_times"])
        failure_rate = self.quality_metrics["validation_failures"] / max(self.quality_metrics["total_processed"], 1)
        
        self.logger.info(
            f"Quality Metrics - Avg Quality: {avg_quality:.3f}, "
            f"Avg Time: {avg_time:.1f}s, Failure Rate: {failure_rate:.3f}, "
            f"Total Processed: {self.quality_metrics['total_processed']}"
        )
    
    # Inherit other methods from base processor
    def _load_taxonomy(self) -> Dict[str, List[str]]:
        """Load classification taxonomies from Notion database schema."""
        try:
            db_info = self.notion_client.client.databases.retrieve(
                self.notion_client.db_id
            )
            properties = db_info.get("properties", {})
            
            taxonomy = {
                "content_types": self._extract_options(properties, "Content-Type", "select"),
                "ai_primitives": self._extract_options(properties, "AI-Primitive", "multi_select"),
                "vendors": self._extract_options(properties, "Vendor", "select")
            }
            
            self.logger.info(
                f"Loaded advanced taxonomy: {len(taxonomy['content_types'])} content types, "
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
    
    # Additional method stubs for content extraction (inherit from base processor)
    def _extract_drive_content(self, drive_url: str) -> Optional[str]:
        """Enhanced Drive content extraction (inherit from base)."""
        # Implementation would be similar to base processor but with enhanced error handling
        pass
    
    def _extract_web_content_advanced(self, article_url: str) -> Optional[str]:
        """Advanced web content extraction with enhanced validation."""
        # Enhanced version of web content extraction
        pass
    
    def _extract_page_content_advanced(self, page_id: str) -> Optional[str]:
        """Advanced page content extraction with better parsing."""
        # Enhanced version of page content extraction
        pass
    
    def _store_results_advanced(self, item: Dict, result: Dict[str, Any], raw_content: str):
        """Store enrichment results with enhanced metadata and quality metrics."""
        # Enhanced version of result storage with quality metadata
        pass
    
    def _mark_failed_advanced(self, page_id: str, error_msg: str):
        """Mark a page as failed with detailed error analysis."""
        self.notion_client.update_page_status(
            page_id, 
            ContentStatus.FAILED,
            f"Advanced processing failed: {error_msg}"
        )