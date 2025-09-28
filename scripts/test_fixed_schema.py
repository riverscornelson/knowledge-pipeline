#!/usr/bin/env python3
"""Test fixed GPT-4.1 schema with additionalProperties"""

import os
import sys
import json
from pathlib import Path
from openai import OpenAI

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from core.config import PipelineConfig
from utils.logging import setup_logger

def test_fixed_schema():
    """Test GPT-4.1 with fixed schema"""
    logger = setup_logger(__name__)

    # Load config
    config = PipelineConfig.from_env()
    client = OpenAI(api_key=config.openai.api_key)

    # Test content - more substantial
    test_content = """
    OpenAI and Microsoft Partnership Tensions Reach Boiling Point

    Recent reports indicate growing tensions between OpenAI and Microsoft as their
    partnership evolves. Microsoft, which has invested $13 billion into OpenAI,
    is reportedly building its own AI models to reduce dependency.

    The key issues include:
    - Computing resource allocation and priority access
    - Revenue sharing agreements worth billions
    - Control over model deployment and safety measures
    - Competition in enterprise AI services

    Industry analysts suggest this could reshape the generative AI landscape,
    with implications for enterprise adoption, particularly in financial services
    and healthcare sectors where both companies compete for market share.
    """

    # Fixed schema with additionalProperties: false
    response_format = {
        "type": "json_schema",
        "json_schema": {
            "name": "document_classification",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "content_type": {
                        "type": "string",
                        "description": "Single content type category"
                    },
                    "topical_tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "minItems": 3,
                        "maxItems": 8,
                        "description": "Specific topics discussed"
                    },
                    "domain_tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "minItems": 1,
                        "maxItems": 3,
                        "description": "Industries or domains"
                    },
                    "ai_primitives": {
                        "type": "array",
                        "items": {"type": "string"},
                        "maxItems": 5,
                        "description": "AI technologies mentioned"
                    },
                    "vendor": {
                        "type": ["string", "null"],
                        "description": "Primary vendor discussed"
                    },
                    "confidence_score": {
                        "type": "number",
                        "minimum": 0,
                        "maximum": 1
                    },
                    "key_themes": {
                        "type": "array",
                        "items": {"type": "string"},
                        "maxItems": 3
                    }
                },
                "required": ["content_type", "topical_tags", "domain_tags",
                           "ai_primitives", "vendor", "confidence_score", "key_themes"],
                "additionalProperties": False  # FIXED: Added this line
            }
        }
    }

    system_prompt = """You are an expert document classifier for a GenAI consultant's knowledge base.
Analyze the content and generate accurate, specific tags that will help find this content later.

CONTENT TYPES to choose from:
Research, Market News, Vendor Capability, Thought Leadership, Case Study, Technical Tutorial, Analysis, Report

Be specific and practical with your tags."""

    print("🧪 Testing GPT-4.1 with fixed schema")
    print("-" * 50)

    try:
        response = client.chat.completions.create(
            model="gpt-4.1",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Classify this document:\n\n{test_content}"}
            ],
            response_format=response_format,
            temperature=0.2,
            max_tokens=1000
        )

        result = json.loads(response.choices[0].message.content)
        print(f"✅ SUCCESS! GPT-4.1 returned structured tags")
        print(f"\nModel used: {response.model}")
        print(f"\nClassification results:")
        print(json.dumps(result, indent=2))

        # Verify we got diverse tags (not defaults)
        if result['topical_tags'] == ["AI", "Technology", "Enterprise"]:
            print("\n⚠️  WARNING: Got default fallback tags!")
        else:
            print(f"\n✨ Got specific tags: {', '.join(result['topical_tags'])}")

    except Exception as e:
        print(f"❌ FAILED: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_fixed_schema()