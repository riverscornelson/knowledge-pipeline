#!/usr/bin/env python3
"""Test script to verify insights formatting fix."""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.config import PipelineConfig
from src.enrichment.enhanced_insights import EnhancedInsightsGenerator
from src.utils.notion_formatter import NotionFormatter
import json


def test_insights_formatting():
    """Test that insights are properly formatted without bullet point issues."""
    
    # Create a minimal config using a mock object
    class MockConfig:
        def __init__(self):
            self.openai = type('obj', (object,), {'api_key': 'test-key'})()
            self.notion = type('obj', (object,), {'api_key': 'test', 'database_id': 'test'})()
            self.enrichment = type('obj', (object,), {'prompt_config_path': None})()
    
    config = MockConfig()
    
    # Create insights generator
    generator = EnhancedInsightsGenerator(config, None)
    
    # Test content
    test_content = """
    Anthropic has released Claude 3.5 Sonnet with groundbreaking computer use capabilities.
    The model can interact with computer interfaces like a human user through screenshot 
    analysis and action execution. It achieves 92% on coding benchmarks and introduces
    autonomous workflow capabilities.
    """
    
    # Generate the prompt to see the expected format
    prompt = generator._build_prompt(test_content, "Test Document", {})
    print("Generated Prompt:")
    print("-" * 80)
    print(prompt)
    print("-" * 80)
    
    # Simulate AI response with proper formatting
    simulated_response = """
### Immediate Actions
• Deploy Claude 3.5 Sonnet in test environments to validate computer use capabilities before production rollout
• Establish safety protocols and access controls for autonomous agent operations

### Strategic Opportunities
• Replace traditional RPA solutions with AI-powered automation for complex workflows
• Develop new product offerings leveraging computer use for customer support automation

### Risk Factors
• Monitor for potential security vulnerabilities from autonomous system access
• Prepare for regulatory scrutiny around AI agents with computer control capabilities

### Market Implications
• Expect disruption in RPA market as AI agents become more cost-effective
• Anticipate competitive responses from OpenAI and Microsoft within 3-6 months

### Innovation Potential
• Create hybrid human-AI workflows for complex data processing tasks
• Build intelligent testing frameworks that adapt to UI changes automatically
"""
    
    print("\nSimulated AI Response:")
    print("-" * 80)
    print(simulated_response)
    print("-" * 80)
    
    # Test the parsing logic from pipeline_processor
    print("\nTesting insight extraction:")
    lines = simulated_response.split('\n')
    key_insights = []
    
    for line in lines:
        line = line.strip()
        # Skip empty lines and markdown headers
        if not line or line.startswith('#'):
            continue
        # Extract bullet point content
        import re
        bullet_match = re.match(r'^[•\-\*]\s*(.+)$', line)
        if bullet_match:
            insight = bullet_match.group(1).strip()
            # Skip if it looks like a section header
            if not (insight.endswith(':') or 
                    any(header in insight for header in ['Immediate Actions', 'Strategic Opportunities', 
                                                         'Risk Factors', 'Market Implications', 
                                                         'Innovation Potential'])):
                key_insights.append(insight)
    
    print(f"Extracted {len(key_insights)} insights:")
    for i, insight in enumerate(key_insights, 1):
        print(f"{i}. {insight}")
    
    # Test NotionFormatter with structured content
    print("\n" + "=" * 80)
    print("Testing Notion Formatting:")
    print("=" * 80)
    
    formatter = NotionFormatter()
    blocks = formatter.format_content(simulated_response, content_type="insights")
    
    print(f"\nGenerated {len(blocks)} Notion blocks:")
    for i, block in enumerate(blocks):
        print(f"\nBlock {i + 1}:")
        print(json.dumps(block, indent=2))
        if i >= 3:  # Show first 4 blocks
            print(f"\n... and {len(blocks) - i - 1} more blocks")
            break


if __name__ == "__main__":
    test_insights_formatting()