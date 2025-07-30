"""
Modified pipeline processor that integrates the new formatting system.

This is a temporary file that shows how to integrate the new formatting system.
The actual integration would modify the existing pipeline_processor.py.
"""

import os
from typing import Dict, List, Optional, Any

from ..core.config import PipelineConfig
from ..core.models import EnrichmentResult
from ..core.notion_client import NotionClient
from ..utils.logging import setup_logger
from ..formatting.pipeline_integration import FormattingAdapter


def integrate_new_formatter(pipeline_processor_instance):
    """
    Monkey-patch method to integrate new formatter with existing pipeline processor.
    
    This shows how we would modify the existing format_notion_blocks method
    to use the new formatting system when enabled.
    """
    # Store reference to original method
    original_format_method = pipeline_processor_instance.format_notion_blocks
    
    # Initialize formatting adapter
    formatting_adapter = FormattingAdapter()
    
    def format_notion_blocks_with_new_formatter(
        self,
        result: EnrichmentResult,
        raw_content: str,
        notion_page_ids: List[str]
    ) -> List[Dict[str, Any]]:
        """Enhanced format_notion_blocks that can use the new formatting system."""
        
        # Prepare source metadata
        source_metadata = {
            'id': getattr(result, 'source_id', 'unknown'),
            'title': getattr(result, 'title', 'Untitled'),
            'tags': [],  # Would be populated from Notion
            'url': getattr(result, 'source_url', None),
        }
        
        # Try new formatter if enabled
        if formatting_adapter.should_use_new_formatter():
            self.logger.info("Attempting to use new formatting system")
            
            # Get blocks from new formatter
            new_blocks = formatting_adapter.format_enrichment_result(
                result,
                raw_content,
                source_metadata
            )
            
            if new_blocks:
                # New formatter succeeded, return its blocks
                self.logger.info(f"New formatter created {len(new_blocks)} blocks")
                return new_blocks
            else:
                # New formatter failed or returned empty, fall back to legacy
                self.logger.info("New formatter returned no blocks, using legacy formatting")
        
        # Use original formatting method
        return original_format_method(result, raw_content, notion_page_ids)
    
    # Replace the method
    pipeline_processor_instance.format_notion_blocks = format_notion_blocks_with_new_formatter.__get__(
        pipeline_processor_instance,
        pipeline_processor_instance.__class__
    )
    
    pipeline_processor_instance.logger.info("Integrated new formatting system with feature flag support")


# Example of how to modify the existing pipeline processor initialization
def create_pipeline_processor_with_new_formatter(config: PipelineConfig, notion_client: NotionClient):
    """
    Create a pipeline processor instance with new formatter integration.
    
    This would be added to the existing pipeline_processor.py file.
    """
    # Import the original class
    from .pipeline_processor import PipelineProcessor
    
    # Create instance
    processor = PipelineProcessor(config, notion_client)
    
    # Integrate new formatter
    integrate_new_formatter(processor)
    
    return processor


# Alternative approach: Subclass the existing processor
class PipelineProcessorV2:
    """
    Alternative implementation showing how to subclass and override formatting.
    
    This approach would be cleaner but requires changing imports in other files.
    """
    
    def __init__(self, original_processor):
        """Wrap the original processor and add new formatting capability."""
        self._processor = original_processor
        self.formatting_adapter = FormattingAdapter()
        self.logger = setup_logger(__name__)
        
        # Expose all original attributes
        for attr in dir(original_processor):
            if not attr.startswith('_') and not hasattr(self, attr):
                setattr(self, attr, getattr(original_processor, attr))
    
    def format_notion_blocks(
        self,
        result: EnrichmentResult,
        raw_content: str,
        notion_page_ids: List[str]
    ) -> List[Dict[str, Any]]:
        """Override format_notion_blocks to use new formatter when enabled."""
        
        # Prepare source metadata
        source_metadata = {
            'id': getattr(result, 'source_id', 'unknown'),
            'title': getattr(result, 'title', 'Untitled'),
            'tags': [],  # Would be populated from Notion
            'url': getattr(result, 'source_url', None),
        }
        
        # Try new formatter if enabled
        if self.formatting_adapter.should_use_new_formatter():
            self.logger.info("Using new formatting system")
            
            # Get blocks from new formatter
            new_blocks = self.formatting_adapter.format_enrichment_result(
                result,
                raw_content,
                source_metadata
            )
            
            if new_blocks:
                # New formatter succeeded
                self.logger.info(f"New formatter created {len(new_blocks)} blocks")
                return new_blocks
        
        # Fall back to original formatting
        self.logger.info("Using legacy formatting system")
        return self._processor.format_notion_blocks(result, raw_content, notion_page_ids)