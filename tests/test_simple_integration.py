"""
Simple integration tests that match the actual implementation.
"""
import pytest
from unittest.mock import Mock, patch
from datetime import datetime

from src.core.models import SourceContent, ContentStatus, ContentType
from src.core.config import PipelineConfig


class TestSimpleIntegration:
    """Basic happy path tests that match actual implementation."""
    
    def test_source_content_creation(self):
        """Test creating a SourceContent matches implementation."""
        content = SourceContent(
            title="Test",
            status=ContentStatus.INBOX,
            hash="abc123",
            raw_content="Test content",
            drive_url="https://drive.google.com/file/123",
            article_url=None,
            content_type=ContentType.PDF
        )
        
        assert content.title == "Test"
        assert content.raw_content == "Test content"
        assert content.status == ContentStatus.INBOX
    
    def test_config_from_env(self, mock_env_vars):
        """Test configuration loading from environment."""
        config = PipelineConfig.from_env()
        
        assert config.notion.token == "test-notion-token"
        assert config.notion.sources_db_id == "test-database-id"
        assert config.openai.api_key == "test-openai-key"
    
    def test_notion_properties_format(self):
        """Test Notion properties format generation."""
        content = SourceContent(
            title="Doc",
            status=ContentStatus.INBOX,
            hash="hash123",
            raw_content="Content",
            drive_url="https://example.com",
            article_url=None,
            content_type=ContentType.PDF
        )
        
        props = content.to_notion_properties()
        
        # Basic structure check
        assert "Title" in props
        assert "Status" in props
        assert props["Title"]["title"][0]["text"]["content"] == "Doc"
        assert props["Status"]["select"]["name"] == "Inbox"
    
    def test_basic_pipeline_flow(self, mock_config, mock_notion_client):
        """Test basic pipeline flow without full mocking."""
        # This demonstrates the basic flow
        from src.drive.ingester import DriveIngester
        from src.enrichment.processor import EnrichmentProcessor
        
        # Without Drive credentials, ingester should still initialize
        mock_config.google_drive.service_account_path = ""
        
        with patch('src.drive.ingester.PDFProcessor'):
            with patch('src.drive.ingester.DeduplicationService'):
                ingester = DriveIngester(mock_config, mock_notion_client)
                assert ingester.drive is None  # No credentials
                
                # Should handle gracefully
                stats = ingester.ingest()
                assert stats["total"] == 0