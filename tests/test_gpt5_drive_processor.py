"""
Tests for GPT5DriveProcessor implementation.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
from pathlib import Path

from src.gpt5.drive_processor import GPT5DriveProcessor, GPT5ProcessingResult, DriveDocument
from src.core.config import PipelineConfig, NotionConfig, GoogleDriveConfig, OpenAIConfig


@pytest.fixture
def mock_config():
    """Create a mock configuration for testing."""
    notion_config = Mock(spec=NotionConfig)
    notion_config.token = "test_token"
    notion_config.sources_db_id = "test_db_id"

    drive_config = Mock(spec=GoogleDriveConfig)
    drive_config.service_account_path = "test_path.json"
    drive_config.folder_id = "test_folder"

    openai_config = Mock(spec=OpenAIConfig)
    openai_config.api_key = "test_api_key"

    config = Mock(spec=PipelineConfig)
    config.notion = notion_config
    config.google_drive = drive_config
    config.openai = openai_config
    config.rate_limit_delay = 0.1

    return config


@pytest.fixture
def sample_drive_document():
    """Create a sample DriveDocument for testing."""
    return DriveDocument(
        page_id="test_page_id",
        title="Test Document",
        drive_url="https://drive.google.com/file/d/test_file_id/view",
        file_id="test_file_id",
        status="Inbox",
        created_date=datetime.now(),
        hash="test_hash"
    )


class TestGPT5DriveProcessor:
    """Test cases for GPT5DriveProcessor."""

    @patch('src.gpt5.drive_processor.NotionClient')
    @patch('src.gpt5.drive_processor.openai.OpenAI')
    @patch('src.gpt5.drive_processor.build')
    @patch('src.gpt5.drive_processor.Credentials')
    @patch('builtins.open')
    @patch('src.gpt5.drive_processor.yaml.safe_load')
    def test_initialization(self, mock_yaml, mock_open, mock_credentials,
                           mock_build, mock_openai, mock_notion, mock_config):
        """Test GPT5DriveProcessor initialization."""
        # Mock YAML config loading
        mock_yaml.return_value = {
            "models": {"premium_analyzer": {"model": "gpt-4"}},
            "optimization": {"max_blocks": 12}
        }

        # Mock file existence
        with patch('pathlib.Path.exists', return_value=True):
            processor = GPT5DriveProcessor(mock_config)

        # Verify initialization
        assert processor.config == mock_config
        assert processor.rate_limit_delay == 0.1
        assert processor.max_retries == 3
        assert processor.backoff_factor == 2
        assert "processed" in processor.stats

        mock_notion.assert_called_once()
        mock_openai.assert_called_once()
        mock_build.assert_called_once()

    def test_extract_file_id_formats(self, mock_config):
        """Test file ID extraction from different URL formats."""
        with patch('src.gpt5.drive_processor.NotionClient'), \
             patch('src.gpt5.drive_processor.openai.OpenAI'), \
             patch('src.gpt5.drive_processor.build'), \
             patch('src.gpt5.drive_processor.Credentials'), \
             patch('builtins.open'), \
             patch('src.gpt5.drive_processor.yaml.safe_load', return_value={}), \
             patch('pathlib.Path.exists', return_value=False):

            processor = GPT5DriveProcessor(mock_config)

        # Test /d/ format
        url1 = "https://drive.google.com/file/d/abc123def456/view"
        assert processor._extract_file_id(url1) == "abc123def456"

        # Test id= format
        url2 = "https://drive.google.com/open?id=xyz789uvw012"
        assert processor._extract_file_id(url2) == "xyz789uvw012"

        # Test unrecognized format
        url3 = "https://drive.google.com/invalid/format"
        assert processor._extract_file_id(url3) is None

    def test_calculate_quality_score(self, mock_config):
        """Test quality score calculation."""
        with patch('src.gpt5.drive_processor.NotionClient'), \
             patch('src.gpt5.drive_processor.openai.OpenAI'), \
             patch('src.gpt5.drive_processor.build'), \
             patch('src.gpt5.drive_processor.Credentials'), \
             patch('builtins.open'), \
             patch('src.gpt5.drive_processor.yaml.safe_load', return_value={}), \
             patch('pathlib.Path.exists', return_value=False):

            processor = GPT5DriveProcessor(mock_config)

        # Test high-quality content
        content = """
        ## Strategic Analysis

        This is a comprehensive insight into market opportunities and strategic recommendations.
        The analysis reveals significant risks that require immediate attention.
        """
        score = processor._calculate_quality_score(content, 8.0)
        assert score >= 8.0  # Should be high quality

        # Test low-quality content
        content_low = "Short text"
        score_low = processor._calculate_quality_score(content_low, 25.0)
        assert score_low < 7.0  # Should be lower quality

    def test_classify_content_type(self, mock_config):
        """Test content type classification."""
        with patch('src.gpt5.drive_processor.NotionClient'), \
             patch('src.gpt5.drive_processor.openai.OpenAI'), \
             patch('src.gpt5.drive_processor.build'), \
             patch('src.gpt5.drive_processor.Credentials'), \
             patch('builtins.open'), \
             patch('src.gpt5.drive_processor.yaml.safe_load', return_value={}), \
             patch('pathlib.Path.exists', return_value=False):

            processor = GPT5DriveProcessor(mock_config)

        # Test research classification
        research_content = "This study examines the methodology for analyzing market research data."
        assert processor._classify_content_type(research_content) == "research"

        # Test market news classification
        news_content = "Market announcement reveals new product capabilities and competitive positioning."
        assert processor._classify_content_type(news_content) == "market_news"

        # Test vendor capability classification
        vendor_content = "Vendor product capabilities include advanced features and integration options."
        assert processor._classify_content_type(vendor_content) == "vendor_capability"

        # Test general classification
        general_content = "This is some general content without specific keywords."
        assert processor._classify_content_type(general_content) == "general"

    @patch('src.gpt5.drive_processor.NotionClient')
    @patch('src.gpt5.drive_processor.openai.OpenAI')
    @patch('src.gpt5.drive_processor.build')
    @patch('src.gpt5.drive_processor.Credentials')
    @patch('builtins.open')
    @patch('src.gpt5.drive_processor.yaml.safe_load')
    def test_gpt5_processing_result(self, mock_yaml, mock_open, mock_credentials,
                                   mock_build, mock_openai, mock_notion, mock_config):
        """Test GPT5ProcessingResult dataclass."""
        result = GPT5ProcessingResult(
            content="Test analysis content",
            quality_score=8.5,
            processing_time=12.3,
            token_usage={"total_tokens": 1500},
            content_type="research",
            confidence_scores={"overall": 0.85},
            web_search_used=True,
            error=None
        )

        assert result.content == "Test analysis content"
        assert result.quality_score == 8.5
        assert result.processing_time == 12.3
        assert result.token_usage["total_tokens"] == 1500
        assert result.content_type == "research"
        assert result.confidence_scores["overall"] == 0.85
        assert result.web_search_used is True
        assert result.error is None

    def test_drive_document_creation(self, sample_drive_document):
        """Test DriveDocument dataclass creation."""
        assert sample_drive_document.page_id == "test_page_id"
        assert sample_drive_document.title == "Test Document"
        assert sample_drive_document.drive_url == "https://drive.google.com/file/d/test_file_id/view"
        assert sample_drive_document.file_id == "test_file_id"
        assert sample_drive_document.status == "Inbox"
        assert sample_drive_document.hash == "test_hash"
        assert isinstance(sample_drive_document.created_date, datetime)

    @patch('src.gpt5.drive_processor.NotionClient')
    @patch('src.gpt5.drive_processor.openai.OpenAI')
    @patch('src.gpt5.drive_processor.build')
    @patch('src.gpt5.drive_processor.Credentials')
    @patch('builtins.open')
    @patch('src.gpt5.drive_processor.yaml.safe_load')
    def test_fallback_config(self, mock_yaml, mock_open, mock_credentials,
                            mock_build, mock_openai, mock_notion, mock_config):
        """Test fallback configuration when config file is missing."""
        mock_yaml.side_effect = Exception("Config load failed")

        with patch('pathlib.Path.exists', return_value=False):
            processor = GPT5DriveProcessor(mock_config)

        # Verify fallback config is used
        assert "models" in processor.gpt5_config
        assert "premium_analyzer" in processor.gpt5_config["models"]
        assert processor.gpt5_config["models"]["premium_analyzer"]["model"] == "gpt-4"
        assert processor.gpt5_config["optimization"]["quality_threshold"] == 9.0


if __name__ == "__main__":
    pytest.main([__file__])