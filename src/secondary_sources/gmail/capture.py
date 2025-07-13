"""
Gmail email capture module for newsletter content.
"""
import os
import hashlib
import base64
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple
from email.utils import parsedate_to_datetime

from googleapiclient.errors import HttpError
from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type

from ...core.config import PipelineConfig
from ...core.models import SourceContent, ContentStatus, ContentType
from ...core.notion_client import NotionClient
from ...utils.logging import setup_logger
from .auth import GmailAuthenticator
from .filters import EmailFilter


class GmailCapture:
    """Captures newsletter emails from Gmail."""
    
    def __init__(self, config: PipelineConfig, notion_client: NotionClient):
        """Initialize Gmail capture with configuration."""
        self.config = config
        self.notion_client = notion_client
        self.logger = setup_logger(__name__)
        
        # Gmail configuration
        self.credentials_path = os.getenv("GMAIL_CREDENTIALS_PATH", "gmail_credentials/credentials.json")
        self.token_path = os.getenv("GMAIL_TOKEN_PATH", "gmail_credentials/token.json")
        self.search_query = os.getenv("GMAIL_SEARCH_QUERY", "from:newsletter OR from:substack OR from:digest")
        self.window_days = int(os.getenv("GMAIL_WINDOW_DAYS", "7"))
        
        # Initialize Gmail service
        self.authenticator = GmailAuthenticator(self.credentials_path, self.token_path)
        self.service = self.authenticator.get_service()
        
        # Initialize email filter
        self.email_filter = EmailFilter()
    
    def capture_emails(self, limit: Optional[int] = None) -> Dict[str, int]:
        """
        Capture newsletter emails from Gmail.
        
        Returns:
            Dict with counts: {"total": n, "new": n, "skipped": n}
        """
        stats = {"total": 0, "new": 0, "skipped": 0}
        
        try:
            # Build search query with date filter
            after_date = (datetime.now() - timedelta(days=self.window_days)).strftime("%Y/%m/%d")
            query = f"{self.search_query} after:{after_date}"
            
            self.logger.info(f"Searching Gmail with query: {query}")
            
            # Search for messages
            results = self.service.users().messages().list(
                userId='me',
                q=query,
                maxResults=limit or 100
            ).execute()
            
            messages = results.get('messages', [])
            stats["total"] = len(messages)
            
            if not messages:
                self.logger.info("No messages found")
                return stats
            
            self.logger.info(f"Found {len(messages)} messages")
            
            # Process each message
            for msg_ref in messages:
                try:
                    # Get full message
                    message = self._get_message(msg_ref['id'])
                    
                    # Filter message
                    if not self._should_process_message(message):
                        stats["skipped"] += 1
                        continue
                    
                    # Extract content
                    source_content = self._extract_source_content(message)
                    if not source_content:
                        stats["skipped"] += 1
                        continue
                    
                    # Check if already exists
                    if self.notion_client.check_hash_exists(source_content.hash):
                        self.logger.info(f"Skipping duplicate: {source_content.title}")
                        stats["skipped"] += 1
                        continue
                    
                    # Create Notion page
                    page_id = self.notion_client.create_page(source_content)
                    self.logger.info(f"✓ Added: {source_content.title}")
                    stats["new"] += 1
                    
                except Exception as e:
                    self.logger.error(f"Error processing message: {e}")
                    stats["skipped"] += 1
            
            self.logger.info(f"Gmail capture complete: {stats['new']} new emails added")
            return stats
            
        except HttpError as error:
            self.logger.error(f"Gmail API error: {error}")
            return stats
    
    @retry(
        wait=wait_exponential(multiplier=1, min=4, max=10),
        stop=stop_after_attempt(3),
        retry=retry_if_exception_type(HttpError)
    )
    def _get_message(self, message_id: str) -> Dict:
        """Get full message data from Gmail."""
        return self.service.users().messages().get(
            userId='me',
            id=message_id
        ).execute()
    
    def _should_process_message(self, message: Dict) -> bool:
        """Check if message should be processed."""
        # Extract sender
        headers = message['payload'].get('headers', [])
        sender = ""
        for header in headers:
            if header['name'].lower() == 'from':
                sender = header['value']
                break
        
        # Apply filters
        return self.email_filter.should_process(sender, message)
    
    def _extract_source_content(self, message: Dict) -> Optional[SourceContent]:
        """Extract SourceContent from Gmail message."""
        try:
            headers = message['payload'].get('headers', [])
            
            # Extract metadata
            subject = ""
            sender = ""
            date_str = ""
            message_id = ""
            
            for header in headers:
                name = header['name'].lower()
                if name == 'subject':
                    subject = header['value']
                elif name == 'from':
                    sender = header['value']
                elif name == 'date':
                    date_str = header['value']
                elif name == 'message-id':
                    message_id = header['value']
            
            # Extract content
            content = self._extract_email_content(message['payload'])
            if not content:
                return None
            
            # Parse date
            created_date = None
            if date_str:
                try:
                    created_date = parsedate_to_datetime(date_str)
                except:
                    pass
            
            # Generate hash
            content_hash = self._generate_email_hash(message_id, subject)
            
            # Create pseudo-URL for email
            email_url = f"gmail://{message['id']}"
            
            return SourceContent(
                title=subject or "Untitled Email",
                status=ContentStatus.INBOX,
                hash=content_hash,
                content_type=ContentType.EMAIL,
                article_url=email_url,
                created_date=created_date,
                raw_content=content
            )
            
        except Exception as e:
            self.logger.error(f"Failed to extract content: {e}")
            return None
    
    def _extract_email_content(self, payload: Dict) -> str:
        """Extract text content from email payload."""
        def decode_content(data: str) -> str:
            """Decode base64 content."""
            try:
                return base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
            except:
                return ""
        
        def extract_from_parts(parts: List[Dict]) -> Tuple[str, str]:
            """Recursively extract content from email parts."""
            text_content = ""
            html_content = ""
            
            for part in parts:
                mime_type = part.get('mimeType', '')
                
                if mime_type == 'text/plain' and part.get('body', {}).get('data'):
                    text_content += decode_content(part['body']['data'])
                elif mime_type == 'text/html' and part.get('body', {}).get('data'):
                    html_content += decode_content(part['body']['data'])
                elif 'parts' in part:
                    sub_text, sub_html = extract_from_parts(part['parts'])
                    text_content += sub_text
                    html_content += sub_html
            
            return text_content, html_content
        
        # Extract content
        if 'parts' in payload:
            text_content, html_content = extract_from_parts(payload['parts'])
        else:
            # Single part message
            body = payload.get('body', {})
            if body.get('data'):
                content = decode_content(body['data'])
                if payload.get('mimeType') == 'text/html':
                    html_content = content
                else:
                    text_content = content
            else:
                text_content = ""
                html_content = ""
        
        # Prefer text content, fall back to cleaned HTML
        if text_content:
            return text_content
        elif html_content:
            return self._clean_html(html_content)
        else:
            return ""
    
    def _clean_html(self, html: str) -> str:
        """Basic HTML to text conversion."""
        # Remove HTML tags
        import re
        text = re.sub(r'<[^>]+>', '', html)
        # Decode HTML entities
        import html as html_module
        text = html_module.unescape(text)
        # Remove extra whitespace
        text = ' '.join(text.split())
        return text
    
    def _generate_email_hash(self, message_id: str, subject: str) -> str:
        """Generate hash for email deduplication."""
        combined = f"{message_id}:{subject}"
        return hashlib.sha256(combined.encode("utf-8")).hexdigest()