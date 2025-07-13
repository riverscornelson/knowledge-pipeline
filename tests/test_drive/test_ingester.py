"""
Tests for Drive ingester module.
"""
import pytest
from unittest.mock import Mock, MagicMock
from src.core.config import PipelineConfig, GoogleDriveConfig, NotionConfig
from src.core.notion_client import NotionClient
from src.drive.ingester import DriveIngester


@pytest.fixture
def mock_config():
    """Create mock configuration."""
    config = Mock(spec=PipelineConfig)
    config.google_drive = Mock(spec=GoogleDriveConfig)
    config.google_drive.service_account_path = "test.json"
    config.google_drive.folder_id = "test_folder_id"
    config.rate_limit_delay = 0.1
    return config


@pytest.fixture
def mock_notion_client():
    """Create mock Notion client."""
    return Mock(spec=NotionClient)


def test_drive_ingester_initialization(mock_config, mock_notion_client, monkeypatch):
    """Test Drive ingester initialization."""
    # Mock Google credentials
    mock_creds = Mock()
    monkeypatch.setattr(
        "src.drive.ingester.Credentials.from_service_account_file",
        Mock(return_value=mock_creds)
    )
    
    # Mock build function
    mock_drive_service = Mock()
    monkeypatch.setattr(
        "src.drive.ingester.build",
        Mock(return_value=mock_drive_service)
    )
    
    # Create ingester
    ingester = DriveIngester(mock_config, mock_notion_client)
    
    assert ingester.config == mock_config
    assert ingester.notion_client == mock_notion_client
    assert ingester.drive == mock_drive_service


def test_get_folder_files(mock_config, mock_notion_client, monkeypatch):
    """Test getting files from Drive folder."""
    # Setup mocks
    mock_creds = Mock()
    monkeypatch.setattr(
        "src.drive.ingester.Credentials.from_service_account_file",
        Mock(return_value=mock_creds)
    )
    
    mock_drive_service = Mock()
    mock_files_list = Mock()
    mock_files_list.execute.return_value = {
        "files": [
            {"id": "file1", "name": "test1.pdf"},
            {"id": "file2", "name": "test2.pdf"}
        ]
    }
    mock_drive_service.files.return_value.list.return_value = mock_files_list
    
    monkeypatch.setattr(
        "src.drive.ingester.build",
        Mock(return_value=mock_drive_service)
    )
    
    # Test
    ingester = DriveIngester(mock_config, mock_notion_client)
    files = ingester.get_folder_files()
    
    assert len(files) == 2
    assert files[0]["name"] == "test1.pdf"
    assert files[1]["name"] == "test2.pdf"