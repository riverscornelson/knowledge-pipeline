#!/usr/bin/env python
"""
Test script to demonstrate the new formatting system.

This script shows how to:
1. Enable the new formatter via environment variable
2. Process content with different quality scores
3. Compare output between old and new formatters
"""

import os
import sys
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.models import EnrichmentResult
from src.formatting.pipeline_integration import FormattingAdapter


def create_sample_result(quality_score: float = 0.85) -> EnrichmentResult:
    """Create a sample enrichment result for testing."""
    result = EnrichmentResult(
        core_summary="This document provides a comprehensive analysis of AI systems and their impact on modern business operations. The research indicates significant opportunities for automation and efficiency gains.",
        key_insights=[
            "AI adoption is accelerating across industries with 73% of enterprises implementing some form of AI",
            "Integration challenges remain the primary barrier, cited by 45% of organizations",
            "ROI from AI investments typically materializes within 18-24 months",
            "Skilled talent shortage is constraining AI deployment in 60% of companies"
        ],
        content_type="Market News",
        ai_primitives=["machine learning", "natural language processing", "computer vision"],
        vendor="TechCorp Analytics",
        confidence_scores={
            "classification": 0.92,
            "overall": quality_score
        },
        processing_time=4.3,
        token_usage={"total": 2150, "prompt": 1500, "completion": 650}
    )
    
    # Add optional attributes
    result.quality_score = quality_score
    result.total_tokens = 2150
    result.total_cost = 0.065
    result.classification_reasoning = "Content contains market statistics and industry analysis typical of market intelligence reports"
    result.topical_tags = ["artificial intelligence", "business transformation", "technology adoption"]
    result.domain_tags = ["enterprise technology", "market analysis"]
    result.strategic_implications = "Organizations should prioritize AI talent acquisition and integration capabilities to remain competitive"
    result.market_impact = "High - significant shifts in competitive landscape expected"
    
    return result


def format_with_new_system(result: EnrichmentResult, use_new: bool = True) -> dict:
    """Format content using the new or old system."""
    # Set environment variable
    os.environ['USE_NEW_FORMATTER'] = 'true' if use_new else 'false'
    
    # Create adapter
    adapter = FormattingAdapter()
    
    # Sample metadata
    metadata = {
        'id': 'test_doc_001',
        'title': 'AI Market Analysis Q4 2024',
        'tags': ['ai', 'market-analysis', 'quarterly-report'],
        'url': 'https://example.com/reports/ai-market-q4-2024.pdf'
    }
    
    # Sample raw content
    raw_content = """
# AI Market Analysis Q4 2024

## Executive Summary
The artificial intelligence market continues to show robust growth...

## Market Trends
1. Enterprise adoption accelerating
2. Cloud-based AI services dominating
3. Edge AI emerging as key growth area

## Competitive Landscape
Major players consolidating market share while startups focus on niche solutions...
"""
    
    # Format the content
    blocks = adapter.format_enrichment_result(result, raw_content, metadata)
    
    return {
        'blocks': blocks,
        'count': len(blocks),
        'used_new_formatter': adapter.should_use_new_formatter()
    }


def print_formatting_comparison():
    """Compare formatting between old and new systems."""
    print("=" * 80)
    print("KNOWLEDGE PIPELINE FORMATTING SYSTEM COMPARISON")
    print("=" * 80)
    
    # Test with high quality content
    print("\n1. HIGH QUALITY CONTENT (score: 0.9)")
    print("-" * 40)
    
    high_quality = create_sample_result(0.9)
    
    # New formatter
    new_result = format_with_new_system(high_quality, use_new=True)
    print(f"New Formatter: {new_result['count']} blocks created")
    
    # Count visible vs toggle sections
    visible_count = sum(1 for b in new_result['blocks'] if b.get('type') != 'toggle')
    toggle_count = sum(1 for b in new_result['blocks'] if b.get('type') == 'toggle')
    print(f"  - Visible sections: {visible_count}")
    print(f"  - Toggle sections: {toggle_count}")
    
    # Old formatter (would return empty, signaling fallback)
    old_result = format_with_new_system(high_quality, use_new=False)
    print(f"\nOld Formatter: {'Would use legacy formatting' if not old_result['blocks'] else f'{old_result["count"]} blocks'}")
    
    # Test with low quality content
    print("\n\n2. LOW QUALITY CONTENT (score: 0.4)")
    print("-" * 40)
    
    low_quality = create_sample_result(0.4)
    
    # New formatter
    new_result = format_with_new_system(low_quality, use_new=True)
    print(f"New Formatter: {new_result['count']} blocks created")
    
    # Count visible vs toggle sections
    visible_count = sum(1 for b in new_result['blocks'] if b.get('type') != 'toggle')
    toggle_count = sum(1 for b in new_result['blocks'] if b.get('type') == 'toggle')
    print(f"  - Visible sections: {visible_count}")
    print(f"  - Toggle sections: {toggle_count}")
    
    # Show sample block structure
    print("\n\n3. SAMPLE BLOCK STRUCTURE (First 5 blocks)")
    print("-" * 40)
    
    sample_result = create_sample_result(0.85)
    result = format_with_new_system(sample_result, use_new=True)
    
    for i, block in enumerate(result['blocks'][:5]):
        block_type = block.get('type', 'unknown')
        
        if block_type == 'callout':
            content = block['callout']['rich_text'][0]['text']['content'][:50] + "..."
            print(f"Block {i+1}: {block_type} - {content}")
        elif block_type == 'heading_2':
            content = block['heading_2']['rich_text'][0]['text']['content']
            print(f"Block {i+1}: {block_type} - {content}")
        elif block_type == 'divider':
            print(f"Block {i+1}: {block_type}")
        else:
            print(f"Block {i+1}: {block_type}")
    
    print("\n\n4. FEATURE HIGHLIGHTS")
    print("-" * 40)
    print("✓ Progressive disclosure based on quality score")
    print("✓ Content-type specific templates (Market News, Research Paper, etc.)")
    print("✓ Smart visibility rules (critical actions always visible)")
    print("✓ Platform-aware formatting (desktop/mobile/tablet)")
    print("✓ Reduced toggle count for high-quality content")
    print("✓ Clean separation of content vs metadata")
    
    print("\n\n5. MIGRATION NOTES")
    print("-" * 40)
    print("To enable the new formatter in production:")
    print("  1. Set environment variable: USE_NEW_FORMATTER=true")
    print("  2. Monitor logs for any formatting errors")
    print("  3. Compare output quality with legacy formatter")
    print("  4. Gradually increase rollout percentage")
    print("\n" + "=" * 80)


if __name__ == "__main__":
    print_formatting_comparison()