"""
Enhanced pipeline processor that uses the new NotionFormatter for better content formatting.
This addresses the "wall of text" problem identified in the user feedback.
"""
from typing import List, Dict, Any, Optional
from ..enrichment.pipeline_processor import PipelineProcessor
from ..utils.notion_formatter import NotionFormatter
from ..core.prompt_config_enhanced import EnhancedPromptConfig
from ..core.models import EnrichmentResult
from ..utils.logging import setup_logger


class EnhancedPipelineProcessor(PipelineProcessor):
    """Enhanced processor with improved Notion formatting capabilities."""
    
    def __init__(self, notion_client, analyzers, prompt_config=None):
        """Initialize enhanced processor with new formatter.
        
        Args:
            notion_client: NotionClient instance
            analyzers: List of analyzer instances
            prompt_config: Optional EnhancedPromptConfig instance
        """
        # Initialize parent class
        super().__init__(notion_client, analyzers)
        
        # Initialize enhanced components
        self.formatter = NotionFormatter()
        self.enhanced_prompt_config = prompt_config or EnhancedPromptConfig()
        
        # Override the parent's prompt config if enhanced one provided
        if prompt_config:
            self.prompt_config = prompt_config
        
        self.logger = setup_logger(__name__)
        self.logger.info("Enhanced PipelineProcessor initialized with NotionFormatter")
    
    def _create_content_blocks(self, result: EnrichmentResult, raw_content: str) -> List[Dict]:
        """Create Notion blocks with enhanced formatting to solve wall of text issues."""
        blocks = []
        
        # Raw Content toggle - now with better formatting
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
        
        # Add a divider after raw content
        blocks.append({"type": "divider", "divider": {}})
        
        # Quality indicator
        quality_indicator = ""
        if hasattr(result, 'quality_score'):
            if result.quality_score >= 0.8:
                quality_indicator = " ⭐ High Quality"
            elif result.quality_score >= 0.6:
                quality_indicator = " ✓ Good Quality"
        
        # Create a header for enriched content
        blocks.append({
            "type": "heading_2",
            "heading_2": {
                "rich_text": [{"type": "text", "text": {"content": f"🤖 AI-Enriched Analysis{quality_indicator}"}}]
            }
        })
        
        # Core Summary - Now properly formatted
        if result.core_summary:
            # Add summary header
            blocks.append({
                "type": "heading_3",
                "heading_3": {
                    "rich_text": [{"type": "text", "text": {"content": "📋 Executive Summary"}}]
                }
            })
            
            # Format summary using the new formatter
            summary_blocks = self.formatter.format_content(
                result.core_summary, 
                content_type=result.content_type
            )
            blocks.extend(summary_blocks)
            
            # Add web search citations if available
            if hasattr(result, 'summary_web_citations') and result.summary_web_citations:
                citation_blocks = self._create_citation_blocks(result.summary_web_citations)
                blocks.extend(citation_blocks)
        
        # Key Insights - Now with better structure
        if result.key_insights:
            blocks.append({
                "type": "heading_3",
                "heading_3": {
                    "rich_text": [{"type": "text", "text": {"content": "🎯 Key Insights"}}]
                }
            })
            
            # Create a numbered list with proper formatting
            for i, insight in enumerate(result.key_insights, 1):
                # Break long insights into main point + details
                formatted_insight = self._format_insight(insight, i)
                blocks.extend(formatted_insight)
            
            # Add web search citations if available
            if hasattr(result, 'insights_web_citations') and result.insights_web_citations:
                citation_blocks = self._create_citation_blocks(result.insights_web_citations)
                blocks.extend(citation_blocks)
        
        # Classification Results - Now as a structured table/callout
        if result.content_type or result.ai_primitives or result.vendor:
            blocks.append({
                "type": "heading_3",
                "heading_3": {
                    "rich_text": [{"type": "text", "text": {"content": "🏷️ Classification"}}]
                }
            })
            
            # Create a table for classification
            classification_table = self._create_classification_table(result)
            blocks.append(classification_table)
        
        # Technical Analysis - If available
        if hasattr(result, 'technical_analysis') and result.technical_analysis:
            blocks.append({
                "type": "heading_3",
                "heading_3": {
                    "rich_text": [{"type": "text", "text": {"content": "🔧 Technical Analysis"}}]
                }
            })
            
            tech_blocks = self.formatter.format_content(
                result.technical_analysis,
                content_type="technical"
            )
            blocks.extend(tech_blocks)
        
        # Market Analysis - If available
        if hasattr(result, 'market_analysis') and result.market_analysis:
            blocks.append({
                "type": "heading_3",
                "heading_3": {
                    "rich_text": [{"type": "text", "text": {"content": "📊 Market Analysis"}}]
                }
            })
            
            market_blocks = self.formatter.format_content(
                result.market_analysis,
                content_type="market"
            )
            blocks.extend(market_blocks)
        
        # Tags - Now as a visual tag cloud
        if hasattr(result, 'topical_tags') and result.topical_tags:
            blocks.append({
                "type": "heading_3",
                "heading_3": {
                    "rich_text": [{"type": "text", "text": {"content": "🏷️ Topics & Themes"}}]
                }
            })
            
            tag_block = self._create_tag_cloud_block(
                result.topical_tags, 
                result.domain_tags if hasattr(result, 'domain_tags') else []
            )
            blocks.append(tag_block)
        
        # Legal/Compliance - If available
        if hasattr(result, 'legal_analysis') and result.legal_analysis:
            blocks.append({
                "type": "heading_3",
                "heading_3": {
                    "rich_text": [{"type": "text", "text": {"content": "⚖️ Legal & Compliance"}}]
                }
            })
            
            legal_blocks = self.formatter.format_content(
                result.legal_analysis,
                content_type="legal"
            )
            blocks.extend(legal_blocks)
        
        return blocks
    
    def _format_insight(self, insight: str, number: int) -> List[Dict]:
        """Format a single insight with proper structure."""
        blocks = []
        
        # Determine if this is a high-priority insight
        is_critical = any(word in insight.lower() for word in ["critical", "urgent", "immediately", "risk"])
        
        # Split insight into main point and details if it's long
        sentences = insight.split('. ')
        
        if len(sentences) > 1:
            # Main point as numbered item
            main_point = sentences[0]
            if not main_point.endswith('.'):
                main_point += '.'
            
            # Create numbered list item with emoji
            emoji = "🔴" if is_critical else "🔵"
            blocks.append({
                "type": "numbered_list_item",
                "numbered_list_item": {
                    "rich_text": [
                        {"type": "text", "text": {"content": f"{emoji} "}},
                        {"type": "text", "text": {"content": main_point, "bold": True}}
                    ]
                }
            })
            
            # Add details as sub-bullets
            remaining = '. '.join(sentences[1:])
            if remaining:
                blocks.append({
                    "type": "bulleted_list_item",
                    "bulleted_list_item": {
                        "rich_text": [{"type": "text", "text": {"content": f"→ {remaining}"}}]
                    }
                })
        else:
            # Short insight as single numbered item
            emoji = "🔴" if is_critical else "🔵"
            blocks.append({
                "type": "numbered_list_item",
                "numbered_list_item": {
                    "rich_text": [
                        {"type": "text", "text": {"content": f"{emoji} "}},
                        {"type": "text", "text": {"content": insight}}
                    ]
                }
            })
        
        return blocks
    
    def _create_classification_table(self, result: EnrichmentResult) -> Dict:
        """Create a table block for classification results."""
        rows = []
        
        # Header row
        rows.append({
            "cells": [
                [{"type": "text", "text": {"content": "Attribute", "bold": True}}],
                [{"type": "text", "text": {"content": "Value", "bold": True}}],
                [{"type": "text", "text": {"content": "Confidence", "bold": True}}]
            ]
        })
        
        # Content Type row
        if result.content_type:
            confidence = getattr(result, 'content_type_confidence', 'High')
            rows.append({
                "cells": [
                    [{"type": "text", "text": {"content": "Content Type"}}],
                    [{"type": "text", "text": {"content": result.content_type}}],
                    [{"type": "text", "text": {"content": str(confidence)}}]
                ]
            })
        
        # AI Primitives row
        if result.ai_primitives:
            primitives_text = ", ".join(result.ai_primitives[:3])
            if len(result.ai_primitives) > 3:
                primitives_text += f" (+{len(result.ai_primitives) - 3} more)"
            
            rows.append({
                "cells": [
                    [{"type": "text", "text": {"content": "AI Primitives"}}],
                    [{"type": "text", "text": {"content": primitives_text}}],
                    [{"type": "text", "text": {"content": "High"}}]
                ]
            })
        
        # Vendor row
        if result.vendor:
            rows.append({
                "cells": [
                    [{"type": "text", "text": {"content": "Vendor"}}],
                    [{"type": "text", "text": {"content": result.vendor}}],
                    [{"type": "text", "text": {"content": "High"}}]
                ]
            })
        
        return {
            "type": "table",
            "table": {
                "table_width": 3,
                "has_column_header": True,
                "children": rows
            }
        }
    
    def _create_tag_cloud_block(self, topical_tags: List[str], domain_tags: List[str]) -> Dict:
        """Create a visual tag cloud as a callout block."""
        all_tags = []
        
        # Add topical tags with topic emoji
        for tag in topical_tags[:10]:  # Limit to prevent overflow
            all_tags.append(f"📌 {tag}")
        
        # Add domain tags with domain emoji
        for tag in domain_tags[:5]:  # Limit domains
            all_tags.append(f"🌐 {tag}")
        
        tag_text = "  ".join(all_tags)
        
        return {
            "type": "callout",
            "callout": {
                "rich_text": [{"type": "text", "text": {"content": tag_text}}],
                "icon": {"type": "emoji", "emoji": "🏷️"},
                "color": "blue_background"
            }
        }
    
    def _create_citation_blocks(self, citations: List[Dict]) -> List[Dict]:
        """Create formatted citation blocks."""
        blocks = []
        
        # Add citations header
        blocks.append({
            "type": "paragraph",
            "paragraph": {
                "rich_text": [
                    {"type": "text", "text": {"content": "📚 ", "bold": True}},
                    {"type": "text", "text": {"content": "Sources & References", "bold": True}}
                ]
            }
        })
        
        # Format each citation
        for i, citation in enumerate(citations[:5], 1):  # Limit to 5 citations
            title = citation.get('title', 'Untitled')
            url = citation.get('url', '')
            
            # Create a bulleted list item with link
            rich_text = [
                {"type": "text", "text": {"content": f"[{i}] "}},
            ]
            
            if url:
                rich_text.append({
                    "type": "text",
                    "text": {"content": title, "link": {"url": url}},
                    "annotations": {"underline": True}
                })
            else:
                rich_text.append({
                    "type": "text",
                    "text": {"content": title}
                })
            
            blocks.append({
                "type": "bulleted_list_item",
                "bulleted_list_item": {"rich_text": rich_text}
            })
        
        return blocks