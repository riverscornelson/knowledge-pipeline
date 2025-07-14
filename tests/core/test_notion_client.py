"""
Tests for Notion client operations.
"""
import pytest
from unittest.mock import Mock, patch

from src.core.notion_client import NotionClient
from src.core.models import SourceContent, ContentStatus, ContentType


class TestNotionClient:
    """Test NotionClient operations."""
    
    def test_create_notion_client(self, mock_config):
        """Test creating NotionClient instance."""
        with patch('src.core.notion_client.Client') as mock_client_class:
            client = NotionClient(mock_config.notion)
            
            # Verify Notion client was initialized with token
            mock_client_class.assert_called_once_with(auth="test-notion-token")
            assert client.db_id == "test-database-id"
    
    def test_create_page(self, mock_notion_client, sample_source_content, mock_config):
        """Test creating new page in Notion."""
        with patch('src.core.notion_client.Client') as mock_client_class:
            mock_client_class.return_value = mock_notion_client
            
            client = NotionClient(mock_config.notion)
            page_id = client.create_page(sample_source_content)
            
            # Verify page creation was called
            mock_notion_client.pages.create.assert_called_once()
            call_args = mock_notion_client.pages.create.call_args[1]
            
            # Check database ID
            assert call_args["parent"]["database_id"] == "test-database-id"
            
            # Check properties were set
            properties = call_args["properties"]
            assert properties["Title"]["title"][0]["text"]["content"] == "Test Document"
            assert properties["Status"]["select"]["name"] == "Inbox"
            
            # Check return value
            assert page_id == "new-page-456"
    
    def test_update_page_status(self, mock_notion_client, mock_config):
        """Test updating page status."""
        with patch('src.core.notion_client.Client') as mock_client_class:
            mock_client_class.return_value = mock_notion_client
            
            client = NotionClient(mock_config.notion)
            
            # Mock the update
            mock_notion_client.pages.update.return_value = {"id": "page-123"}
            
            # Update status
            client.update_page_status(
                page_id="page-123",
                status=ContentStatus.ENRICHED
            )
            
            # Verify update was called
            mock_notion_client.pages.update.assert_called_once()
            call_args = mock_notion_client.pages.update.call_args[1]
            assert call_args["page_id"] == "page-123"
            assert call_args["properties"]["Status"]["select"]["name"] == "Enriched"
    
    def test_get_inbox_items(self, mock_notion_client, mock_config):
        """Test retrieving inbox items."""
        with patch('src.core.notion_client.Client') as mock_client_class:
            mock_client_class.return_value = mock_notion_client
            
            client = NotionClient(mock_config.notion)
            items = list(client.get_inbox_items())
            
            # Verify query was called
            mock_notion_client.databases.query.assert_called_once()
            call_args = mock_notion_client.databases.query.call_args[1]
            
            # Check filter
            assert call_args["filter"]["property"] == "Status"
            assert call_args["filter"]["select"]["equals"] == "Inbox"
            
            # Check results
            assert len(items) == 1
            assert items[0]["id"] == "test-page-123"
    
    def test_check_hash_exists(self, mock_notion_client, mock_config):
        """Test checking if hash exists."""
        with patch('src.core.notion_client.Client') as mock_client_class:
            mock_client_class.return_value = mock_notion_client
            
            # Test when duplicate exists
            mock_notion_client.databases.query.return_value = {
                "results": [{"id": "existing-page"}],
                "has_more": False
            }
            
            client = NotionClient(mock_config.notion)
            exists = client.check_hash_exists("abc123")
            
            # Should return True
            assert exists is True
            
            # Test when no duplicate
            mock_notion_client.databases.query.return_value = {
                "results": [],
                "has_more": False
            }
            
            exists = client.check_hash_exists("new-hash")
            assert exists is False
    
    def test_add_content_blocks(self, mock_notion_client, mock_config):
        """Test adding content blocks to a page."""
        with patch('src.core.notion_client.Client') as mock_client_class:
            mock_client_class.return_value = mock_notion_client
            
            client = NotionClient(mock_config.notion)
            
            # Create test blocks
            blocks = [
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{"text": {"content": "Test content"}}]
                    }
                }
            ]
            
            client.add_content_blocks("page-123", blocks)
            
            # Verify blocks were appended
            mock_notion_client.blocks.children.append.assert_called_once()
            call_args = mock_notion_client.blocks.children.append.call_args[1]
            
            assert call_args["block_id"] == "page-123"
            assert call_args["children"] == blocks