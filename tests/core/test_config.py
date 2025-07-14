"""
Tests for configuration management.
"""
import pytest
import os

from src.core.config import PipelineConfig, NotionConfig, GoogleDriveConfig, OpenAIConfig


class TestPipelineConfig:
    """Test PipelineConfig configuration."""
    
    def test_config_from_env(self, mock_env_vars):
        """Test creating config from environment variables."""
        config = PipelineConfig.from_env()
        
        # Check Notion config
        assert config.notion.token == "test-notion-token"
        assert config.notion.sources_db_id == "test-database-id"
        assert config.notion.created_date_prop == "Created Date"
        
        # Check Google Drive config
        assert config.google_drive.service_account_path == "/path/to/test-creds.json"
        assert config.google_drive.folder_name == "Knowledge-Base"
        
        # Check OpenAI config
        assert config.openai.api_key == "test-openai-key"
        assert config.openai.model_summary == "gpt-4"
        assert config.openai.model_classifier == "gpt-4"
        
        # Check pipeline settings
        assert config.batch_size == 10
        assert config.rate_limit_delay == 0.3
    
    def test_config_defaults(self, mocker):
        """Test config with missing optional environment variables."""
        # Mock minimal required env vars
        env_vars = {
            "NOTION_TOKEN": "token",
            "NOTION_SOURCES_DB": "db-id",
            "OPENAI_API_KEY": "key",
            "GOOGLE_APP_CREDENTIALS": "/path/to/creds.json",
        }
        mocker.patch.dict("os.environ", env_vars, clear=True)
        
        config = PipelineConfig.from_env()
        
        # Check required values
        assert config.notion.token == "token"
        assert config.notion.sources_db_id == "db-id"
        assert config.openai.api_key == "key"
        assert config.google_drive.service_account_path == "/path/to/creds.json"
        
        # Check defaults
        assert config.openai.model_summary == "gpt-4.1"  # Default model
        assert config.openai.model_classifier == "gpt-4.1-mini"
        assert config.openai.model_insights == "gpt-4.1"
        assert config.batch_size == 10
        assert config.rate_limit_delay == 0.3
        assert config.google_drive.folder_name == "Knowledge-Base"
    
    def test_config_missing_required(self, mocker):
        """Test config raises error when required vars missing."""
        mocker.patch.dict("os.environ", {}, clear=True)
        
        with pytest.raises(ValueError) as exc_info:
            PipelineConfig.from_env()
        
        # Should mention the missing variable
        assert "NOTION_TOKEN" in str(exc_info.value) or "required" in str(exc_info.value)
    
    def test_config_custom_values(self, mocker):
        """Test config with custom values."""
        env_vars = {
            "NOTION_TOKEN": "custom-token",
            "NOTION_SOURCES_DB": "custom-db",
            "OPENAI_API_KEY": "custom-key",
            "MODEL_SUMMARY": "gpt-3.5-turbo",
            "MODEL_CLASSIFIER": "gpt-4-turbo",
            "MODEL_INSIGHTS": "gpt-4",
            "BATCH_SIZE": "20",
            "GOOGLE_APP_CREDENTIALS": "/custom/path.json",
            "DRIVE_FOLDER_NAME": "Custom-Folder",
            "CREATED_PROP": "Custom Date",
        }
        mocker.patch.dict("os.environ", env_vars, clear=True)
        
        config = PipelineConfig.from_env()
        
        assert config.openai.model_summary == "gpt-3.5-turbo"
        assert config.openai.model_classifier == "gpt-4-turbo"
        assert config.openai.model_insights == "gpt-4"
        assert config.batch_size == 20
        assert config.google_drive.service_account_path == "/custom/path.json"
        assert config.google_drive.folder_name == "Custom-Folder"
        assert config.notion.created_date_prop == "Custom Date"
    
    def test_notion_config_from_env(self, mock_env_vars):
        """Test NotionConfig creation from environment."""
        notion_config = NotionConfig.from_env()
        
        assert notion_config.token == "test-notion-token"
        assert notion_config.sources_db_id == "test-database-id"
        assert notion_config.created_date_prop == "Created Date"
    
    def test_google_drive_config_from_env(self, mock_env_vars):
        """Test GoogleDriveConfig creation from environment."""
        drive_config = GoogleDriveConfig.from_env()
        
        assert drive_config.service_account_path == "/path/to/test-creds.json"
        assert drive_config.folder_name == "Knowledge-Base"
        assert drive_config.folder_id is None  # Not set in mock env
    
    def test_openai_config_from_env(self, mock_env_vars):
        """Test OpenAIConfig creation from environment."""
        openai_config = OpenAIConfig.from_env()
        
        assert openai_config.api_key == "test-openai-key"
        assert openai_config.model_summary == "gpt-4"  # From mock env
        assert openai_config.model_classifier == "gpt-4"  # From mock env
        assert openai_config.model_insights == "gpt-4.1"  # Default