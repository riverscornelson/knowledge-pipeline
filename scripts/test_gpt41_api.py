#!/usr/bin/env python3
"""Test GPT-4.1 API call to verify model name and structured outputs"""

import os
import sys
import json
from pathlib import Path
from openai import OpenAI

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from core.config import PipelineConfig
from utils.logging import setup_logger

def test_gpt41_api():
    """Test GPT-4.1 API call with structured outputs"""
    logger = setup_logger(__name__)

    # Load config
    config = PipelineConfig.from_env()
    client = OpenAI(api_key=config.openai.api_key)

    # Test content
    test_content = """
    This is a test article about OpenAI's latest GPT-5 model release.
    The model shows significant improvements in reasoning and reduced hallucination.
    Microsoft and OpenAI are partnering to bring this to enterprise customers.
    """

    # Build structured output schema
    response_format = {
        "type": "json_schema",
        "json_schema": {
            "name": "document_classification",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {
                    "content_type": {"type": "string"},
                    "topical_tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "minItems": 1,
                        "maxItems": 5
                    },
                    "vendor": {"type": ["string", "null"]}
                },
                "required": ["content_type", "topical_tags", "vendor"]
            }
        }
    }

    # Test different model names
    model_names = [
        "gpt-4.1",           # What user specified
        "gpt-4o",            # GPT-4 Omni (multimodal)
        "gpt-4-turbo",       # GPT-4 Turbo
        "gpt-4-1106-preview", # GPT-4 Turbo preview
        "gpt-4o-2024-08-06"  # Latest GPT-4o with structured outputs
    ]

    for model_name in model_names:
        print(f"\n🧪 Testing model: {model_name}")
        print("-" * 50)

        try:
            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "Classify this document."},
                    {"role": "user", "content": test_content}
                ],
                response_format=response_format,
                temperature=0.2,
                max_tokens=500
            )

            result = json.loads(response.choices[0].message.content)
            print(f"✅ SUCCESS with {model_name}")
            print(f"   Response: {json.dumps(result, indent=2)}")
            print(f"   Model used: {response.model}")

        except Exception as e:
            print(f"❌ FAILED with {model_name}")
            print(f"   Error: {str(e)}")

            # Try without structured outputs
            try:
                print(f"   🔄 Retrying without structured outputs...")
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": "Return JSON: {\"test\": \"value\"}"},
                        {"role": "user", "content": "Test"}
                    ],
                    temperature=0.2,
                    max_tokens=100
                )
                print(f"   ✅ Works without structured outputs")
                print(f"   Model used: {response.model}")
            except Exception as e2:
                print(f"   ❌ Also fails without structured outputs: {e2}")

if __name__ == "__main__":
    test_gpt41_api()