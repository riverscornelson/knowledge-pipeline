"""
capture_emails.py – Gmail newsletter ➜ Notion enrichment pipeline
  • Search for newsletter/content emails using Gmail API
  • Extract and clean email content 
  • Store in Notion Sources database

ENV (.env)
  NOTION_TOKEN, NOTION_SOURCES_DB
  GMAIL_CREDENTIALS_PATH    path to Gmail OAuth2 credentials (optional)
  GMAIL_TOKEN_PATH          path to stored token (optional)
  GMAIL_SEARCH_QUERY        Gmail search query (default: newsletter OR substack)
  GMAIL_WINDOW_DAYS         days to look back (default: 7)
  EMAIL_URL_PROP            property name for email source (default 'Article URL')
  CREATED_PROP              property for created date (default "Created Date")
"""
import os
import hashlib
import time
import re
import base64
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

from dotenv import load_dotenv
from notion_client import Client as Notion
from googleapiclient.errors import HttpError

from gmail_auth import GmailAuthenticator
from email_filters import EmailFilter

load_dotenv()

# Configuration
NOTION_DB = os.getenv("NOTION_SOURCES_DB")
GMAIL_CREDENTIALS_PATH = os.getenv("GMAIL_CREDENTIALS_PATH", "gmail_credentials/credentials.json")
GMAIL_TOKEN_PATH = os.getenv("GMAIL_TOKEN_PATH", "gmail_credentials/token.json")
GMAIL_SEARCH_QUERY = os.getenv("GMAIL_SEARCH_QUERY", "from:newsletter OR from:substack OR from:digest")
GMAIL_WINDOW_DAYS = int(os.getenv("GMAIL_WINDOW_DAYS", "7"))
EMAIL_URL_PROP = os.getenv("EMAIL_URL_PROP", "Article URL")
CREATED_PROP = os.getenv("CREATED_PROP", "Created Date")
EMAIL_SENDER_WHITELIST = os.getenv("EMAIL_SENDER_WHITELIST", "")
EMAIL_SENDER_BLACKLIST = os.getenv("EMAIL_SENDER_BLACKLIST", "")

# Initialize clients
notion = Notion(auth=os.getenv("NOTION_TOKEN"))


def email_hash(message_id: str, subject: str) -> str:
    """Generate hash for email deduplication."""
    combined = f"{message_id}:{subject}"
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()


def notion_page_exists(h: str) -> bool:
    """Check if a page with this hash already exists in Notion."""
    try:
        q = notion.databases.query(
            database_id=NOTION_DB,
            filter={"property": "Hash", "rich_text": {"equals": h}},
        )
        return len(q["results"]) > 0
    except Exception as exc:
        print(f"   ⚠️  Error checking Notion: {exc}")
        return False


def extract_email_content(message_data: dict, debug: bool = False) -> tuple[str, str]:
    """Extract subject and body content from Gmail message with improved HTML handling."""
    headers = message_data['payload'].get('headers', [])
    
    # Extract subject
    subject = ""
    for header in headers:
        if header['name'].lower() == 'subject':
            subject = header['value']
            break
    
    # Extract body content with better handling
    content = ""
    payload = message_data['payload']
    
    def decode_content(data):
        """Helper to decode base64 content."""
        try:
            return base64.urlsafe_b64decode(data).decode('utf-8', errors='ignore')
        except Exception:
            return ""
    
    def extract_from_parts(parts, debug=False):
        """Recursively extract content from email parts."""
        text_content = ""
        html_content = ""
        
        for part in parts:
            mime_type = part.get('mimeType', '')
            
            if debug:
                print(f"      Part MIME: {mime_type}")
            
            # Handle nested multipart
            if 'parts' in part:
                nested_text, nested_html = extract_from_parts(part['parts'], debug)
                if not text_content and nested_text:
                    text_content = nested_text
                if not html_content and nested_html:
                    html_content = nested_html
            
            # Extract text/plain
            elif mime_type == 'text/plain' and 'data' in part.get('body', {}):
                if not text_content:
                    text_content = decode_content(part['body']['data'])
                    if debug:
                        print(f"      Extracted plain text: {len(text_content)} chars")
            
            # Extract text/html
            elif mime_type == 'text/html' and 'data' in part.get('body', {}):
                if not html_content:
                    html_content = decode_content(part['body']['data'])
                    if debug:
                        print(f"      Extracted HTML: {len(html_content)} chars")
        
        return text_content, html_content
    
    if debug:
        print(f"   📧 Processing: {subject}")
        print(f"   📧 Payload MIME: {payload.get('mimeType', 'unknown')}")
    
    # Handle different message structures
    if 'parts' in payload:
        # Multipart message
        text_content, html_content = extract_from_parts(payload['parts'], debug)
        
        # Prefer plain text, fallback to processed HTML
        if text_content:
            content = text_content
            if debug:
                print(f"   ✅ Using plain text content: {len(content)} chars")
        elif html_content:
            # Better HTML processing
            content = html_to_text(html_content)
            if debug:
                print(f"   ✅ Using processed HTML content: {len(content)} chars")
    else:
        # Single part message
        mime_type = payload.get('mimeType', '')
        if debug:
            print(f"   📧 Single part MIME: {mime_type}")
        
        if mime_type == 'text/plain' and 'data' in payload.get('body', {}):
            content = decode_content(payload['body']['data'])
            if debug:
                print(f"   ✅ Single plain text: {len(content)} chars")
        elif mime_type == 'text/html' and 'data' in payload.get('body', {}):
            html_content = decode_content(payload['body']['data'])
            content = html_to_text(html_content)
            if debug:
                print(f"   ✅ Single HTML processed: {len(content)} chars")
    
    return subject, content


