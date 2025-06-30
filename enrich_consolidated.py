#!/usr/bin/env python3
"""
Consolidated Knowledge Pipeline Enrichment Script

This script consolidates all enrichment functionality from:
- enrich.py, enrich_rss.py, enrich_enhanced.py, enrich_rss_enhanced.py
- enrich_rss_resilient.py, enrich_parallel.py, postprocess.py

Key improvements:
- Streamlined AI processing (3 analyses instead of 20+)
- Proper markdown-to-Notion formatting
- Unified processing for all content types
- Enhanced error handling and logging
"""

import os
import asyncio
import time
import json
import hashlib
import re
import io
import html
import urllib.request
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import Optional, Dict, List, Any, Tuple
from urllib.parse import urlparse, parse_qs
from urllib.error import URLError

import requests
from notion_client import Client
from openai import OpenAI
from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials
from googleapiclient.http import MediaIoBaseDownload
from pdfminer.high_level import extract_text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import existing utilities
from api_resilience import with_notion_resilience, ResilientNotionOps
from logger import setup_logger, track_performance, track_api_call, PipelineMetrics

# Configuration
MAX_CHUNK = 1900
OPENAI_TIMEOUT = 60

# Date extraction patterns
DATE_PATTERNS = [
    r"\b(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|September|Oct|October|Nov|November|Dec|December)\s+\d{1,2},\s+\d{4}\b",
    r"\b\d{1,2}\s+(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|September|Oct|October|Nov|November|Dec|December)\s+\d{4}\b", 
    r"\b\d{4}-\d{2}-\d{2}\b",
]

DATE_FORMATS = ["%B %d, %Y", "%b %d, %Y", "%d %B %Y", "%Y-%m-%d"]

@dataclass
class ProcessingConfig:
    """Configuration for consolidated enrichment processing"""
    parallel_enabled: bool = False
    max_workers: int = 5
    rate_limit_delay: float = 0.1
    use_enhanced_logging: bool = True
    model_summary: str = "gpt-4o"
    model_classifier: str = "gpt-4o-mini"  # Cheaper for classification
    model_insights: str = "gpt-4o"

