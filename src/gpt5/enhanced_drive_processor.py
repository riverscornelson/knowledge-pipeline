"""
Enhanced GPT5 Drive Processor with GPT-4.1 Tagging
Uses dual-model approach: GPT-5 for content, GPT-4.1 for structured tagging
"""
import json
import time
import traceback
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass, field

from openai import OpenAI
from google.oauth2 import service_account
from googleapiclient.discovery import build

from core.models import ContentStatus
from core.notion_client import NotionClient
from utils.logging import setup_logger


@dataclass
class EnhancedProcessingResult:
    """Enhanced result with both content and tags"""
    content: str
    tags: Dict[str, Any]
    quality_score: float
    processing_time: float
    token_usage: Dict[str, int]
    content_type: str
    confidence_scores: Dict[str, float]
    tag_generation_time: float = 0.0
    error: Optional[str] = None
    web_search_used: bool = False


class EnhancedGPT5DriveProcessor:
    """Enhanced processor with dual-model approach for content and tagging"""

    def __init__(self, config):
        """Initialize with configuration"""
        self.config = config
        self.logger = setup_logger(__name__)

        # Initialize OpenAI client
        self.client = OpenAI(api_key=config.openai.api_key)

        # Initialize Notion client
        self.notion_client = NotionClient(config.notion)

        # Initialize Drive client
        self._init_drive_client()

        # Tag cache for performance
        self.tag_cache = {}
        self.tag_cache_timestamp = None
        self.CACHE_DURATION = 3600  # 1 hour cache

        # Load GPT-5 configuration
        self.gpt5_config = self._load_gpt5_config()

        # Statistics
        self.stats = {
            "processed": 0,
            "succeeded": 0,
            "failed": 0,
            "total_processing_time": 0,
            "total_tag_time": 0
        }

    def load_existing_tags_from_notion(self) -> Dict[str, List[str]]:
        """Dynamically load existing tags from Notion database"""

        current_time = time.time()

        # Use cached tags if fresh
        if (self.tag_cache_timestamp and
            current_time - self.tag_cache_timestamp < self.CACHE_DURATION):
            self.logger.debug("Using cached tags")
            return self.tag_cache

        self.logger.info("Loading existing tags from Notion database...")

        try:
            # Get database schema
            database = self.notion_client.client.databases.retrieve(
                database_id=self.notion_client.config.sources_db_id
            )

            properties = database.get("properties", {})

            # Extract existing options for each tag type
            tags = {
                "content_types": [],
                "topical_tags": [],
                "domain_tags": [],
                "ai_primitives": [],
                "vendors": []
            }

            # Content-Type (single select)
            if "Content-Type" in properties:
                prop = properties["Content-Type"]
                if prop.get("type") == "select":
                    options = prop.get("select", {}).get("options", [])
                    tags["content_types"] = [opt["name"] for opt in options]

            # Topical-Tags (multi-select)
            if "Topical-Tags" in properties:
                prop = properties["Topical-Tags"]
                if prop.get("type") == "multi_select":
                    options = prop.get("multi_select", {}).get("options", [])
                    tags["topical_tags"] = [opt["name"] for opt in options]

            # Domain-Tags (multi-select)
            if "Domain-Tags" in properties:
                prop = properties["Domain-Tags"]
                if prop.get("type") == "multi_select":
                    options = prop.get("multi_select", {}).get("options", [])
                    tags["domain_tags"] = [opt["name"] for opt in options]

            # AI-Primitive (multi-select)
            if "AI-Primitive" in properties:
                prop = properties["AI-Primitive"]
                if prop.get("type") == "multi_select":
                    options = prop.get("multi_select", {}).get("options", [])
                    tags["ai_primitives"] = [opt["name"] for opt in options]

            # Vendor (single select)
            if "Vendor" in properties:
                prop = properties["Vendor"]
                if prop.get("type") == "select":
                    options = prop.get("select", {}).get("options", [])
                    tags["vendors"] = [opt["name"] for opt in options]

            # Add default options if empty
            if not tags["content_types"]:
                tags["content_types"] = [
                    "Research", "Market News", "Vendor Capability",
                    "Thought Leadership", "Case Study", "Technical Tutorial",
                    "Analysis", "Report", "Email", "Documentation"
                ]

            if not tags["domain_tags"]:
                tags["domain_tags"] = [
                    "Financial Services", "Healthcare", "Manufacturing",
                    "Retail", "Technology", "Government", "Education",
                    "Energy", "Telecommunications", "Cross-Industry"
                ]

            if not tags["ai_primitives"]:
                tags["ai_primitives"] = [
                    "LLM", "Computer Vision", "NLP", "Speech Recognition",
                    "Generative AI", "RAG", "Fine-tuning", "Agents",
                    "Embeddings", "Vector Database", "MLOps", "Transformers"
                ]

            self.tag_cache = tags
            self.tag_cache_timestamp = current_time

            self.logger.info(
                f"Loaded tags: {len(tags['content_types'])} content types, "
                f"{len(tags['topical_tags'])} topical tags, "
                f"{len(tags['domain_tags'])} domain tags, "
                f"{len(tags['ai_primitives'])} AI primitives, "
                f"{len(tags['vendors'])} vendors"
            )

            return tags

        except Exception as e:
            self.logger.error(f"Failed to load tags from Notion: {e}")
            # Return defaults on error
            return {
                "content_types": ["Research", "Market News", "Analysis"],
                "topical_tags": [],
                "domain_tags": ["Technology"],
                "ai_primitives": ["LLM", "Generative AI"],
                "vendors": []
            }

    def generate_structured_tags_gpt41(self, content: str, title: str) -> Dict[str, Any]:
        """
        Generate tags using GPT-4.1 with structured outputs.
        Uses FULL content with 1M token context window.
        """

        start_time = time.time()

        # Load existing tags from Notion
        existing_tags = self.load_existing_tags_from_notion()

        # Build dynamic system prompt with existing tags
        system_prompt = f"""You are an expert document classifier for a Generative AI consultant's knowledge base.
Your task is to generate accurate classification tags that help find content during client engagements.

IMPORTANT: You have access to the FULL document content. Analyze thoroughly before classifying.

EXISTING DATABASE OPTIONS (prefer these for consistency, but create new if needed):

CONTENT TYPES (select ONE):
{', '.join(existing_tags['content_types'])}

TOPICAL TAGS (already in database - prefer these):
{', '.join(existing_tags['topical_tags'][:50]) if existing_tags['topical_tags'] else 'Create relevant tags based on content'}
[{len(existing_tags['topical_tags'])} total existing tags]

DOMAIN TAGS (already in database):
{', '.join(existing_tags['domain_tags'])}

AI PRIMITIVES (already in database):
{', '.join(existing_tags['ai_primitives'])}

VENDORS (already in database - top ones):
{', '.join(existing_tags['vendors'][:30]) if existing_tags['vendors'] else 'Identify primary vendor from content'}
[{len(existing_tags['vendors'])} total existing vendors]

CLASSIFICATION GUIDELINES:
1. Read the ENTIRE document thoroughly - you have the full content
2. Prefer existing tags when accurate for consistency
3. Create new tags only when existing ones don't fit
4. Be specific with topical tags (e.g., "prompt engineering" not just "AI")
5. Focus on practical tags that help find content for client work
6. For vendors, identify the PRIMARY company discussed (not just mentioned)"""

        # Build user prompt with FULL content
        user_prompt = f"""Analyze this complete document and generate classification tags:

TITLE: {title}

FULL DOCUMENT CONTENT:
{content}

[END OF DOCUMENT]

Generate accurate classification tags based on the COMPLETE content above."""

        # Build structured output schema for GPT-4.1
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
                            "description": "Specific topics discussed in the document"
                        },
                        "domain_tags": {
                            "type": "array",
                            "items": {"type": "string"},
                            "minItems": 1,
                            "maxItems": 3,
                            "description": "Industries or business domains"
                        },
                        "ai_primitives": {
                            "type": "array",
                            "items": {"type": "string"},
                            "maxItems": 5,
                            "description": "AI technologies mentioned (can be empty array)"
                        },
                        "vendor": {
                            "type": ["string", "null"],
                            "description": "Primary vendor/company discussed or null"
                        },
                        "confidence_score": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 1,
                            "description": "Confidence in classification (0-1)"
                        },
                        "key_themes": {
                            "type": "array",
                            "items": {"type": "string"},
                            "maxItems": 3,
                            "description": "Main themes identified in content"
                        }
                    },
                    "required": ["content_type", "topical_tags", "domain_tags",
                               "ai_primitives", "vendor", "confidence_score", "key_themes"]
                }
            }
        }

        try:
            self.logger.info(f"Generating tags with GPT-4.1 for: {title}")
            self.logger.info(f"Sending {len(content)} characters to GPT-4.1")

            # Make API call to GPT-4.1 with structured outputs
            response = self.client.chat.completions.create(
                model="gpt-4.1",  # Using GPT-4.1 as specified
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format=response_format,
                temperature=0.2,  # Low temperature for consistency
                max_tokens=1000  # Plenty for JSON response
            )

            # Parse the guaranteed valid JSON response
            tags = json.loads(response.choices[0].message.content)

            tag_time = time.time() - start_time
            self.stats["total_tag_time"] += tag_time

            self.logger.info(
                f"Generated tags in {tag_time:.1f}s: "
                f"Type={tags['content_type']}, "
                f"Topics={len(tags['topical_tags'])}, "
                f"Confidence={tags['confidence_score']:.2f}"
            )

            # Add timing metadata
            tags["_metadata"] = {
                "generation_time": tag_time,
                "content_length": len(content),
                "model": "gpt-4.1"
            }

            return tags

        except Exception as e:
            self.logger.error(f"Tag generation failed: {e}")
            self.logger.debug(traceback.format_exc())

            # Return sensible defaults on error
            return {
                "content_type": "Analysis",
                "topical_tags": ["AI", "Technology", "Enterprise"],
                "domain_tags": ["Technology"],
                "ai_primitives": [],
                "vendor": None,
                "confidence_score": 0.5,
                "key_themes": ["General Content"],
                "_metadata": {
                    "generation_time": time.time() - start_time,
                    "error": str(e)
                }
            }

    def process_document_with_tags(self, document) -> Dict[str, Any]:
        """
        Process document with dual-model approach:
        1. GPT-5 for consultant-friendly content
        2. GPT-4.1 for structured tagging with full content
        """

        self.logger.info(f"Processing with dual-model: {document.title}")

        start_time = time.time()
        result = {
            "document": document.title,
            "page_id": document.page_id,
            "status": "failed",
            "error": None,
            "processing_time": 0,
            "tag_time": 0,
            "quality_score": 0.0
        }

        try:
            # Step 1: Download content from Drive
            content = self.download_drive_content(document.file_id)
            if not content:
                result["error"] = "Failed to download content from Drive"
                return result

            # Step 2a: Generate GPT-5 analysis (consultant summary)
            analysis_result = self.generate_gpt5_analysis(content, document)
            if analysis_result.error:
                result["error"] = f"GPT-5 analysis failed: {analysis_result.error}"
                return result

            # Step 2b: Generate structured tags with GPT-4.1 (using FULL content)
            tags = self.generate_structured_tags_gpt41(content, document.title)

            # Step 3: Format as Notion blocks
            blocks = self.format_notion_blocks(analysis_result, document)

            # Step 4: Update Notion page with content and tags
            success = self.update_notion_page_with_tags(document, blocks, tags)
            if not success:
                result["error"] = "Failed to update Notion page"
                return result

            # Success!
            processing_time = time.time() - start_time
            result.update({
                "status": "success",
                "processing_time": processing_time,
                "tag_time": tags["_metadata"]["generation_time"],
                "quality_score": analysis_result.quality_score,
                "content_type": tags["content_type"],
                "tags_count": len(tags["topical_tags"]),
                "confidence": tags["confidence_score"]
            })

            # Update statistics
            self.stats["processed"] += 1
            self.stats["succeeded"] += 1
            self.stats["total_processing_time"] += processing_time

            return result

        except Exception as e:
            processing_time = time.time() - start_time
            error_msg = f"Unexpected error: {str(e)}"
            self.logger.error(f"Failed to process {document.title}: {error_msg}")

            result.update({
                "error": error_msg,
                "processing_time": processing_time
            })

            self.stats["processed"] += 1
            self.stats["failed"] += 1

            return result

    def update_notion_page_with_tags(self, document, blocks, tags) -> bool:
        """Update Notion page with content blocks and classification tags"""

        try:
            # Add content blocks
            self.notion_client.add_content_blocks(document.page_id, blocks)

            # Build properties update
            properties = {
                "Status": {"select": {"name": "Enriched"}},
                "GPT-5 Processed": {"checkbox": True},
                "Processing Date": {"date": {"start": datetime.now().isoformat()}}
            }

            # Add classification tags
            if tags.get("content_type"):
                properties["Content-Type"] = {
                    "select": {"name": tags["content_type"]}
                }

            if tags.get("topical_tags"):
                properties["Topical-Tags"] = {
                    "multi_select": [{"name": tag} for tag in tags["topical_tags"]]
                }

            if tags.get("domain_tags"):
                properties["Domain-Tags"] = {
                    "multi_select": [{"name": tag} for tag in tags["domain_tags"]]
                }

            if tags.get("ai_primitives") and len(tags["ai_primitives"]) > 0:
                properties["AI-Primitive"] = {
                    "multi_select": [{"name": tag} for tag in tags["ai_primitives"]]
                }

            if tags.get("vendor"):
                properties["Vendor"] = {
                    "select": {"name": tags["vendor"]}
                }

            # Update page properties
            self.notion_client.client.pages.update(
                page_id=document.page_id,
                properties=properties
            )

            self.logger.info(
                f"Updated Notion with content and tags: {document.title} "
                f"[{tags['content_type']}, {len(tags['topical_tags'])} topics]"
            )

            return True

        except Exception as e:
            self.logger.error(f"Failed to update Notion: {e}")
            return False

    # Include other necessary methods from original GPT5DriveProcessor
    # (download_drive_content, generate_gpt5_analysis, format_notion_blocks, etc.)
    # These would be copied from the existing implementation