def html_to_text(html_content: str) -> str:
    """Convert HTML to clean text with better structure preservation."""
    if not html_content:
        return ""
    
    # Remove script and style elements
    html_content = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    
    # Convert common HTML elements to text equivalents
    html_content = re.sub(r'<br[^>]*>', '\n', html_content, flags=re.IGNORECASE)
    html_content = re.sub(r'<p[^>]*>', '\n\n', html_content, flags=re.IGNORECASE)
    html_content = re.sub(r'</p>', '', html_content, flags=re.IGNORECASE)
    html_content = re.sub(r'<h[1-6][^>]*>', '\n\n## ', html_content, flags=re.IGNORECASE)
    html_content = re.sub(r'</h[1-6]>', '\n', html_content, flags=re.IGNORECASE)
    html_content = re.sub(r'<li[^>]*>', '\n• ', html_content, flags=re.IGNORECASE)
    html_content = re.sub(r'</li>', '', html_content, flags=re.IGNORECASE)
    
    # Remove all remaining HTML tags
    html_content = re.sub(r'<[^>]+>', '', html_content)
    
    # Clean up whitespace
    html_content = re.sub(r'\n\s*\n\s*\n', '\n\n', html_content)  # Max 2 consecutive newlines
    html_content = re.sub(r'[ \t]+', ' ', html_content)  # Normalize spaces
    
    return html_content.strip()


def get_email_metadata(message_data: dict) -> dict:
    """Extract email metadata (sender, date, message-id)."""
    headers = message_data['payload'].get('headers', [])
    metadata = {}
    
    for header in headers:
        name = header['name'].lower()
        if name == 'from':
            metadata['sender'] = header['value']
        elif name == 'date':
            metadata['date_str'] = header['value']
        elif name == 'message-id':
            metadata['message_id'] = header['value']
    
    # Parse date
    if 'date_str' in metadata:
        try:
            metadata['date'] = parsedate_to_datetime(metadata['date_str'])
        except Exception:
            metadata['date'] = datetime.now(timezone.utc)
    else:
        metadata['date'] = datetime.now(timezone.utc)
    
    return metadata


def clean_email_content(content: str) -> str:
    """Clean email content by removing common newsletter cruft."""
    if not content:
        return ""
    
    # Remove unsubscribe links and common email footers
    lines = content.split('\n')
    cleaned_lines = []
    
    for line in lines:
        line = line.strip()
        # Skip unsubscribe and footer lines
        if any(keyword in line.lower() for keyword in [
            'unsubscribe', 'preferences', 'manage subscription',
            'view this email in your browser', 'forward to a friend',
            'this email was sent to', '© 20'  # Copyright lines
        ]):
            continue
        if line:  # Keep non-empty lines
            cleaned_lines.append(line)
    
    return '\n'.join(cleaned_lines)


def create_email_row(subject: str, content: str, h: str, metadata: dict):
    """Create a new email entry in the Notion database."""
    # Create synthetic URL from sender domain for consistency 
    sender = metadata.get('sender', 'unknown@email.com')
    sender_domain = sender.split('@')[-1].replace('>', '')
    synthetic_url = f"mailto:{sender}"
    
    props = {
        "Title": {"title": [{"text": {"content": subject or "Untitled Email"}}]},
        EMAIL_URL_PROP: {"url": synthetic_url},
        "Status": {"select": {"name": "Inbox"}},
        "Hash": {"rich_text": [{"text": {"content": h}}]},
        CREATED_PROP: {"date": {"start": metadata['date'].isoformat()}},
    }
    
    # Create the page
    try:
        page = notion.pages.create(
            parent={"database_id": NOTION_DB},
            properties=props,
        )
        
        # Add email content and metadata as blocks
        if content:
            # Clean and chunk content
            cleaned_content = clean_email_content(content)
            chunk_size = 1500
            chunks = [cleaned_content[i:i+chunk_size] for i in range(0, len(cleaned_content), chunk_size)]
            
            # Create content blocks
            content_blocks = []
            for chunk in chunks:
                if chunk.strip():  # Only add non-empty chunks
                    content_blocks.append({
                        "object": "block",
                        "type": "paragraph",
                        "paragraph": {
                            "rich_text": [{"type": "text", "text": {"content": chunk}}]
                        }
                    })
            
            # Add metadata and content toggle blocks
            blocks_to_add = [
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [
                            {"type": "text", "text": {"content": f"📧 From: {metadata.get('sender', 'Unknown')}"}}
                        ]
                    }
                },
                {
                    "object": "block",
                    "type": "toggle",
                    "toggle": {
                        "rich_text": [{"type": "text", "text": {"content": f"📄 Email Content ({len(chunks)} blocks)"}}],
                        "children": content_blocks
                    }
                }
            ]
            
            notion.blocks.children.append(
                block_id=page["id"],
                children=blocks_to_add
            )
        
        print(f"Added ⇒ {subject} (from {metadata.get('sender', 'Unknown')})")
        
    except Exception as exc:
        print(f"   ❌ Error creating Notion page: {exc}")