class ConsolidatedEnricher:
    """Unified enrichment processor for all content types"""
    
    def __init__(self):
        self.notion = Client(auth=os.getenv("NOTION_TOKEN"))
        self.openai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.sources_db = os.getenv("NOTION_SOURCES_DB")
        self.logger = setup_logger(__name__)
        self.metrics = PipelineMetrics(self.logger)
        self.config = ProcessingConfig()
        self.resilient_ops = ResilientNotionOps(self.notion)
        
        # Setup Google Drive API
        self.drive = None
        if os.getenv("GOOGLE_APP_CREDENTIALS"):
            try:
                credentials = Credentials.from_service_account_file(
                    os.getenv("GOOGLE_APP_CREDENTIALS")
                )
                self.drive = build("drive", "v3", credentials=credentials, cache_discovery=False)
            except Exception as e:
                self.logger.warning(f"Could not initialize Google Drive API: {e}")
        
        # Load taxonomy once
        self.taxonomy = self._fetch_taxonomy()
        
    def _fetch_taxonomy(self) -> Dict[str, List[str]]:
        """Load classification taxonomies from Notion database schema"""
        try:
            db_info = self.notion.databases.retrieve(self.sources_db)
            properties = db_info.get("properties", {})
            
            # Extract Content-Type options
            content_types = []
            if "Content-Type" in properties:
                options = properties["Content-Type"].get("select", {}).get("options", [])
                content_types = [opt["name"] for opt in options]
            
            # Extract AI-Primitive options  
            ai_primitives = []
            if "AI-Primitive" in properties:
                options = properties["AI-Primitive"].get("multi_select", {}).get("options", [])
                ai_primitives = [opt["name"] for opt in options]
                
            # Extract Vendor options
            vendors = []
            if "Vendor" in properties:
                options = properties["Vendor"].get("select", {}).get("options", [])
                vendors = [opt["name"] for opt in options]
            
            self.logger.info(f"Loaded taxonomy: {len(content_types)} content types, {len(ai_primitives)} AI primitives, {len(vendors)} vendors")
            
            return {
                "content_types": content_types,
                "ai_primitives": ai_primitives, 
                "vendors": vendors
            }
            
        except Exception as e:
            self.logger.error(f"Failed to fetch taxonomy: {e}")
            return {"content_types": [], "ai_primitives": [], "vendors": []}

    def inbox_rows(self) -> List[Dict]:
        """Query Notion database for items needing enrichment"""
        try:
            # Query items with Status="Inbox" and required URLs
            filter_condition = {
                "and": [
                    {"property": "Status", "select": {"equals": "Inbox"}},
                    {
                        "or": [
                            {"property": "Drive URL", "url": {"is_not_empty": True}},
                            {"property": "Article URL", "url": {"is_not_empty": True}}
                        ]
                    }
                ]
            }
            
            results = []
            cursor = None
            
            while True:
                query_params = {
                    "database_id": self.sources_db,
                    "filter": filter_condition,
                    "page_size": 100
                }
                
                if cursor:
                    query_params["start_cursor"] = cursor
                    
                response = self.resilient_ops.query_database(**query_params)
                results.extend(response["results"])
                
                if not response.get("has_more"):
                    break
                cursor = response.get("next_cursor")
            
            self.logger.info(f"Found {len(results)} items to enrich")
            return results
            
        except Exception as e:
            self.logger.error(f"Failed to query inbox items: {e}")
            return []

    def is_page_archived(self, page_id: str) -> bool:
        """Check if Notion page is archived"""
        try:
            page = self.resilient_ops.retrieve_page(page_id)
            return page.get("archived", False)
        except Exception as e:
            self.logger.warning(f"Could not check archive status for {page_id}: {e}")
            return False

    def extract_content(self, item: Dict) -> Tuple[str, Optional[datetime]]:
        """Extract full text content and publication date from item"""
        
        # Check if page is archived
        if self.is_page_archived(item["id"]):
            self.logger.warning(f"Skipping archived page: {item['id']}")
            return "", None
            
        properties = item.get("properties", {})
        
        # Try PDF content first (Google Drive)
        drive_url = properties.get("Drive URL", {}).get("url")
        if drive_url:
            return self._extract_pdf_content(drive_url)
            
        # Try web content (Article URL)
        article_url = properties.get("Article URL", {}).get("url") 
        if article_url:
            return self._extract_web_content(item, article_url)
            
        self.logger.error(f"No valid content source found for item {item['id']}")
        return "", None

    def _extract_pdf_content(self, drive_url: str) -> Tuple[str, Optional[datetime]]:
        """Extract content from Google Drive PDF"""
        try:
            # Extract file ID from Drive URL
            file_id = self._drive_id(drive_url)
            if not file_id:
                raise ValueError("Could not extract file ID from Drive URL")
                
            # Download PDF
            pdf_content = self._download_pdf(file_id)
            
            # Extract text
            text_content = self._extract_text_from_pdf(pdf_content)
            
            # Try to extract date from text
            pub_date = self._extract_date_from_text(text_content)
            
            return text_content, pub_date
            
        except Exception as e:
            self.logger.error(f"Failed to extract PDF content: {e}")
            return "", None

    def _extract_web_content(self, item: Dict, article_url: str) -> Tuple[str, Optional[datetime]]:
        """Extract content from web article or existing scraped content"""
        try:
            # Check if this is a Gmail email (should read from page blocks only)
            source_type = item.get('properties', {}).get('Source Type', {}).get('select', {}).get('name', '')
            is_gmail_email = (article_url.startswith('https://mail.google.com/') or 
                            source_type == 'Email')
            
            if is_gmail_email:
                self.logger.info(f"Detected Gmail email (source_type: {source_type}), reading content from page blocks")
            
            # Try to get existing scraped content from page blocks
            existing_content = self._get_existing_scraped_content(item["id"])
            if existing_content:
                self.logger.info(f"Found existing content: {len(existing_content)} characters")
                pub_date = self._extract_date_from_text(existing_content)
                return existing_content, pub_date
            
            # For Gmail emails, don't try to fetch - content should be in blocks
            if is_gmail_email:
                self.logger.warning(f"Gmail email but no content found in page blocks")
                return "", None
                
            # Fallback: fetch content directly from URL (for web articles)
            self.logger.info(f"Fetching content from URL: {article_url}")
            text_content = self._fetch_article_text(article_url)
            pub_date = self._extract_date_from_text(text_content)
            
            return text_content, pub_date
            
        except Exception as e:
            self.logger.error(f"Failed to extract web content: {e}")
            return "", None

    def _get_existing_scraped_content(self, page_id: str) -> str:
        """Get existing scraped content from Notion page blocks"""
        try:
            blocks = self.resilient_ops.list_blocks(page_id)
            
            # Look for toggle blocks with content
            for block in blocks.get("results", []):
                if block["type"] == "toggle":
                    toggle_title = self._extract_text_from_rich_text(
                        block["toggle"]["rich_text"]
                    )
                    
                    # Look for content toggles (raw content or email content)
                    if any(keyword in toggle_title.lower() for keyword in ["raw", "email content", "content"]):
                        children = block["toggle"].get("children", [])
                        if not children:
                            # If no children, try to get children from API
                            try:
                                child_blocks = self.resilient_ops.list_blocks(block["id"])
                                children = child_blocks.get("results", [])
                            except Exception:
                                children = []
                        
                        content_parts = []
                        for child in children:
                            if child["type"] == "paragraph":
                                text = self._extract_text_from_rich_text(
                                    child["paragraph"]["rich_text"]
                                )
                                content_parts.append(text)
                                
                        if content_parts:
                            return "\n".join(content_parts)
                        
            return ""
            
        except Exception as e:
            self.logger.warning(f"Could not retrieve existing content for {page_id}: {e}")
            return ""

    def generate_consolidated_analysis(self, content: str, title: str) -> Dict[str, str]:
        """Generate all 3 consolidated AI analyses in optimized calls"""
        
        analyses = {}
        
        # 1. Core Summary (combines summary + executive summary)
        summary_prompt = f"""
        Analyze this document and provide a comprehensive but concise summary.
        
        Document Title: {title}
        Content: {content[:8000]}  # Truncate for API limits
        
        Provide:
        1. A detailed summary (150-200 words) covering key points and findings
        2. An executive summary (3-4 key takeaways as bullet points)
        
        Format as markdown with clear sections.
        """
        
        try:
            summary_response = self._ask_openai(summary_prompt, model=self.config.model_summary)
            analyses["core_summary"] = summary_response
        except Exception as e:
            self.logger.error(f"Failed to generate core summary: {e}")
            analyses["core_summary"] = "Summary generation failed"

        # 2. Smart Classification (content type + AI primitives + vendor)
        classification_prompt = f"""
        Analyze this document and provide structured classification.
        
        Document Title: {title}
        Content: {content[:4000]}
        
        Available Content Types: {', '.join(self.taxonomy['content_types'])}
        Available AI Primitives: {', '.join(self.taxonomy['ai_primitives'])}
        Available Vendors: {', '.join(self.taxonomy['vendors'])}
        
        Provide JSON response with:
        {{
            "content_type": "most appropriate content type from the list",
            "ai_primitives": ["relevant AI primitives from the list"],
            "vendor": "company/organization mentioned (from list or inferred)",
            "confidence": "high/medium/low"
        }}
        """
        
        try:
            classification_response = self._ask_openai(
                classification_prompt, 
                model=self.config.model_classifier,
                json_mode=True
            )
            analyses["smart_classification"] = classification_response
        except Exception as e:
            self.logger.error(f"Failed to generate classification: {e}")
            analyses["smart_classification"] = '{"content_type": "Unknown", "ai_primitives": [], "vendor": "Unknown", "confidence": "low"}'

        # 3. Key Insights (actionable analysis)
        insights_prompt = f"""
        Analyze this document for strategic insights and actionable intelligence.
        
        Document Title: {title}
        Content: {content[:6000]}
        
        Provide markdown-formatted analysis with:
        
        ## Key Insights
        - 3-5 most important findings or insights
        
        ## Opportunities & Risks
        - Notable opportunities mentioned
        - Key risks or challenges identified
        
        ## Action Items
        - Specific actionable recommendations
        - Next steps or follow-up areas
        
        Keep concise and focused on practical value.
        """
        
        try:
            insights_response = self._ask_openai(insights_prompt, model=self.config.model_insights)
            analyses["key_insights"] = insights_response
        except Exception as e:
            self.logger.error(f"Failed to generate key insights: {e}")
            analyses["key_insights"] = "Insights generation failed"
            
        return analyses

    def _ask_openai(self, prompt: str, model: str = None, json_mode: bool = False) -> str:
        """Make OpenAI API call with fallback handling"""
        
        model = model or self.config.model_summary
        
        try:
            # Try Responses API first (if available)
            messages = [{"role": "user", "content": prompt}]
            
            kwargs = {
                "model": model,
                "messages": messages,
                "timeout": OPENAI_TIMEOUT
            }
            
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
                
            response = self.openai.chat.completions.create(**kwargs)
            return response.choices[0].message.content
            
        except Exception as e:
            self.logger.error(f"OpenAI API call failed: {e}")
            raise

    def store_enriched_content(self, item: Dict, content: str, analyses: Dict[str, str], 
                             classification_data: Dict, pub_date: Optional[datetime]):
        """Store enriched content in Notion with proper formatting"""
        
        page_id = item["id"]
        
        try:
            # Parse classification data
            try:
                classification = json.loads(analyses["smart_classification"])
            except:
                classification = {"content_type": "Unknown", "ai_primitives": [], "vendor": "Unknown"}
            
            # Extract brief summary for property field (first sentence or up to 200 chars)
            brief_summary = self._extract_brief_summary(analyses["core_summary"])
            
            # Update page properties (only essential metadata)
            properties = {
                "Status": {"select": {"name": "Enriched"}},
                "Summary": {"rich_text": [{"text": {"content": brief_summary}}]}
            }
            
            # Add classification properties
            if classification.get("content_type") and classification["content_type"] in self.taxonomy["content_types"]:
                properties["Content-Type"] = {"select": {"name": classification["content_type"]}}
                
            if classification.get("ai_primitives"):
                valid_primitives = [p for p in classification["ai_primitives"] if p in self.taxonomy["ai_primitives"]]
                if valid_primitives:
                    properties["AI-Primitive"] = {"multi_select": [{"name": p} for p in valid_primitives]}
                    
            if classification.get("vendor") and classification["vendor"] != "Unknown":
                # Check if vendor exists in taxonomy, if not it will be added dynamically
                properties["Vendor"] = {"select": {"name": classification["vendor"]}}
                
            if pub_date:
                properties["Created Date"] = {"date": {"start": pub_date.isoformat()}}
            
            # Update properties
            self.resilient_ops.update_page(page_id, properties=properties)
            
            # Store content blocks with proper markdown formatting
            self._store_content_blocks(page_id, content, analyses)
            
            self.logger.info(f"Successfully enriched page {page_id}")
            
        except Exception as e:
            self.logger.error(f"Failed to store enriched content for {page_id}: {e}")
            # Mark as failed
            try:
                self.resilient_ops.update_page(
                    page_id, 
                    properties={"Status": {"select": {"name": "Failed"}}}
                )
            except:
                pass

    def _store_content_blocks(self, page_id: str, raw_content: str, analyses: Dict[str, str]):
        """Store content as properly formatted Notion blocks"""
        
        blocks_to_add = []
        
        # 1. Raw content toggle (chunked into paragraphs for Notion)
        # Allow much more content but prevent extremely large documents from breaking the API
        max_raw_content = 50000  # ~50KB should be sufficient for most documents
        raw_preview = raw_content[:max_raw_content] + "..." if len(raw_content) > max_raw_content else raw_content
        raw_chunks = self._chunk_text_for_notion(raw_preview)
        raw_children = [
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"type": "text", "text": {"content": chunk}}]
                }
            }
            for chunk in raw_chunks
        ]
        
        blocks_to_add.append({
            "object": "block",
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": "📄 Raw Content"}}],
                "children": raw_children
            }
        })
        
        # 2. Core Summary (with basic markdown parsing)
        summary_children = self._create_formatted_blocks(analyses["core_summary"])
        blocks_to_add.append({
            "object": "block", 
            "type": "toggle",
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": "📋 Core Summary"}}],
                "children": summary_children
            }
        })
        
        # 3. Key Insights (with basic markdown parsing)
        insights_children = self._create_formatted_blocks(analyses["key_insights"])
        blocks_to_add.append({
            "object": "block",
            "type": "toggle", 
            "toggle": {
                "rich_text": [{"type": "text", "text": {"content": "💡 Key Insights"}}],
                "children": insights_children
            }
        })
        
        # 4. Classification Details (as structured content)
        try:
            classification = json.loads(analyses["smart_classification"])
            classification_text = f"""Content Type: {classification.get('content_type', 'Unknown')}

AI Primitives: {', '.join(classification.get('ai_primitives', []))}

Vendor: {classification.get('vendor', 'Unknown')}

Confidence: {classification.get('confidence', 'Unknown')}"""
            
            classification_children = self._create_formatted_blocks(classification_text)
            blocks_to_add.append({
                "object": "block",
                "type": "toggle",
                "toggle": {
                    "rich_text": [{"type": "text", "text": {"content": "🎯 Classification"}}],
                    "children": classification_children
                }
            })
        except Exception as e:
            self.logger.warning(f"Failed to parse classification data: {e}")
        
        # Add all blocks to the page
        try:
            self.resilient_ops.append_blocks(page_id, children=blocks_to_add)
        except Exception as e:
            self.logger.error(f"Failed to add content blocks to {page_id}: {e}")

    def enrich_item(self, item: Dict) -> bool:
        """Enrich a single item with consolidated processing"""
        
        page_id = item["id"]
        title = self._get_page_title(item)
        
        self.logger.info(f"Enriching item: {title} ({page_id})")
        
        try:
            # 1. Extract content
            content, pub_date = self.extract_content(item)
            if not content:
                self.logger.warning(f"No content extracted for {page_id}")
                return False
                
            # 2. Generate consolidated analyses
            analyses = self.generate_consolidated_analysis(content, title)
            
            # 3. Parse classification for properties
            classification_data = {}
            try:
                classification_data = json.loads(analyses["smart_classification"])
            except:
                pass
                
            # 4. Store enriched content
            self.store_enriched_content(item, content, analyses, classification_data, pub_date)
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to enrich item {page_id}: {e}")
            # Mark as failed
            try:
                self.resilient_ops.update_page(
                    page_id,
                    properties={"Status": {"select": {"name": "Failed"}}}
                )
            except:
                pass
            return False

    def process_all_items(self):
        """Process all inbox items"""
        
        items = self.inbox_rows()
        if not items:
            self.logger.info("No items to process")
            return
            
        self.logger.info(f"Processing {len(items)} items")
        
        successful = 0
        failed = 0
        
        for item in items:
            try:
                if self.enrich_item(item):
                    successful += 1
                else:
                    failed += 1
                    
                # Rate limiting
                time.sleep(self.config.rate_limit_delay)
                
            except Exception as e:
                self.logger.error(f"Unexpected error processing item: {e}")
                failed += 1
                
        self.logger.info(f"Processing complete: {successful} successful, {failed} failed")
        
        # Log metrics
        self.metrics.log_summary()

    # Utility methods
    def _get_page_title(self, item: Dict) -> str:
        """Extract page title from Notion item"""
        try:
            title_prop = item.get("properties", {}).get("Title", {})
            if title_prop.get("title"):
                return self._extract_text_from_rich_text(title_prop["title"])
            return "Untitled"
        except:
            return "Untitled"
            
    def _extract_text_from_rich_text(self, rich_text: List) -> str:
        """Extract plain text from Notion rich text format"""
        return "".join([rt.get("text", {}).get("content", "") for rt in rich_text])
        
    def _truncate_for_property(self, text: str, max_length: int = 2000) -> str:
        """Truncate text for Notion property limits"""
        if len(text) <= max_length:
            return text
        return text[:max_length-3] + "..."
        
    def _extract_brief_summary(self, full_summary: str) -> str:
        """Extract a brief summary for the property field (under 2000 chars)"""
        if not full_summary:
            return "Summary not available"
            
        # Remove markdown headers and formatting for property field
        clean_text = full_summary.replace('#', '').replace('**', '').replace('*', '')
        clean_text = ' '.join(clean_text.split())  # Normalize whitespace
        
        # Try to get first sentence or first 200 characters
        sentences = clean_text.split('. ')
        
        if sentences and len(sentences[0]) <= 200:
            return sentences[0] + '.'
        elif len(clean_text) <= 200:
            return clean_text
        else:
            return clean_text[:197] + "..."
            
    def _chunk_text_for_notion(self, text: str) -> List[str]:
        """Chunk text into pieces suitable for Notion blocks (max 2000 chars each)"""
        if len(text) <= MAX_CHUNK:
            return [text]
            
        chunks = []
        current_chunk = ""
        
        # Split by lines first to preserve structure
        lines = text.split('\n')
        
        for line in lines:
            # If this single line is too long, split it further
            if len(line) > MAX_CHUNK:
                # Finish current chunk if exists
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = ""
                
                # Split long line by sentences or words
                long_line_chunks = self._split_long_text(line)
                chunks.extend(long_line_chunks)
                continue
                
            # Check if adding this line would exceed limit
            if len(current_chunk) + len(line) + 1 > MAX_CHUNK:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = line + '\n'
            else:
                current_chunk += line + '\n'
                
        if current_chunk:
            chunks.append(current_chunk.strip())
            
        return chunks
        
    def _split_long_text(self, text: str) -> List[str]:
        """Split text that's longer than MAX_CHUNK into smaller pieces"""
        chunks = []
        
        # Try splitting by sentences first
        sentences = text.split('. ')
        current_chunk = ""
        
        for sentence in sentences:
            sentence_with_period = sentence + '. ' if sentence != sentences[-1] else sentence
            
            if len(current_chunk) + len(sentence_with_period) > MAX_CHUNK:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = ""
                
                # If single sentence is still too long, split by words
                if len(sentence_with_period) > MAX_CHUNK:
                    word_chunks = self._split_by_words(sentence_with_period)
                    chunks.extend(word_chunks)
                else:
                    current_chunk = sentence_with_period
            else:
                current_chunk += sentence_with_period
                
        if current_chunk:
            chunks.append(current_chunk.strip())
            
        return chunks
        
    def _split_by_words(self, text: str) -> List[str]:
        """Split text by words when sentences are too long"""
        chunks = []
        words = text.split(' ')
        current_chunk = ""
        
        for word in words:
            if len(current_chunk) + len(word) + 1 > MAX_CHUNK:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = word + ' '
            else:
                current_chunk += word + ' '
                
        if current_chunk:
            chunks.append(current_chunk.strip())
            
        return chunks
        
    def _create_formatted_blocks(self, content: str) -> List[Dict[str, Any]]:
        """Create formatted Notion blocks from content with basic markdown support"""
        
        if not content:
            return [{"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": ""}}]}}]
            
        blocks = []
        lines = content.split('\n')
        
        current_paragraph = ""
        
        for line in lines:
            line = line.strip()
            
            if not line:
                # Empty line - end current paragraph if exists
                if current_paragraph:
                    blocks.extend(self._create_paragraph_blocks(current_paragraph))
                    current_paragraph = ""
                continue
                
            # Check for headers
            if line.startswith('#'):
                # End current paragraph first
                if current_paragraph:
                    blocks.extend(self._create_paragraph_blocks(current_paragraph))
                    current_paragraph = ""
                    
                # Create heading block
                level = min(len(line) - len(line.lstrip('#')), 3)
                header_text = line.lstrip('#').strip()
                heading_type = f"heading_{level}"
                
                blocks.append({
                    "object": "block",
                    "type": heading_type,
                    heading_type: {
                        "rich_text": [{"type": "text", "text": {"content": header_text}}]
                    }
                })
                
            # Check for bullet points
            elif line.startswith('- ') or line.startswith('* '):
                # End current paragraph first
                if current_paragraph:
                    blocks.extend(self._create_paragraph_blocks(current_paragraph))
                    current_paragraph = ""
                    
                bullet_text = line[2:].strip()
                blocks.append({
                    "object": "block",
                    "type": "bulleted_list_item",
                    "bulleted_list_item": {
                        "rich_text": [{"type": "text", "text": {"content": bullet_text}}]
                    }
                })
                
            # Regular line - add to current paragraph
            else:
                if current_paragraph:
                    current_paragraph += " " + line
                else:
                    current_paragraph = line
                    
        # Add any remaining paragraph
        if current_paragraph:
            blocks.extend(self._create_paragraph_blocks(current_paragraph))
            
        return blocks if blocks else [{"object": "block", "type": "paragraph", "paragraph": {"rich_text": [{"type": "text", "text": {"content": content[:MAX_CHUNK]}}]}}]
        
    def _create_paragraph_blocks(self, text: str) -> List[Dict[str, Any]]:
        """Create paragraph blocks from text, chunking if necessary"""
        
        if len(text) <= MAX_CHUNK:
            return [{
                "object": "block",
                "type": "paragraph", 
                "paragraph": {
                    "rich_text": [{"type": "text", "text": {"content": text}}]
                }
            }]
            
        # Chunk the text
        chunks = self._chunk_text_for_notion(text)
        return [
            {
                "object": "block",
                "type": "paragraph",
                "paragraph": {
                    "rich_text": [{"type": "text", "text": {"content": chunk}}]
                }
            }
            for chunk in chunks
        ]

    # Content extraction implementations
    def _drive_id(self, url: str) -> Optional[str]:
        """Extract Google Drive file ID from URL"""
        try:
            return url.split("/d/")[1].split("/")[0]
        except Exception:
            self.logger.error(f"Invalid Drive URL: {url}")
            return None
        
    def _download_pdf(self, file_id: str) -> bytes:
        """Download PDF from Google Drive"""
        if not self.drive:
            raise RuntimeError("Google Drive API not initialized")
            
        request = self.drive.files().get_media(fileId=file_id)
        buf = io.BytesIO()
        downloader = MediaIoBaseDownload(buf, request)
        done = False
        while not done:
            status, done = downloader.next_chunk()
        return buf.getvalue()
        
    def _extract_text_from_pdf(self, pdf_content: bytes) -> str:
        """Extract text from PDF bytes"""
        return extract_text(io.BytesIO(pdf_content))
        
    def _fetch_article_text(self, url: str) -> str:
        """Fetch and clean article text from URL"""
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120 Safari/537.36"
                )
            },
        )
        try:
            with urllib.request.urlopen(req) as resp:
                data = resp.read().decode("utf-8", "ignore")
        except URLError as exc:
            raise RuntimeError(f"Failed to fetch {url}: {exc}")

        # Remove script and style tags
        data = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", data, flags=re.I | re.S)
        # Remove HTML tags
        text = re.sub(r"<[^>]+>", " ", data)
        # Unescape HTML entities
        text = html.unescape(text)
        # Normalize whitespace
        return " ".join(text.split())
        
    def _extract_date_from_text(self, text: str) -> Optional[datetime]:
        """Extract publication date from text content"""
        if not text:
            return None
            
        sample = text[:400]  # Only check first 400 chars for performance
        
        for pattern in DATE_PATTERNS:
            match = re.search(pattern, sample)
            if not match:
                continue
                
            date_str = match.group(0)
            for fmt in DATE_FORMATS:
                try:
                    dt = datetime.strptime(date_str, fmt)
                    return dt
                except ValueError:
                    continue
                    
        return None

def main():
    """Main entry point"""
    enricher = ConsolidatedEnricher()
    enricher.process_all_items()

if __name__ == "__main__":
    main()