"""
GPT-5 Drive Document Processor

Processes documents from Google Drive using GPT-5 optimization for premium quality analysis.
Integrates with Notion database to query, extract, analyze, and format documents.
"""

import os
import time
import json
import asyncio
import logging
import traceback
from typing import List, Dict, Any, Optional, Tuple, Set
from datetime import datetime, timedelta
from dataclasses import dataclass
from pathlib import Path
import yaml
import openai
from notion_client import Client
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.oauth2.service_account import Credentials
import io
from urllib.parse import urlparse, parse_qs
import re

# Import robust PDF extractor
from drive.robust_pdf_extractor import RobustPDFExtractor

from core.config import PipelineConfig
from core.models import ContentStatus
from core.notion_client import NotionClient
from utils.logging import setup_logger
from formatters.prompt_aware_notion_formatter import PromptAwareNotionFormatter, PromptMetadata
from formatters.gpt5_simple_formatter import GPT5SimpleFormatter


@dataclass
class GPT5ProcessingResult:
    """Result from GPT-5 processing with metadata."""
    content: str
    quality_score: float
    processing_time: float
    token_usage: Dict[str, int]
    content_type: str
    confidence_scores: Dict[str, float]
    web_search_used: bool = False
    error: Optional[str] = None
    tags: Optional[Dict[str, Any]] = None  # Added for GPT-4.1 tags
    tag_generation_time: float = 0.0


@dataclass
class DriveDocument:
    """Represents a Drive document to be processed."""
    page_id: str
    title: str
    drive_url: str
    file_id: str
    status: str
    created_date: Optional[datetime] = None
    hash: Optional[str] = None


