"""
Integration adapter for using the new formatting system with the existing pipeline processor.

This module provides a bridge between the old and new formatting systems,
allowing gradual rollout via feature flags.
"""

import os
from typing import Any, Dict, List, Optional

from ..core.models import EnrichmentResult
from ..utils.logging import setup_logger
from .builder import AdaptiveBlockBuilder, Platform
from .content_templates import (
    GeneralContentTemplate,
    MarketNewsTemplate,
    ResearchPaperTemplate,
)
from .normalizer import ContentNormalizer
from .templates import TemplateRegistry


class FormattingAdapter:
    """
    Adapter that integrates the new formatting system with the existing pipeline.
    
    This class provides a compatibility layer to use the new formatting system
    while maintaining the existing pipeline interface.
    """
    
    def __init__(self, use_new_formatter: bool = None):
        """Initialize the formatting adapter.
        
        Args:
            use_new_formatter: If True, use new formatting system. 
                             If None, check environment variable.
        """
        self.logger = setup_logger(__name__)
        
        # Check feature flag
        if use_new_formatter is None:
            use_new_formatter = os.getenv('USE_NEW_FORMATTER', 'false').lower() == 'true'
        
        self.use_new_formatter = use_new_formatter
        
        if self.use_new_formatter:
            self.logger.info("Using new formatting system")
            # Initialize templates if not already done
            if not TemplateRegistry.list_templates():
                self._register_templates()
        else:
            self.logger.info("Using legacy formatting system")
    
    def _register_templates(self):
        """Register default templates."""
        # Templates are auto-registered on import in content_templates.py
        # But we can verify they're loaded
        templates = TemplateRegistry.list_templates()
        self.logger.info(f"Registered templates: {templates}")
    
    def format_enrichment_result(
        self,
        result: EnrichmentResult,
        raw_content: str,
        source_metadata: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Format an enrichment result into Notion blocks.
        
        Args:
            result: The enrichment result to format
            raw_content: The raw content text
            source_metadata: Metadata about the source document
            
        Returns:
            List of Notion block dictionaries
        """
        if not self.use_new_formatter:
            # Return empty list to signal legacy formatting should be used
            return []
        
        try:
            # Convert EnrichmentResult to format expected by normalizer
            enrichment_dict = self._enrichment_result_to_dict(result)
            
            # Add raw content to source metadata
            source_metadata['raw_content'] = raw_content
            
            # Normalize the content
            normalized_content = ContentNormalizer.normalize(
                enrichment_dict,
                source_metadata
            )
            
            # Get appropriate template (normalize content type)
            content_type_normalized = normalized_content.content_type.lower().replace(" ", "_")
            template = TemplateRegistry.get_template(content_type_normalized)
            if not template:
                self.logger.warning(
                    f"No template found for content type: {content_type_normalized}, "
                    "using general template"
                )
                template = GeneralContentTemplate()
            
            # Detect platform (could be enhanced with actual detection)
            platform = self._detect_platform()
            
            # Build blocks
            builder = AdaptiveBlockBuilder(platform)
            blocks = builder.build_blocks(
                content=normalized_content,
                template=template,
                force_minimal=False
            )
            
            self.logger.info(
                f"Formatted content with new system: {len(blocks)} blocks created"
            )
            
            return blocks
            
        except Exception as e:
            self.logger.error(f"Error in new formatting system: {e}", exc_info=True)
            # Return empty list to fall back to legacy formatting
            return []
    
    def _enrichment_result_to_dict(self, result: EnrichmentResult) -> Dict[str, Any]:
        """Convert EnrichmentResult to dictionary format expected by normalizer."""
        # Build content analysis dict
        content_analysis = {}
        
        # Map core fields
        if hasattr(result, 'core_summary'):
            content_analysis['executive_summary'] = result.core_summary
        
        if hasattr(result, 'key_insights'):
            # Handle both list and structured insights
            if hasattr(result, 'structured_insights') and result.structured_insights:
                content_analysis['key_insights'] = self._parse_structured_insights(
                    result.structured_insights
                )
            else:
                content_analysis['key_insights'] = result.key_insights
        
        # Add classification info
        if hasattr(result, 'content_type'):
            content_analysis['classification'] = {
                'content_type': result.content_type,
                'ai_primitives': getattr(result, 'ai_primitives', []),
                'vendor': getattr(result, 'vendor', None),
                'reasoning': getattr(result, 'classification_reasoning', None)
            }
        
        # Add tags
        if hasattr(result, 'topical_tags') or hasattr(result, 'domain_tags'):
            content_analysis['tags'] = {
                'topical': getattr(result, 'topical_tags', []),
                'domain': getattr(result, 'domain_tags', [])
            }
        
        # Add any additional analysis sections
        if hasattr(result, 'strategic_implications'):
            content_analysis['strategic_implications'] = result.strategic_implications
        
        if hasattr(result, 'technical_details'):
            content_analysis['technical_details'] = result.technical_details
        
        if hasattr(result, 'market_impact'):
            content_analysis['market_impact'] = result.market_impact
        
        # Build metadata
        metadata = {
            'content_type': getattr(result, 'content_type', 'general'),
            'quality_score': getattr(result, 'quality_score', 0.7),
            'confidence_score': result.confidence_scores.get('overall', 0.7)
                if hasattr(result, 'confidence_scores') else 0.7,
            'processing_time': getattr(result, 'processing_time', 0.0),
            'tokens_used': getattr(result, 'total_tokens', 0),
            'cost': getattr(result, 'total_cost', 0.0),
        }
        
        # Add prompt info if available
        if hasattr(result, 'prompt_metadata'):
            metadata['prompt_info'] = result.prompt_metadata
        elif hasattr(result, 'analyzer_used'):
            metadata['analyzer'] = result.analyzer_used
        
        return {
            'content_analysis': content_analysis,
            'metadata': metadata
        }
    
    def _parse_structured_insights(self, structured_insights: Any) -> List[Dict[str, Any]]:
        """Parse structured insights into normalized format."""
        insights = []
        
        # Handle different structured insight formats
        if isinstance(structured_insights, list):
            for item in structured_insights:
                if isinstance(item, dict):
                    insights.append({
                        'text': item.get('insight', str(item)),
                        'confidence': item.get('confidence', 1.0),
                        'evidence': item.get('evidence'),
                        'tags': item.get('tags', [])
                    })
                else:
                    insights.append({'text': str(item)})
        elif isinstance(structured_insights, dict):
            # Handle nested structure
            for category, items in structured_insights.items():
                if isinstance(items, list):
                    for item in items:
                        insights.append({
                            'text': str(item),
                            'tags': [category]
                        })
        else:
            insights.append({'text': str(structured_insights)})
        
        return insights
    
    def _detect_platform(self) -> Platform:
        """Detect the target platform for formatting."""
        # Could be enhanced with actual detection logic
        # For now, default to desktop
        platform_env = os.getenv('NOTION_PLATFORM', 'desktop').lower()
        
        if platform_env == 'mobile':
            return Platform.MOBILE
        elif platform_env == 'tablet':
            return Platform.TABLET
        else:
            return Platform.DESKTOP
    
    def should_use_new_formatter(self) -> bool:
        """Check if new formatter should be used."""
        return self.use_new_formatter