def search_gmail_messages(service, query: str, max_results: int = 50) -> list:
    """Search Gmail for messages matching the query."""
    try:
        # Calculate date filter for recent messages
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=GMAIL_WINDOW_DAYS)
        date_filter = cutoff_date.strftime('%Y/%m/%d')
        full_query = f"{query} after:{date_filter}"
        
        print(f"🔍 Searching Gmail: {full_query}")
        
        # Search for messages
        results = service.users().messages().list(
            userId='me',
            q=full_query,
            maxResults=max_results
        ).execute()
        
        messages = results.get('messages', [])
        print(f"📧 Found {len(messages)} matching emails")
        return messages
        
    except HttpError as error:
        print(f"❌ Gmail search error: {error}")
        return []


def main():
    """Main email capture function with smart filtering."""
    if not NOTION_DB:
        raise SystemExit("❌ NOTION_SOURCES_DB not configured")
    
    # Initialize email filter with custom lists
    whitelist = [s.strip() for s in EMAIL_SENDER_WHITELIST.split(",") if s.strip()]
    blacklist = [s.strip() for s in EMAIL_SENDER_BLACKLIST.split(",") if s.strip()]
    email_filter = EmailFilter(custom_whitelist=whitelist, custom_blacklist=blacklist)
    
    # Authenticate with Gmail
    print("🔐 Authenticating with Gmail...")
    try:
        authenticator = GmailAuthenticator(GMAIL_CREDENTIALS_PATH, GMAIL_TOKEN_PATH)
        service = authenticator.get_service()
        
        # Test connection
        if not authenticator.test_connection():
            raise SystemExit("❌ Gmail connection failed")
            
    except Exception as exc:
        raise SystemExit(f"❌ Gmail authentication failed: {exc}")
    
    # Search for messages
    messages = search_gmail_messages(service, GMAIL_SEARCH_QUERY)
    if not messages:
        print("📭 No new emails found")
        return
    
    # Process each message with filtering
    processed_count = 0
    filtered_count = 0
    filter_stats = {'total': len(messages), 'reasons': {}}
    
    for message in messages:
        try:
            # Get full message data
            msg = service.users().messages().get(
                userId='me',
                id=message['id'],
                format='full'
            ).execute()
            
            # Extract content and metadata
            subject, content = extract_email_content(msg)
            metadata = get_email_metadata(msg)
            sender = metadata.get('sender', 'Unknown')
            
            # Apply smart filtering
            filter_result = email_filter.should_process_email(sender, subject, content)
            
            # Track filtering stats
            reason = filter_result['reason']
            filter_stats['reasons'][reason] = filter_stats['reasons'].get(reason, 0) + 1
            
            if not filter_result['should_process']:
                print(f"   🚫 Filtered: {subject}")
                print(f"      Reason: {filter_result['reason']}")
                filtered_count += 1
                continue
            
            # Generate hash for deduplication
            h = email_hash(
                metadata.get('message_id', message['id']),
                subject
            )
            
            # Check if already processed
            if notion_page_exists(h):
                print(f"   ⏭️  Already exists: {subject}")
                continue
            
            # Create Notion entry (only for filtered emails)
            create_email_row(subject, content, h, metadata)
            processed_count += 1
            
            # Rate limiting
            time.sleep(0.5)
            
        except Exception as exc:
            print(f"   ❌ Error processing message {message['id']}: {exc}")
            continue
    
    # Print filtering summary
    print(f"\n📊 Filtering Summary:")
    print(f"   Total emails found: {len(messages)}")
    print(f"   ✅ Processed: {processed_count}")
    print(f"   🚫 Filtered out: {filtered_count}")
    print(f"   💰 Cost savings: ~{filtered_count * 2} API calls avoided")
    
    if filter_stats['reasons']:
        print(f"\n📋 Filter Reasons:")
        for reason, count in filter_stats['reasons'].items():
            print(f"   • {reason}: {count}")
    
    print(f"\n✅ Email capture completed!")


if __name__ == "__main__":
    main()