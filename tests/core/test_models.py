"""
Tests for core data models.
"""
import pytest
from datetime import datetime

from src.core.models import SourceContent, ContentStatus, ContentType


class TestSourceContent:
    """Test SourceContent model."""
    
    def test_create_source_content(self):
        """Test creating a SourceContent instance."""
        content = SourceContent(
            title="Test Document",
            status=ContentStatus.INBOX,
            hash="abc123",
            raw_content="Test content",
            drive_url="https://drive.google.com/file/123",
            article_url=None,
            content_type=ContentType.PDF
        )
        
        assert content.title == "Test Document"
        assert content.raw_content == "Test content"
        assert content.drive_url == "https://drive.google.com/file/123"
        assert content.article_url is None
        assert content.hash == "abc123"
        assert content.content_type == ContentType.PDF
        assert content.status == ContentStatus.INBOX
    
    def test_to_notion_properties(self):
        """Test conversion to Notion properties format."""
        content = SourceContent(
            title="Test Document",
            status=ContentStatus.INBOX,
            hash="abc123",
            raw_content="Test content",
            drive_url="https://drive.google.com/file/123",
            article_url=None,
            content_type=ContentType.PDF,
            created_date=datetime(2024, 1, 1),
            ai_primitives=["Classification", "Analysis"],
            vendor="OpenAI"
        )
        
        properties = content.to_notion_properties()
        
        # Check required properties
        assert properties["Title"]["title"][0]["text"]["content"] == "Test Document"
        assert properties["Status"]["select"]["name"] == "Inbox"
        assert properties["Drive URL"]["url"] == "https://drive.google.com/file/123"
        assert properties["Hash"]["rich_text"][0]["text"]["content"] == "abc123"
        
        # Check optional properties
        assert properties["Vendor"]["select"]["name"] == "OpenAI"
        
        # Check date formatting - should be ISO format
        assert "Created Date" in properties
        assert properties["Created Date"]["date"]["start"].startswith("2024-01-01")
        
        # Check AI primitives
        assert len(properties["AI-Primitive"]["multi_select"]) == 2
        assert properties["AI-Primitive"]["multi_select"][0]["name"] == "Classification"
    
    def test_to_notion_properties_minimal(self):
        """Test conversion with minimal data."""
        content = SourceContent(
            title="Minimal",
            status=ContentStatus.INBOX,
            hash="xyz",
            raw_content="Content",
            drive_url=None,
            article_url="https://example.com",
            content_type=ContentType.WEBSITE
        )
        
        properties = content.to_notion_properties()
        
        # Check URL goes to Article URL for non-Drive sources
        assert properties["Article URL"]["url"] == "https://example.com"
        assert "Drive URL" not in properties or properties["Drive URL"]["url"] is None
    
    def test_to_notion_properties_with_enrichment(self):
        """Test conversion with enrichment data."""
        content = SourceContent(
            title="Enriched Document",
            status=ContentStatus.ENRICHED,
            hash="123",
            raw_content="Content",
            drive_url=None,
            article_url="https://example.com",
            content_type=ContentType.WEBSITE,
            ai_primitives=["Classification", "Analysis"]
        )
        
        properties = content.to_notion_properties()
        
        # Check enrichment properties
        # Content-Type is stored based on the content_type field
        if "Content-Type" in properties:
            assert properties["Content-Type"]["select"]["name"] == "Website"
        assert len(properties["AI-Primitive"]["multi_select"]) == 2
        assert properties["AI-Primitive"]["multi_select"][0]["name"] == "Classification"


class TestContentStatus:
    """Test ContentStatus enum."""
    
    def test_status_values(self):
        """Test enum values match expected strings."""
        assert ContentStatus.INBOX.value == "Inbox"
        assert ContentStatus.ENRICHED.value == "Enriched"
        assert ContentStatus.FAILED.value == "Failed"
    
    def test_status_from_string(self):
        """Test creating enum from string value."""
        assert ContentStatus("Inbox") == ContentStatus.INBOX
        assert ContentStatus("Enriched") == ContentStatus.ENRICHED
        assert ContentStatus("Failed") == ContentStatus.FAILED


class TestContentType:
    """Test ContentType enum."""
    
    def test_content_type_values(self):
        """Test enum values."""
        assert ContentType.PDF.value == "PDF"
        assert ContentType.WEBSITE.value == "Website"
        assert ContentType.EMAIL.value == "Email"