"""
Shared test fixtures for the knowledge pipeline tests.
"""
import pytest
from datetime import datetime
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

from src.core.models import SourceContent, ContentStatus, ContentType
from src.core.config import PipelineConfig, NotionConfig, OpenAIConfig, GoogleDriveConfig


@pytest.fixture
def mock_notion_client(mocker):
    """Mock Notion client with basic happy path responses."""
    client = mocker.Mock()
    
    # Mock database query - single page result
    client.databases.query.return_value = {
        "results": [{
            "id": "test-page-123",
            "properties": {
                "Title": {"title": [{"text": {"content": "Test Document"}}]},
                "Status": {"select": {"name": "Inbox"}},
                "Hash": {"rich_text": [{"text": {"content": "abc123"}}]},
                "Drive URL": {"url": "https://drive.google.com/file/123"},
                "Summary": {"rich_text": []},
                "Content-Type": {"select": None},
                "AI-Primitive": {"multi_select": []},
            }
        }],
        "has_more": False,
        "next_cursor": None
    }
    
    # Mock page creation
    client.pages.create.return_value = {
        "id": "new-page-456",
        "properties": {}
    }
    
    # Mock page update
    client.pages.update.return_value = {
        "id": "test-page-123",
        "properties": {}
    }
    
    # Mock property retrieval for taxonomy
    client.databases.retrieve.return_value = {
        "properties": {
            "Content-Type": {
                "select": {
                    "options": [
                        {"name": "Technical"},
                        {"name": "Tutorial"},
                        {"name": "Research"}
                    ]
                }
            },
            "AI-Primitive": {
                "multi_select": {
                    "options": [
                        {"name": "Classification"},
                        {"name": "Generation"},
                        {"name": "Analysis"}
                    ]
                }
            }
        }
    }
    
    return client


@pytest.fixture
def mock_openai_client(mocker):
    """Mock OpenAI client with basic responses."""
    client = mocker.Mock()
    
    # Mock chat completion response
    response = mocker.Mock()
    response.choices = [
        mocker.Mock(
            message=mocker.Mock(
                content="This is a test summary that is concise and under 200 characters."
            )
        )
    ]
    client.chat.completions.create.return_value = response
    
    return client


@pytest.fixture
def mock_drive_service(mocker):
    """Mock Google Drive service."""
    service = mocker.Mock()
    
    # Mock file listing
    service.files().list().execute.return_value = {
        "files": [
            {
                "id": "drive-file-123",
                "name": "test-document.pdf",
                "mimeType": "application/pdf",
                "webViewLink": "https://drive.google.com/file/d/drive-file-123/view",
                "createdTime": "2024-01-01T00:00:00Z"
            }
        ]
    }
    
    # Mock file download
    service.files().get_media().execute.return_value = b"PDF file content"
    
    return service


@pytest.fixture
def sample_source_content():
    """Sample SourceContent for testing."""
    return SourceContent(
        title="Test Document",
        status=ContentStatus.INBOX,
        hash="abc123def456",
        raw_content="This is test content for a document about AI and machine learning.",
        drive_url="https://drive.google.com/file/d/test-123/view",
        article_url=None,
        content_type=ContentType.PDF,
        created_date=datetime(2024, 1, 1),
        summary=None,
        ai_primitives=None,
        vendor=None,
        notion_page_id=None
    )


@pytest.fixture
def sample_notion_page():
    """Sample Notion page structure."""
    return {
        "id": "page-123",
        "properties": {
            "Title": {"title": [{"text": {"content": "Test Page"}}]},
            "Status": {"select": {"name": "Inbox"}},
            "Drive URL": {"url": "https://drive.google.com/file/123"},
            "Hash": {"rich_text": [{"text": {"content": "hash123"}}]},
            "Summary": {"rich_text": []},
            "Content-Type": {"select": None},
            "AI-Primitive": {"multi_select": []},
        }
    }


@pytest.fixture(autouse=True)
def no_sleep(mocker):
    """Automatically mock time.sleep to speed up tests."""
    mocker.patch('time.sleep')


@pytest.fixture
def mock_env_vars(mocker):
    """Mock environment variables for configuration."""
    env_vars = {
        "NOTION_TOKEN": "test-notion-token",
        "NOTION_SOURCES_DB": "test-database-id",
        "OPENAI_API_KEY": "test-openai-key",
        "GOOGLE_APP_CREDENTIALS": "/path/to/test-creds.json",
        "MODEL_SUMMARY": "gpt-4",
        "MODEL_CLASSIFIER": "gpt-4",
    }
    mocker.patch.dict("os.environ", env_vars)
    return env_vars


@pytest.fixture
def mock_config():
    """Mock PipelineConfig for testing."""
    return PipelineConfig(
        notion=NotionConfig(
            token="test-notion-token",
            sources_db_id="test-database-id",
            created_date_prop="Created Date"
        ),
        google_drive=GoogleDriveConfig(
            service_account_path="/path/to/test-creds.json",
            folder_id=None,
            folder_name="Knowledge-Base"
        ),
        openai=OpenAIConfig(
            api_key="test-openai-key",
            model_summary="gpt-4",
            model_classifier="gpt-4",
            model_insights="gpt-4"
        ),
        batch_size=10,
        rate_limit_delay=0.3
    )


@pytest.fixture
def sample_pdf_content():
    """Sample PDF text content."""
    return """
    Test PDF Document
    
    This is a test PDF document about artificial intelligence and machine learning.
    It contains multiple pages of content that should be extracted and processed.
    
    Key topics covered:
    - Neural networks
    - Deep learning
    - Natural language processing
    
    This document was created for testing purposes.
    """


@pytest.fixture
def sample_enrichment_result():
    """Sample enrichment processing result."""
    return {
        "summary": "A concise test summary under 200 chars",
        "content_type": "Technical",
        "ai_primitives": ["Classification", "Analysis"],
        "insights": [
            "Key insight about neural networks",
            "Important finding about deep learning"
        ],
        "full_summary": """
        # Test Document Summary
        
        This document covers AI and machine learning topics including:
        - Neural networks architecture
        - Deep learning applications
        - NLP techniques
        
        ## Key Takeaways
        The document provides practical examples and implementation details.
        """
    }