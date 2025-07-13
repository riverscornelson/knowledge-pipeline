"""
Main enrichment processor orchestrating AI analysis.
"""
import json
import time
from datetime import datetime
from typing import Dict, List, Optional, Any
from ..core.config import PipelineConfig
from ..core.models import SourceContent, EnrichmentResult, ContentStatus
from ..core.notion_client import NotionClient
from ..utils.logging import setup_logger
from .summarizer import ContentSummarizer
from .classifier import ContentClassifier
from .insights import InsightsGenerator


class EnrichmentProcessor:
    """Orchestrates the enrichment of content with AI analysis."""
    
    def __init__(self, config: PipelineConfig, notion_client: NotionClient):
        """Initialize enrichment processor."""
        self.config = config
        self.notion_client = notion_client
        self.logger = setup_logger(__name__)
        
        # Initialize AI components
        self.summarizer = ContentSummarizer(config.openai)
        self.classifier = ContentClassifier(config.openai, self._load_taxonomy())
        self.insights_generator = InsightsGenerator(config.openai)
        
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
        Process a batch of items needing enrichment.
        
        Returns:
            Dict with counts: {"processed": n, "failed": n, "skipped": n}
        """
        stats = {"processed": 0, "failed": 0, "skipped": 0}
        
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
                
                # Perform enrichment
                result = self.enrich_content(content, item)
                
                # Store results
                self._store_results(item, result, content)
                
                stats["processed"] += 1
                
                # Rate limiting
                time.sleep(self.config.rate_limit_delay)
                
            except Exception as e:
                self.logger.error(f"Failed to process item {item['id']}: {e}")
                self._mark_failed(item['id'], str(e))
                stats["failed"] += 1
        
        self.logger.info(f"Enrichment complete: {stats}")
        return stats
    
    def enrich_content(self, content: str, item: Dict) -> EnrichmentResult:
        """
        Perform AI enrichment on content.
        
        Args:
            content: The text content to analyze
            item: The Notion page item
            
        Returns:
            EnrichmentResult with all analyses
        """
        start_time = time.time()
        
        # Extract title
        title = item['properties']['Title']['title'][0]['text']['content']
        
        # Generate analyses in parallel (conceptually)
        core_summary = self.summarizer.generate_summary(content, title)
        classification = self.classifier.classify_content(content, title)
        key_insights = self.insights_generator.generate_insights(content, title)
        
        # Calculate processing time
        processing_time = time.time() - start_time
        
        # Aggregate token usage (mock for now)
        token_usage = {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0
        }
        
        return EnrichmentResult(
            core_summary=core_summary,
            key_insights=key_insights,
            content_type=classification["content_type"],
            ai_primitives=classification["ai_primitives"],
            vendor=classification.get("vendor"),
            confidence_scores={"classification": classification.get("confidence", 1.0)},
            processing_time=processing_time,
            token_usage=token_usage
        )
    
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
        """Extract content from Google Drive."""
        # TODO: Implement using PDFProcessor from drive module
        self.logger.warning("Drive content extraction not yet implemented in new structure")
        return None
    
    def _extract_web_content(self, article_url: str) -> Optional[str]:
        """Extract content from web URL."""
        # TODO: Implement using Firecrawl or similar
        self.logger.warning("Web content extraction not yet implemented in new structure")
        return None
    
    def _extract_page_content(self, page_id: str) -> Optional[str]:
        """Extract existing content from Notion page."""
        try:
            blocks = self.notion_client.client.blocks.children.list(block_id=page_id)
            content_parts = []
            
            for block in blocks['results']:
                if block['type'] == 'paragraph':
                    text = block['paragraph'].get('rich_text', [])
                    if text:
                        content_parts.append(text[0]['plain_text'])
            
            return '\n'.join(content_parts) if content_parts else None
            
        except Exception as e:
            self.logger.error(f"Failed to extract page content: {e}")
            return None
    
    def _store_results(self, item: Dict, result: EnrichmentResult, raw_content: str):
        """Store enrichment results in Notion."""
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
        
        # Add content blocks
        blocks = self._create_content_blocks(result, raw_content)
        self.notion_client.add_content_blocks(page_id, blocks)
    
    def _create_content_blocks(self, result: EnrichmentResult, raw_content: str) -> List[Dict]:
        """Create Notion blocks for enriched content."""
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
        
        # Core Summary toggle
        blocks.append({
            "object": "block",
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": "📋 Core Summary"}}],
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
        
        # Classification toggle
        classification_text = f"""
**Content Type**: {result.content_type}
**AI Primitives**: {', '.join(result.ai_primitives)}
**Vendor**: {result.vendor or 'N/A'}
**Confidence**: {result.confidence_scores.get('classification', 0):.0%}
"""
        blocks.append({
            "object": "block",
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": "🎯 Classification"}}],
                "children": self._markdown_to_blocks(classification_text)
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
        # Simple implementation - could be enhanced
        blocks = []
        lines = markdown.split('\n')
        
        for line in lines:
            if line.strip():
                blocks.append({
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{"type": "text", "text": {"content": line}}]
                    }
                })
        
        return blocks
    
    def _mark_failed(self, page_id: str, error_msg: str):
        """Mark a page as failed with error message."""
        self.notion_client.update_page_status(
            page_id, 
            ContentStatus.FAILED,
            error_msg
        )