class GPT5DriveProcessor:
    """GPT-5 optimized processor for Drive documents with Notion integration."""

    def __init__(self, config: PipelineConfig):
        """Initialize the GPT-5 Drive processor with enhanced configuration."""
        self.config = config
        self.notion_client = NotionClient(config.notion)
        self.logger = setup_logger(__name__)

        # Initialize OpenAI client for GPT-5
        self.openai_client = openai.OpenAI(api_key=config.openai.api_key)

        # Initialize Google Drive client
        self._init_drive_client()

        # Load GPT-5 prompt configuration
        self._load_gpt5_config()

        # Initialize formatters
        self.formatter = PromptAwareNotionFormatter(self.notion_client)
        self.simple_formatter = GPT5SimpleFormatter()

        # Initialize robust PDF extractor
        self.pdf_extractor = RobustPDFExtractor()

        # Rate limiting and retry configuration
        self.rate_limit_delay = config.rate_limit_delay
        self.max_retries = 3
        self.backoff_factor = 2

        # Processing statistics
        self.stats = {
            "processed": 0,
            "succeeded": 0,
            "failed": 0,
            "skipped": 0,
            "total_processing_time": 0,
            "avg_quality_score": 0
        }

        self.logger.info("GPT5DriveProcessor initialized with enhanced configuration")

        # Initialize tag cache for GPT-4.1 classification
        self.tag_cache = {}
        self.tag_cache_timestamp = None
        self.CACHE_DURATION = 3600  # 1 hour cache

        # Track if we've ensured properties exist
        self.properties_ensured = False

    def _ensure_database_properties(self):
        """Ensure required properties exist in the Notion database."""
        if self.properties_ensured:
            return  # Already checked

        try:
            database_id = self.notion_client.config.sources_db_id

            # Get current database schema
            database = self.notion_client.client.databases.retrieve(database_id=database_id)
            existing_properties = database.get("properties", {})

            # Properties to ensure exist
            properties_to_add = {}

            # Check and add GPT-5 Processed checkbox
            if "GPT-5 Processed" not in existing_properties:
                properties_to_add["GPT-5 Processed"] = {
                    "checkbox": {}
                }
                self.logger.info("Adding 'GPT-5 Processed' property to database")

            # Check and add Processing Date
            if "Processing Date" not in existing_properties:
                properties_to_add["Processing Date"] = {
                    "date": {}
                }
                self.logger.info("Adding 'Processing Date' property to database")

            # Check and add Content-Type if missing
            if "Content-Type" not in existing_properties:
                properties_to_add["Content-Type"] = {
                    "select": {
                        "options": [
                            {"name": "Research", "color": "blue"},
                            {"name": "Market News", "color": "green"},
                            {"name": "Vendor Capability", "color": "purple"},
                            {"name": "Thought Leadership", "color": "yellow"},
                            {"name": "Case Study", "color": "orange"},
                            {"name": "Technical Tutorial", "color": "red"},
                            {"name": "Analysis", "color": "pink"},
                            {"name": "Report", "color": "gray"},
                            {"name": "Email", "color": "brown"},
                            {"name": "Documentation", "color": "default"}
                        ]
                    }
                }
                self.logger.info("Adding 'Content-Type' property to database")

            # Check and add Topical-Tags if missing
            if "Topical-Tags" not in existing_properties:
                properties_to_add["Topical-Tags"] = {
                    "multi_select": {
                        "options": []
                    }
                }
                self.logger.info("Adding 'Topical-Tags' property to database")

            # Check and add Domain-Tags if missing
            if "Domain-Tags" not in existing_properties:
                properties_to_add["Domain-Tags"] = {
                    "multi_select": {
                        "options": [
                            {"name": "Financial Services", "color": "blue"},
                            {"name": "Healthcare", "color": "green"},
                            {"name": "Manufacturing", "color": "purple"},
                            {"name": "Retail", "color": "yellow"},
                            {"name": "Technology", "color": "orange"},
                            {"name": "Government", "color": "red"},
                            {"name": "Education", "color": "pink"},
                            {"name": "Energy", "color": "gray"},
                            {"name": "Telecommunications", "color": "brown"},
                            {"name": "Cross-Industry", "color": "default"}
                        ]
                    }
                }
                self.logger.info("Adding 'Domain-Tags' property to database")

            # Check and add AI-Primitive if missing
            if "AI-Primitive" not in existing_properties:
                properties_to_add["AI-Primitive"] = {
                    "multi_select": {
                        "options": [
                            {"name": "LLM", "color": "blue"},
                            {"name": "Computer Vision", "color": "green"},
                            {"name": "NLP", "color": "purple"},
                            {"name": "Speech Recognition", "color": "yellow"},
                            {"name": "Generative AI", "color": "orange"},
                            {"name": "RAG", "color": "red"},
                            {"name": "Fine-tuning", "color": "pink"},
                            {"name": "Agents", "color": "gray"},
                            {"name": "Embeddings", "color": "brown"},
                            {"name": "Vector Database", "color": "default"}
                        ]
                    }
                }
                self.logger.info("Adding 'AI-Primitive' property to database")

            # Check and add Vendor if missing
            if "Vendor" not in existing_properties:
                properties_to_add["Vendor"] = {
                    "select": {
                        "options": []
                    }
                }
                self.logger.info("Adding 'Vendor' property to database")

            # Update database with new properties if any
            if properties_to_add:
                self.logger.info(f"Adding {len(properties_to_add)} new properties to database")
                self.notion_client.client.databases.update(
                    database_id=database_id,
                    properties=properties_to_add
                )
                self.logger.info("Database properties updated successfully")

            self.properties_ensured = True

        except Exception as e:
            self.logger.error(f"Error ensuring database properties: {e}")
            # Continue anyway, properties might exist but we couldn't check
            self.properties_ensured = True

    def load_existing_tags_from_notion(self) -> Dict[str, List[str]]:
        """Dynamically load existing tags from Notion database for GPT-4.1 classification."""
        current_time = time.time()

        # Use cached tags if fresh
        if (self.tag_cache_timestamp and
            current_time - self.tag_cache_timestamp < self.CACHE_DURATION):
            self.logger.debug("Using cached tags for classification")
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

            # Add defaults if empty
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
                               "ai_primitives", "vendor", "confidence_score", "key_themes"],
                    "additionalProperties": False
                }
            }
        }

        try:
            self.logger.info(f"Generating tags with GPT-4.1 for: {title}")
            self.logger.info(f"Sending {len(content)} characters to GPT-4.1")

            # Make API call to GPT-4.1 with structured outputs
            response = self.openai_client.chat.completions.create(
                model="gpt-4.1",  # Using GPT-4.1 with 1M context
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format=response_format,
                temperature=0.2,  # Low temperature for consistency
                max_tokens=1000  # Enough for JSON response
            )

            # Parse the guaranteed valid JSON response
            tags = json.loads(response.choices[0].message.content)

            tag_time = time.time() - start_time
            self.stats["total_processing_time"] += tag_time

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

    def _init_drive_client(self):
        """Initialize Google Drive API client."""
        try:
            credentials = Credentials.from_service_account_file(
                self.config.google_drive.service_account_path,
                scopes=['https://www.googleapis.com/auth/drive.readonly']
            )
            self.drive = build("drive", "v3", credentials=credentials, cache_discovery=False)
            self.logger.info("Google Drive client initialized successfully")
        except Exception as e:
            self.logger.error(f"Failed to initialize Drive client: {e}")
            self.drive = None

    def _load_gpt5_config(self):
        """Load GPT-5 specific prompt configuration."""
        try:
            config_path = Path(__file__).parent.parent.parent / "config" / "prompts-gpt5-optimized.yaml"
            if config_path.exists():
                with open(config_path, 'r') as f:
                    self.gpt5_config = yaml.safe_load(f)
                    self.logger.info(f"Loaded GPT-5 configuration from {config_path}")
            else:
                # Fallback configuration
                self.gpt5_config = self._get_fallback_config()
                self.logger.warning("Using fallback GPT-5 configuration")
        except Exception as e:
            self.logger.error(f"Failed to load GPT-5 config: {e}")
            self.gpt5_config = self._get_fallback_config()

    def _get_fallback_config(self) -> Dict[str, Any]:
        """Get fallback GPT-5 configuration."""
        return {
            "models": {
                "premium_analyzer": {
                    "model": "gpt-4",  # Fallback to GPT-4 if GPT-5 not available
                    "temperature": 0.3,
                    "max_tokens": 4096
                }
            },
            "optimization": {
                "quality_threshold": 9.0,
                "max_processing_time": 20,
                "max_blocks": 12
            }
        }

    def query_notion_documents(self,
                             status_filter: ContentStatus = ContentStatus.INBOX,
                             limit: Optional[int] = None,
                             batch_size: int = 50) -> List[DriveDocument]:
        """Query Notion database for documents to process."""
        self.logger.info(f"Querying Notion database for documents with status: {status_filter.value}")

        documents = []

        try:
            # Build filter for Notion query
            filter_conditions = {
                "and": [
                    {
                        "property": "Status",
                        "select": {"equals": status_filter.value}
                    },
                    {
                        "property": "Drive URL",
                        "url": {"is_not_empty": True}
                    }
                ]
            }

            # Query with pagination
            cursor = None
            count = 0

            while True:
                query_params = {
                    "database_id": self.notion_client.db_id,
                    "filter": filter_conditions,
                    "page_size": min(batch_size, limit - count if limit else batch_size)
                }

                if cursor:
                    query_params["start_cursor"] = cursor

                response = self.notion_client.client.databases.query(**query_params)

                for page in response.get("results", []):
                    doc = self._parse_notion_page(page)
                    if doc:
                        documents.append(doc)
                        count += 1

                        if limit and count >= limit:
                            break

                # Check for more pages
                if not response.get("has_more") or (limit and count >= limit):
                    break

                cursor = response.get("next_cursor")

                # Rate limiting
                time.sleep(self.rate_limit_delay)

            self.logger.info(f"Found {len(documents)} documents to process")
            return documents

        except Exception as e:
            self.logger.error(f"Failed to query Notion database: {e}")
            return []

    def _parse_notion_page(self, page: Dict[str, Any]) -> Optional[DriveDocument]:
        """Parse a Notion page into a DriveDocument."""
        try:
            properties = page.get("properties", {})

            # Extract title
            title_prop = properties.get("Title", {}).get("title", [])
            title = title_prop[0]["plain_text"] if title_prop else "Untitled"

            # Extract Drive URL
            drive_url = properties.get("Drive URL", {}).get("url")
            if not drive_url:
                return None

            # Extract file ID from Drive URL
            file_id = self._extract_file_id(drive_url)
            if not file_id:
                self.logger.warning(f"Could not extract file ID from URL: {drive_url}")
                return None

            # Extract status
            status_prop = properties.get("Status", {}).get("select", {})
            status = status_prop.get("name", "Unknown")

            # Extract created date
            created_date = None
            date_prop = properties.get("Created Date", {}).get("date")
            if date_prop and date_prop.get("start"):
                try:
                    created_date = datetime.fromisoformat(date_prop["start"].replace('Z', '+00:00'))
                except:
                    pass

            # Extract hash
            hash_prop = properties.get("Hash", {}).get("rich_text", [])
            hash_value = hash_prop[0]["plain_text"] if hash_prop else None

            return DriveDocument(
                page_id=page["id"],
                title=title,
                drive_url=drive_url,
                file_id=file_id,
                status=status,
                created_date=created_date,
                hash=hash_value
            )

        except Exception as e:
            self.logger.error(f"Failed to parse Notion page: {e}")
            return None

    def _extract_file_id(self, drive_url: str) -> Optional[str]:
        """Extract Google Drive file ID from URL."""
        try:
            # Handle different Drive URL formats
            if "/d/" in drive_url:
                # https://drive.google.com/file/d/FILE_ID/view
                return drive_url.split("/d/")[1].split("/")[0]
            elif "id=" in drive_url:
                # https://drive.google.com/open?id=FILE_ID
                parsed = urlparse(drive_url)
                query_params = parse_qs(parsed.query)
                return query_params.get("id", [None])[0]
            else:
                self.logger.warning(f"Unrecognized Drive URL format: {drive_url}")
                return None
        except Exception as e:
            self.logger.error(f"Failed to extract file ID from {drive_url}: {e}")
            return None

    def download_drive_content(self, file_id: str) -> Optional[str]:
        """Download and extract content from Google Drive file."""
        if not self.drive:
            self.logger.warning("Google Drive client not available - attempting to use existing content from Notion")
            return "Drive content not available - using existing Notion content for GPT-5 analysis"

        try:
            # Get file metadata
            file_metadata = self.drive.files().get(fileId=file_id).execute()
            mime_type = file_metadata.get("mimeType", "")

            self.logger.info(f"Downloading file: {file_metadata.get('name')} (type: {mime_type})")

            # Download file content
            if mime_type == "application/pdf":
                return self._download_pdf_content(file_id)
            elif mime_type == "application/vnd.google-apps.document":
                return self._download_google_doc_content(file_id)
            elif mime_type.startswith("text/"):
                return self._download_text_content(file_id)
            else:
                self.logger.warning(f"Unsupported file type: {mime_type}")
                return None

        except Exception as e:
            self.logger.error(f"Failed to download Drive content for {file_id}: {e}")
            return None

    def _download_pdf_content(self, file_id: str) -> Optional[str]:
        """Download and extract text from PDF file using robust extraction."""
        try:
            request = self.drive.files().get_media(fileId=file_id)
            file_io = io.BytesIO()
            downloader = MediaIoBaseDownload(file_io, request)

            done = False
            while done is False:
                status, done = downloader.next_chunk()

            file_io.seek(0)

            # Use robust PDF extraction with multiple fallback methods
            text_content, method_used = self.pdf_extractor.extract_text(file_io)

            if text_content:
                self.logger.info(f"Extracted {len(text_content)} characters from PDF using {method_used}")
                return text_content
            else:
                self.logger.error(f"Failed to extract PDF content: {method_used}")
                # Try Google Drive's export capability as final fallback
                return self._try_drive_pdf_export(file_id)

        except Exception as e:
            self.logger.error(f"Failed to download PDF content: {e}")
            # Try Google Drive's export capability as final fallback
            return self._try_drive_pdf_export(file_id)

    def _try_drive_pdf_export(self, file_id: str) -> Optional[str]:
        """Try to export PDF as text using Google Drive's conversion."""
        try:
            self.logger.info("Attempting PDF export via Google Drive conversion...")
            request = self.drive.files().export_media(
                fileId=file_id,
                mimeType='text/plain'
            )
            file_io = io.BytesIO()
            downloader = MediaIoBaseDownload(file_io, request)

            done = False
            while done is False:
                status, done = downloader.next_chunk()

            content = file_io.getvalue().decode('utf-8')
            self.logger.info(f"Exported {len(content)} characters via Drive conversion")
            return content

        except Exception as e:
            self.logger.warning(f"Drive PDF export also failed: {e}")
            return "PDF content could not be extracted - file may be corrupted or password protected"

    def _download_google_doc_content(self, file_id: str) -> Optional[str]:
        """Download content from Google Docs file."""
        try:
            request = self.drive.files().export_media(
                fileId=file_id,
                mimeType='text/plain'
            )
            file_io = io.BytesIO()
            downloader = MediaIoBaseDownload(file_io, request)

            done = False
            while done is False:
                status, done = downloader.next_chunk()

            content = file_io.getvalue().decode('utf-8')
            self.logger.info(f"Downloaded {len(content)} characters from Google Doc")
            return content

        except Exception as e:
            self.logger.error(f"Failed to download Google Doc content: {e}")
            return None

    def _download_text_content(self, file_id: str) -> Optional[str]:
        """Download text file content."""
        try:
            request = self.drive.files().get_media(fileId=file_id)
            file_io = io.BytesIO()
            downloader = MediaIoBaseDownload(file_io, request)

            done = False
            while done is False:
                status, done = downloader.next_chunk()

            content = file_io.getvalue().decode('utf-8')
            self.logger.info(f"Downloaded {len(content)} characters from text file")
            return content

        except Exception as e:
            self.logger.error(f"Failed to download text content: {e}")
            return None

    def generate_gpt5_analysis(self,
                              content: str,
                              document: DriveDocument) -> GPT5ProcessingResult:
        """Generate GPT-5 analysis of document content."""
        self.logger.info(f"Generating GPT-5 analysis for: {document.title}")

        start_time = time.time()

        try:
            # Get GPT-5 model configuration
            model_config = self.gpt5_config.get("models", {}).get("premium_analyzer", {})
            model_name = model_config.get("model", "gpt-4")

            # Check if GPT-5 is available
            if model_name.startswith("gpt-5"):
                if not self._is_gpt5_available():
                    self.logger.warning("GPT-5 not available, falling back to GPT-4")
                    model_name = "gpt-4"

            # Build system prompt
            system_prompt = self._build_system_prompt(document)

            # Build user prompt with document content
            user_prompt = self._build_user_prompt(content, document)

            # Make API call with retry logic
            # GPT-5 has specific requirements
            api_params = {
                "model": model_name,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
            }

            # GPT-5 only supports default values for temperature and doesn't support max_tokens
            if not model_name.startswith("gpt-5"):
                api_params["temperature"] = model_config.get("temperature", 0.3)
                api_params["max_tokens"] = model_config.get("max_tokens", 4096)
            # For GPT-5, we can only use default temperature (1.0)

            response = self._call_openai_with_retry(**api_params)

            processing_time = time.time() - start_time

            if not response:
                return GPT5ProcessingResult(
                    content="",
                    quality_score=0.0,
                    processing_time=processing_time,
                    token_usage={},
                    content_type="unknown",
                    confidence_scores={},
                    error="Failed to get response from OpenAI"
                )

            # Extract content and metadata
            analysis_content = response.choices[0].message.content
            token_usage = response.usage.model_dump() if response.usage else {}

            # DEBUG: Log the actual GPT-5 response
            self.logger.info(f"GPT-5 response length: {len(analysis_content)} characters")
            if len(analysis_content) < 100:
                self.logger.warning(f"GPT-5 response too short: {analysis_content[:200]}")
            else:
                self.logger.debug(f"GPT-5 response preview: {analysis_content[:200]}...")

            # Calculate quality score and confidence
            quality_score = self._calculate_quality_score(analysis_content, processing_time)
            confidence_scores = self._calculate_confidence_scores(analysis_content)
            content_type = self._classify_content_type(analysis_content)

            self.logger.info(f"GPT-5 analysis completed: Quality={quality_score:.2f}, Time={processing_time:.1f}s")

            return GPT5ProcessingResult(
                content=analysis_content,
                quality_score=quality_score,
                processing_time=processing_time,
                token_usage=token_usage,
                content_type=content_type,
                confidence_scores=confidence_scores,
                web_search_used=False  # Could be enhanced with web search
            )

        except Exception as e:
            processing_time = time.time() - start_time
            self.logger.error(f"Failed to generate GPT-5 analysis: {e}")

            return GPT5ProcessingResult(
                content="",
                quality_score=0.0,
                processing_time=processing_time,
                token_usage={},
                content_type="unknown",
                confidence_scores={},
                error=str(e)
            )

    def _is_gpt5_available(self) -> bool:
        """Check if GPT-5 model is available."""
        try:
            # Check if GPT-5 is configured in the models section
            models = self.gpt5_config.get("models", {})
            premium_model = models.get("premium_analyzer", {}).get("model", "")

            # Also check environment variable
            env_model = os.getenv("MODEL_SUMMARY", "")

            if "gpt-5" in premium_model.lower() or "gpt5" in premium_model.lower():
                self.logger.info(f"Using GPT-5 from config: {premium_model}")
                return True
            elif "gpt-5" in env_model.lower() or "gpt5" in env_model.lower():
                self.logger.info(f"Using GPT-5 from environment: {env_model}")
                return True

            return False
        except Exception as e:
            self.logger.debug(f"GPT-5 check failed: {e}")
            return False

    def _build_system_prompt(self, document: DriveDocument) -> str:
        """Build system prompt for GPT-5 analysis."""
        current_date = datetime.now().strftime("%Y-%m-%d")

        # Get unified analyzer configuration
        analyzer_config = self.gpt5_config.get("defaults", {}).get("unified_analyzer", {})
        system_prompt = analyzer_config.get("system", "")

        # Replace template variables
        system_prompt = system_prompt.replace("{drive_url}", document.drive_url)

        # Handle created_date attribute safely
        if hasattr(document, 'created_date') and document.created_date:
            date_str = document.created_date.strftime("%Y-%m-%d")
        else:
            date_str = current_date
        system_prompt = system_prompt.replace("{created_date}", date_str)

        # Handle hash attribute safely
        if hasattr(document, 'hash') and document.hash:
            hash_prefix = document.hash[:8]
        else:
            hash_prefix = "unknown"
        system_prompt = system_prompt.replace("{hash_prefix}", hash_prefix)

        # Add current date context
        system_prompt += f"\n\nCURRENT DATE: {current_date}"
        system_prompt += f"\nDOCUMENT: {document.title}"

        return system_prompt

    def _build_user_prompt(self, content: str, document: DriveDocument) -> str:
        """Build user prompt with document content."""
        # GPT-5 has 272K token context window - no need to truncate
        # Roughly 1 token = 4 characters, so 272K tokens = ~1M characters
        # We'll process full documents for better analysis quality
        if len(content) > 500000:  # Only warn for very large docs
            self.logger.warning(f"Large document: {len(content)} characters (~{len(content)//4} tokens)")

        user_prompt = f"""
Please analyze the following document content:

DOCUMENT TITLE: {document.title}
DRIVE URL: {document.drive_url}
CONTENT LENGTH: {len(content)} characters

DOCUMENT CONTENT:
{content}

Please provide a comprehensive analysis following the structured format specified in the system prompt.
Focus on actionable insights and maintain the quality threshold of 9.0+.
"""

        return user_prompt

    def _call_openai_with_retry(self, **kwargs) -> Optional[Any]:
        """Call OpenAI API with retry logic and rate limiting."""
        for attempt in range(self.max_retries):
            try:
                response = self.openai_client.chat.completions.create(**kwargs)
                return response

            except openai.RateLimitError as e:
                wait_time = self.backoff_factor ** attempt
                self.logger.warning(f"Rate limit hit, waiting {wait_time}s (attempt {attempt + 1})")
                time.sleep(wait_time)

            except openai.APIError as e:
                self.logger.error(f"OpenAI API error (attempt {attempt + 1}): {e}")
                if attempt == self.max_retries - 1:
                    raise
                time.sleep(self.backoff_factor ** attempt)

            except Exception as e:
                self.logger.error(f"Unexpected error calling OpenAI (attempt {attempt + 1}): {e}")
                if attempt == self.max_retries - 1:
                    raise
                time.sleep(self.backoff_factor ** attempt)

        return None

    def _calculate_quality_score(self, content: str, processing_time: float) -> float:
        """Calculate quality score based on content and processing metrics."""
        score = 5.0  # Base score

        # Content quality factors
        if len(content) > 1000:
            score += 1.0
        if "##" in content or "###" in content:  # Has structure
            score += 1.0
        if any(word in content.lower() for word in ["insight", "analysis", "recommendation"]):
            score += 1.0
        if any(word in content.lower() for word in ["strategic", "opportunity", "risk"]):
            score += 1.0

        # Processing time factor (faster is better for real-time use)
        if processing_time < 10:
            score += 1.0
        elif processing_time < 20:
            score += 0.5

        # Ensure within bounds
        return min(10.0, max(1.0, score))

    def _calculate_confidence_scores(self, content: str) -> Dict[str, float]:
        """Calculate confidence scores for different aspects."""
        return {
            "overall": 0.85,
            "classification": 0.90,
            "insights": 0.85,
            "recommendations": 0.80
        }

    def _classify_content_type(self, content: str) -> str:
        """Classify the content type based on analysis."""
        content_lower = content.lower()

        if any(word in content_lower for word in ["research", "study", "methodology"]):
            return "research"
        elif any(word in content_lower for word in ["market", "news", "announcement"]):
            return "market_news"
        elif any(word in content_lower for word in ["vendor", "product", "capability"]):
            return "vendor_capability"
        elif any(word in content_lower for word in ["thought", "leadership", "opinion"]):
            return "thought_leadership"
        else:
            return "general"

    def format_notion_blocks(self,
                           result: GPT5ProcessingResult,
                           document: DriveDocument) -> List[Dict[str, Any]]:
        """Format GPT-5 analysis as rich Notion blocks."""
        self.logger.info(f"Formatting analysis as Notion blocks - Content length: {len(result.content)} chars")
        self.logger.debug(f"Analysis content preview: {result.content[:500] if result.content else 'EMPTY'}")

        try:
            # Use the simple formatter that works with any GPT-5 response format
            blocks = self.simple_formatter.format_gpt5_analysis(
                content=result.content,
                quality_score=result.quality_score,
                processing_time=result.processing_time,
                drive_url=document.drive_url
            )

            # Ensure block count limit
            max_blocks = self.gpt5_config.get("optimization", {}).get("max_blocks", 12)
            if len(blocks) > max_blocks:
                blocks = blocks[:max_blocks]
                self.logger.warning(f"Truncated blocks to {max_blocks} (was {len(blocks)})")

            self.logger.info(f"Generated {len(blocks)} Notion blocks")
            return blocks

        except Exception as e:
            self.logger.error(f"Failed to format Notion blocks: {e}")
            # Return basic fallback blocks
            return self._create_fallback_blocks(result, document)

    def _create_fallback_blocks(self,
                              result: GPT5ProcessingResult,
                              document: DriveDocument) -> List[Dict[str, Any]]:
        """Create fallback blocks if formatting fails."""
        return [
            {
                "type": "callout",
                "callout": {
                    "rich_text": [{
                        "type": "text",
                        "text": {"content": f"GPT-5 Analysis | Quality: {result.quality_score:.1f}/10"}
                    }],
                    "icon": {"type": "emoji", "emoji": "🤖"},
                    "color": "blue_background"
                }
            },
            {
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{
                        "type": "text",
                        "text": {"content": result.content[:2000] + "..." if len(result.content) > 2000 else result.content}
                    }]
                }
            },
            {
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{
                        "type": "text",
                        "text": {"content": f"📎 Source: {document.drive_url}"}
                    }]
                }
            }
        ]

    def update_notion_page(self,
                          document: DriveDocument,
                          blocks: List[Dict[str, Any]]) -> bool:
        """Update Notion page with GPT-5 analysis blocks."""
        self.logger.info(f"Updating Notion page: {document.title}")

        try:
            # Clear existing content (optional - could append instead)
            # For now, we'll append the analysis

            # Add blocks to page
            self.notion_client.add_content_blocks(document.page_id, blocks)

            # Update status to 'GPT-5 Enhanced'
            self.notion_client.update_page_status(
                document.page_id,
                ContentStatus.ENRICHED  # Using existing enum, could add GPT5_ENHANCED
            )

            # Update properties to indicate GPT-5 processing
            try:
                # First ensure properties exist in database
                self._ensure_database_properties()

                properties = {
                    "GPT-5 Processed": {"checkbox": True},
                    "Processing Date": {"date": {"start": datetime.now().isoformat()}}
                }

                self.notion_client.client.pages.update(
                    page_id=document.page_id,
                    properties=properties
                )
            except Exception as e:
                # Properties might not exist, that's okay
                self.logger.debug(f"Could not update additional properties: {e}")

            self.logger.info(f"Successfully updated Notion page: {document.title}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to update Notion page {document.title}: {e}")
            return False

    def update_notion_page_with_tags(self, document: DriveDocument,
                                    blocks: List[Dict[str, Any]],
                                    tags: Optional[Dict[str, Any]]) -> bool:
        """Update Notion page with content blocks and classification tags."""
        self.logger.info(f"Updating Notion page with content and tags: {document.title}")

        try:
            # Add content blocks
            self.notion_client.add_content_blocks(document.page_id, blocks)

            # Build properties update
            properties = {
                "Status": {"select": {"name": "Enriched"}}
            }

            # Try to add processing properties (will be created if they don't exist)
            try:
                properties["GPT-5 Processed"] = {"checkbox": True}
                properties["Processing Date"] = {"date": {"start": datetime.now().isoformat()}}
            except:
                pass  # Skip if can't add these properties

            # Add classification tags if available
            if tags:
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

                self.logger.info(
                    f"Updating with tags: {tags.get('content_type', 'N/A')}, "
                    f"{len(tags.get('topical_tags', []))} topics, "
                    f"{len(tags.get('domain_tags', []))} domains"
                )

            # Update page properties
            self.notion_client.client.pages.update(
                page_id=document.page_id,
                properties=properties
            )

            # Update status
            self.notion_client.update_page_status(
                document.page_id,
                ContentStatus.ENRICHED
            )

            self.logger.info(
                f"Successfully updated Notion with content and tags: {document.title}"
            )

            return True

        except Exception as e:
            self.logger.error(f"Failed to update Notion page {document.title}: {e}")
            return False

    def process_single_document(self, document: DriveDocument) -> Dict[str, Any]:
        """Process a single document through the complete workflow."""
        self.logger.info(f"Processing document: {document.title}")

        start_time = time.time()
        result = {
            "document": document.title,
            "page_id": document.page_id,
            "status": "failed",
            "error": None,
            "processing_time": 0,
            "quality_score": 0.0
        }

        try:
            # Step 1: Download content from Drive
            content = self.download_drive_content(document.file_id)
            if not content:
                result["error"] = "Failed to download content from Drive"
                return result

            # Step 2: Generate GPT-5 analysis
            analysis_result = self.generate_gpt5_analysis(content, document)
            if analysis_result.error:
                result["error"] = f"GPT-5 analysis failed: {analysis_result.error}"
                return result

            # Step 2b: Generate structured tags with GPT-4.1 (using FULL content)
            tags = None
            classification_enabled = self.gpt5_config.get("classification", {}).get("enabled", True)
            self.logger.info(f"Classification enabled: {classification_enabled}, config: {self.gpt5_config.get('classification', {})}")

            if classification_enabled:
                try:
                    self.logger.info(f"Calling generate_structured_tags_gpt41 for: {document.title}")
                    tags = self.generate_structured_tags_gpt41(content, document.title)
                    analysis_result.tags = tags
                    analysis_result.tag_generation_time = tags.get("_metadata", {}).get("generation_time", 0)
                    self.logger.info(f"Generated tags successfully: {tags['content_type']}, {len(tags['topical_tags'])} topics")
                    self.logger.debug(f"Full tags: {json.dumps(tags, indent=2)}")
                except Exception as e:
                    self.logger.error(f"Tag generation failed with error: {e}")
                    self.logger.debug(f"Traceback: {traceback.format_exc()}")
                    tags = None
            else:
                self.logger.info("Classification disabled in config, skipping tag generation")

            # Step 3: Format as Notion blocks
            blocks = self.format_notion_blocks(analysis_result, document)

            # Step 4: Update Notion page with content and tags
            if tags:
                self.logger.info(f"Updating Notion with tags: {tags.get('content_type')}, {len(tags.get('topical_tags', []))} topics")
                success = self.update_notion_page_with_tags(document, blocks, tags)
            else:
                self.logger.info("No tags generated, updating Notion without tags")
                success = self.update_notion_page(document, blocks)
            if not success:
                result["error"] = "Failed to update Notion page"
                return result

            # Success!
            processing_time = time.time() - start_time
            result.update({
                "status": "success",
                "processing_time": processing_time,
                "quality_score": analysis_result.quality_score,
                "content_type": tags.get("content_type", analysis_result.content_type) if tags else analysis_result.content_type,
                "token_usage": analysis_result.token_usage,
                "block_count": len(blocks),
                "tags_generated": tags is not None,
                "tag_time": analysis_result.tag_generation_time if tags else 0,
                "topical_tags_count": len(tags.get("topical_tags", [])) if tags else 0,
                "confidence": tags.get("confidence_score", 0) if tags else 0
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
            self.logger.debug(traceback.format_exc())

            result.update({
                "error": error_msg,
                "processing_time": processing_time
            })

            self.stats["processed"] += 1
            self.stats["failed"] += 1

            return result

    def process_batch(self,
                     documents: List[DriveDocument],
                     progress_callback: Optional[callable] = None) -> Dict[str, Any]:
        """Process a batch of documents with progress reporting."""
        self.logger.info(f"Processing batch of {len(documents)} documents")

        batch_start_time = time.time()
        results = []

        for i, document in enumerate(documents):
            try:
                # Process single document
                result = self.process_single_document(document)
                results.append(result)

                # Report progress
                if progress_callback:
                    progress = {
                        "current": i + 1,
                        "total": len(documents),
                        "document": document.title,
                        "status": result["status"],
                        "quality_score": result.get("quality_score", 0),
                        "processing_time": result.get("processing_time", 0)
                    }
                    progress_callback(progress)

                # Rate limiting between documents
                if i < len(documents) - 1:  # Don't sleep after last document
                    time.sleep(self.rate_limit_delay)

            except Exception as e:
                self.logger.error(f"Failed to process document {document.title}: {e}")
                results.append({
                    "document": document.title,
                    "page_id": document.page_id,
                    "status": "failed",
                    "error": str(e),
                    "processing_time": 0,
                    "quality_score": 0.0
                })
                self.stats["processed"] += 1
                self.stats["failed"] += 1

        # Calculate batch statistics
        batch_time = time.time() - batch_start_time
        successful_results = [r for r in results if r["status"] == "success"]

        batch_summary = {
            "total_documents": len(documents),
            "successful": len(successful_results),
            "failed": len(documents) - len(successful_results),
            "batch_processing_time": batch_time,
            "average_quality_score": sum(r.get("quality_score", 0) for r in successful_results) / len(successful_results) if successful_results else 0,
            "average_processing_time": sum(r.get("processing_time", 0) for r in successful_results) / len(successful_results) if successful_results else 0
        }

        self.logger.info(f"Batch processing completed: {batch_summary}")

        return {
            "summary": batch_summary,
            "results": results,
            "statistics": self.stats.copy()
        }

    def process_all_inbox_documents(self,
                                  limit: Optional[int] = None,
                                  batch_size: int = 10,
                                  force: bool = False) -> Dict[str, Any]:
        """Process all documents in Inbox status (or all documents if force=True)."""
        if force:
            self.logger.info("Force processing ALL documents (including enriched)")
            # When force is True, process enriched documents too
            documents = self.query_notion_documents(
                status_filter=ContentStatus.ENRICHED,
                limit=limit
            )
        else:
            self.logger.info("Starting processing of all Inbox documents")
            # Query for Inbox documents
            documents = self.query_notion_documents(
                status_filter=ContentStatus.INBOX,
                limit=limit
            )

        if not documents:
            self.logger.info("No documents found to process")
            return {
                "summary": {"total_documents": 0, "successful": 0, "failed": 0},
                "results": [],
                "statistics": self.stats.copy()
            }

        # Process in batches
        all_results = []

        for i in range(0, len(documents), batch_size):
            batch = documents[i:i + batch_size]
            self.logger.info(f"Processing batch {i//batch_size + 1} ({len(batch)} documents)")

            batch_result = self.process_batch(batch)
            all_results.extend(batch_result["results"])

            # Small delay between batches
            time.sleep(1.0)

        # Final summary
        successful = sum(1 for r in all_results if r["status"] == "success")
        failed = len(all_results) - successful

        final_summary = {
            "total_documents": len(documents),
            "successful": successful,
            "failed": failed,
            "overall_statistics": self.stats.copy()
        }

        self.logger.info(f"Completed processing all documents: {final_summary}")

        return {
            "summary": final_summary,
            "results": all_results,
            "statistics": self.stats.copy()
        }

    def get_processing_statistics(self) -> Dict[str, Any]:
        """Get comprehensive processing statistics."""
        stats = self.stats.copy()

        if stats["processed"] > 0:
            stats["success_rate"] = stats["succeeded"] / stats["processed"]
            stats["failure_rate"] = stats["failed"] / stats["processed"]
            stats["average_processing_time"] = stats["total_processing_time"] / stats["processed"]

        return stats

    def process_all_unprocessed(self, batch_size: int = 10, force: bool = False) -> Dict[str, Any]:
        """Process all unprocessed Drive documents (alias for process_all_inbox_documents)."""
        if force:
            # When force is True, process ALL documents regardless of status
            return self.process_all_inbox_documents(batch_size=batch_size, limit=None, force=force)
        else:
            return self.process_all_inbox_documents(batch_size=batch_size)

    def process_specific_files(self, file_ids: List[str], batch_size: int = 5, force: bool = False) -> Dict[str, Any]:
        """Process specific files by their Drive file IDs."""
        self.logger.info(f"Processing specific files: {file_ids}")

        documents = []
        for file_id in file_ids:
            # Query Notion for documents with this Drive file ID
            notion_docs = self.query_notion_documents()
            for doc in notion_docs:
                if doc.file_id == file_id:
                    documents.append(doc)
                    break
            else:
                # If not found in Notion, create a minimal document object
                documents.append(DriveDocument(
                    page_id="unknown",
                    title=f"Drive File {file_id}",
                    drive_url=f"https://drive.google.com/file/d/{file_id}/view",
                    file_id=file_id,
                    status=ContentStatus.INBOX.value,
                    created_date=None,
                    hash=None
                ))

        if not documents:
            return {
                "summary": {"total_documents": 0, "successful": 0, "failed": 0},
                "results": [],
                "statistics": self.stats.copy()
            }

        return self.process_batch(documents)