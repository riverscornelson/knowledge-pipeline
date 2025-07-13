# Knowledge Pipeline v2.0 - API Reference

This document provides comprehensive API documentation for the Knowledge Pipeline v2.0 modular architecture.

## Table of Contents

- [Core Module](#core-module)
  - [Configuration](#configuration)
  - [Notion Client](#notion-client)
  - [Data Models](#data-models)
- [Drive Module](#drive-module)
  - [Drive Ingester](#drive-ingester)
  - [PDF Processing](#pdf-processing)
  - [Deduplication](#deduplication)
- [Enrichment Module](#enrichment-module)
  - [Enrichment Processor](#enrichment-processor)
  - [AI Services](#ai-services)
- [Secondary Sources](#secondary-sources)
  - [Gmail Integration](#gmail-integration)
  - [Firecrawl Integration](#firecrawl-integration)
- [Utilities](#utilities)
  - [Logging](#logging)
  - [Resilience](#resilience)
  - [Markdown Conversion](#markdown-conversion)

## Core Module

### Configuration

#### `PipelineConfig`
Main configuration class that loads settings from environment variables.

```python
from src.core.config import PipelineConfig

# Load configuration from environment
config = PipelineConfig.from_env()
```

**Properties:**
- `notion: NotionConfig` - Notion API configuration
- `google_drive: GoogleDriveConfig` - Google Drive configuration
- `openai: OpenAIConfig` - OpenAI API configuration
- `batch_size: int` - Batch processing size (default: 10)
- `rate_limit_delay: float` - Delay between API calls (default: 0.3)

#### `NotionConfig`
```python
@dataclass
class NotionConfig:
    token: str  # Notion API token
    database_id: str  # Sources database ID
```

#### `GoogleDriveConfig`
```python
@dataclass
class GoogleDriveConfig:
    service_account_path: str  # Path to service account JSON
    folder_id: Optional[str]  # Specific folder to scan
    folder_name: Optional[str]  # Folder name to search for
```

#### `OpenAIConfig`
```python
@dataclass
class OpenAIConfig:
    api_key: str  # OpenAI API key
    model_summary: str  # Model for summarization (default: gpt-4o)
    model_classifier: str  # Model for classification (default: gpt-4o-mini)
    model_insights: str  # Model for insights (default: gpt-4o)
```

### Notion Client

#### `NotionClient`
Enhanced wrapper for Notion API operations with built-in resilience.

```python
from src.core.notion_client import NotionClient
from src.core.config import NotionConfig

client = NotionClient(config)
```

**Methods:**

##### `get_inbox_items(limit: Optional[int] = None) -> Generator[Dict[str, Any], None, None]`
Yields pages with Status="Inbox" for processing.

```python
for item in client.get_inbox_items(limit=10):
    print(item['properties']['Title']['title'][0]['text']['content'])
```

##### `check_hash_exists(content_hash: str) -> bool`
Checks if content hash already exists in database (deduplication).

```python
if not client.check_hash_exists(hash_value):
    # Safe to create new content
```

##### `get_existing_drive_files() -> Tuple[Set[str], Set[str]]`
Returns tuple of (file_ids, hashes) for existing Drive content.

```python
existing_ids, existing_hashes = client.get_existing_drive_files()
```

##### `create_page(content: SourceContent) -> Dict[str, Any]`
Creates new page from SourceContent object.

```python
page = client.create_page(source_content)
```

##### `update_page_status(page_id: str, status: ContentStatus, error_msg: Optional[str] = None)`
Updates page status and optionally adds error message.

```python
client.update_page_status(page_id, ContentStatus.ENRICHED)
```

##### `add_content_blocks(page_id: str, blocks: List[Dict[str, Any]])`
Adds content blocks to page body.

```python
blocks = [{"type": "paragraph", "paragraph": {"rich_text": [{"text": {"content": "Hello"}}]}}]
client.add_content_blocks(page_id, blocks)
```

### Data Models

#### `ContentStatus`
Enum for content processing status.

```python
from src.core.models import ContentStatus

ContentStatus.INBOX  # Awaiting enrichment
ContentStatus.ENRICHED  # Successfully processed
ContentStatus.FAILED  # Processing failed
```

#### `ContentType`
Enum for content types.

```python
from src.core.models import ContentType

ContentType.PDF
ContentType.WEBSITE
ContentType.EMAIL
ContentType.RSS
```

#### `SourceContent`
Main data model for content representation.

```python
@dataclass
class SourceContent:
    title: str
    content_type: ContentType
    raw_content: str
    source_url: str
    content_hash: str
    created_date: Optional[datetime] = None
    author: Optional[str] = None
    vendor: Optional[str] = None
    
    def to_notion_properties(self) -> Dict[str, Any]:
        """Convert to Notion property format"""
```

#### `EnrichmentResult`
Results from AI enrichment process.

```python
@dataclass
class EnrichmentResult:
    summary: str  # Full markdown summary
    brief_summary: str  # <200 char summary for property
    classification: Dict[str, Any]  # Content type, AI primitives, vendor
    insights: List[str]  # Key actionable insights
    processing_time: float
    token_usage: Dict[str, int]
```

## Drive Module

### Drive Ingester

#### `DriveIngester`
Main class for Google Drive content ingestion.

```python
from src.drive.ingester import DriveIngester

ingester = DriveIngester(config, notion_client)
stats = ingester.ingest(skip_existing=True)
# Returns: {"processed": 5, "skipped": 2, "failed": 0}
```

**Methods:**

##### `ingest(skip_existing: bool = True) -> Dict[str, int]`
Main ingestion method that processes all files in configured folder.

**Parameters:**
- `skip_existing`: Skip files already in Notion (default: True)

**Returns:** Dictionary with counts: `processed`, `skipped`, `failed`

##### `get_folder_files() -> List[Dict[str, Any]]`
Lists all files in configured Drive folder.

```python
files = ingester.get_folder_files()
# Returns: [{"id": "...", "name": "document.pdf", "mimeType": "application/pdf"}]
```

##### `process_file(file_info: Dict[str, Any]) -> Optional[SourceContent]`
Processes single Drive file into SourceContent.

### PDF Processing

#### `PDFProcessor`
Utilities for PDF file handling.

```python
from src.drive.pdf_processor import PDFProcessor

processor = PDFProcessor()
```

**Static Methods:**

##### `download_file(drive_service: Any, file_id: str) -> bytes`
Downloads file content from Google Drive.

##### `extract_text_from_pdf(pdf_content: bytes) -> str`
Extracts text content from PDF using pdfminer.

```python
text = PDFProcessor.extract_text_from_pdf(pdf_bytes)
```

##### `extract_metadata(drive_service: Any, file_id: str) -> Dict[str, Any]`
Extracts file metadata from Drive.

### Deduplication

#### `DeduplicationService`
Content deduplication using SHA-256 hashing.

```python
from src.drive.deduplication import DeduplicationService

service = DeduplicationService()
```

**Static Methods:**

##### `calculate_hash(content: Union[str, bytes]) -> str`
Basic SHA-256 hash calculation.

##### `calculate_drive_file_hash(drive_service: Any, file_id: str) -> str`
Calculates hash for Drive file content.

##### `calculate_text_hash(text: str) -> str`
Normalizes and hashes text content.

##### `calculate_url_hash(url: str) -> str`
Normalizes and hashes URLs.

## Enrichment Module

### Enrichment Processor

#### `EnrichmentProcessor`
Main orchestrator for AI enrichment pipeline.

```python
from src.enrichment.processor import EnrichmentProcessor

processor = EnrichmentProcessor(config, notion_client)
stats = processor.process_batch(limit=10)
# Returns: {"processed": 8, "failed": 1, "skipped": 1}
```

**Methods:**

##### `process_batch(limit: Optional[int] = None) -> Dict[str, int]`
Processes batch of items needing enrichment.

**Parameters:**
- `limit`: Maximum items to process (default: None - process all)

**Returns:** Dictionary with counts: `processed`, `failed`, `skipped`

##### `enrich_content(content: SourceContent, item: Dict[str, Any]) -> EnrichmentResult`
Performs complete AI enrichment on content.

### AI Services

#### `ContentSummarizer`
AI-powered content summarization.

```python
from src.enrichment.summarizer import ContentSummarizer

summarizer = ContentSummarizer(openai_config)
```

##### `generate_summary(content: str, title: str) -> str`
Generates comprehensive markdown summary.

##### `generate_brief_summary(full_summary: str) -> str`
Extracts brief summary (<200 chars) from full summary.

#### `ContentClassifier`
Dynamic content classification based on Notion schema.

```python
from src.enrichment.classifier import ContentClassifier

classifier = ContentClassifier(openai_config, taxonomy)
```

##### `classify_content(content: str, title: str) -> Dict[str, Any]`
Classifies content according to dynamic taxonomy.

**Returns:**
```python
{
    "content_type": "Technical Guide",
    "ai_primitives": ["NLP", "Computer Vision"],
    "vendor": "OpenAI"
}
```

#### `InsightsGenerator`
Extracts actionable insights from content.

```python
from src.enrichment.insights import InsightsGenerator

generator = InsightsGenerator(openai_config)
```

##### `generate_insights(content: str, title: str) -> List[str]`
Generates list of key actionable insights.

## Secondary Sources

### Gmail Integration

#### `GmailCapture`
Captures newsletter emails from Gmail.

```python
from src.secondary_sources.gmail.capture import GmailCapture

capture = GmailCapture(config, notion_client)
stats = capture.capture_emails(limit=50)
```

##### `capture_emails(limit: Optional[int] = None) -> Dict[str, int]`
Captures and processes newsletter emails.

**Parameters:**
- `limit`: Maximum emails to process

**Returns:** Dictionary with counts: `processed`, `skipped`, `failed`

#### `GmailAuthenticator`
Handles OAuth2 authentication for Gmail.

```python
from src.secondary_sources.gmail.auth import GmailAuthenticator

auth = GmailAuthenticator(credentials_path, token_path)
service = auth.get_service()
```

#### `EmailFilter`
Filters emails for quality and relevance.

```python
from src.secondary_sources.gmail.filters import EmailFilter

filter = EmailFilter()
if filter.should_process(sender, message):
    # Process email
```

### Firecrawl Integration

#### `FirecrawlCapture`
Scrapes website content using Firecrawl API.

```python
from src.secondary_sources.firecrawl.capture import FirecrawlCapture

capture = FirecrawlCapture(config, notion_client)
stats = capture.capture_websites(limit=20)
```

##### `capture_websites(limit: Optional[int] = None) -> Dict[str, int]`
Captures content from configured websites.

## Utilities

### Logging

#### `setup_logger(name: str, log_dir: str = "logs") -> logging.Logger`
Sets up structured JSON logging.

```python
from src.utils.logging import setup_logger

logger = setup_logger(__name__)
logger.info("Processing started", extra={"item_count": 10})
```

#### `JSONFormatter`
Custom formatter for structured JSON logs.

#### `LoggerAdapter`
Adapter for adding consistent extra fields to logs.

### Resilience

#### `@with_notion_resilience(retries: int = 3, backoff_base: float = 2.0)`
Decorator for resilient Notion API calls with exponential backoff.

```python
from src.utils.resilience import with_notion_resilience

@with_notion_resilience(retries=5)
def update_notion_page(page_id: str, properties: dict):
    # Automatically retries on timeouts/502s
```

#### `ResilientNotionOps`
Wrapper class for common Notion operations with built-in resilience.

```python
from src.utils.resilience import ResilientNotionOps

ops = ResilientNotionOps(notion_client)
result = ops.query_database(database_id, filter={...})
```

### Markdown Conversion

#### `MarkdownToNotionConverter`
Converts markdown text to Notion block format.

```python
from src.utils.markdown import MarkdownToNotionConverter

converter = MarkdownToNotionConverter()
blocks = converter.convert(markdown_text)
# Returns list of Notion block objects
```

## Usage Examples

### Complete Pipeline Run
```python
from src.core.config import PipelineConfig
from src.core.notion_client import NotionClient
from src.drive.ingester import DriveIngester
from src.enrichment.processor import EnrichmentProcessor

# Initialize
config = PipelineConfig.from_env()
notion_client = NotionClient(config.notion)

# Ingest from Drive
drive_ingester = DriveIngester(config, notion_client)
ingest_stats = drive_ingester.ingest()

# Enrich content
enrichment_processor = EnrichmentProcessor(config, notion_client)
enrich_stats = enrichment_processor.process_batch()

print(f"Ingested: {ingest_stats}")
print(f"Enriched: {enrich_stats}")
```

### Custom Content Processing
```python
from src.core.models import SourceContent, ContentType
from datetime import datetime

# Create custom content
content = SourceContent(
    title="My Custom Document",
    content_type=ContentType.PDF,
    raw_content="Document text content...",
    source_url="https://drive.google.com/...",
    content_hash="abc123...",
    created_date=datetime.now()
)

# Add to Notion
page = notion_client.create_page(content)

# Enrich
result = enrichment_processor.enrich_content(content, page)
```

## Error Handling

All API methods follow consistent error handling patterns:

1. **Notion API Errors**: Handled by resilience decorators with exponential backoff
2. **Validation Errors**: Raised immediately without retry
3. **Archived Pages**: Gracefully skipped with logging
4. **Rate Limits**: Automatic retry with backoff

Example:
```python
try:
    notion_client.update_page_status(page_id, ContentStatus.ENRICHED)
except APIResponseError as e:
    if "archived" in str(e).lower():
        logger.info("Page archived, skipping")
    else:
        logger.error(f"Failed to update: {e}")
```

## Configuration Reference

See `.env.example` in the project root for all available environment variables.

Key variables:
- `NOTION_TOKEN`: Notion API token
- `NOTION_SOURCES_DB`: Database ID
- `OPENAI_API_KEY`: OpenAI API key
- `GOOGLE_APP_CREDENTIALS`: Path to service account JSON
- `BATCH_SIZE`: Processing batch size
- `RATE_LIMIT_DELAY`: API call delay