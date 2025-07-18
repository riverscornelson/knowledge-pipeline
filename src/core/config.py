"""
Centralized configuration management for the knowledge pipeline.
"""
import os
from dataclasses import dataclass
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


@dataclass
class NotionConfig:
    """Notion API configuration."""
    token: str
    sources_db_id: str
    created_date_prop: str = "Created Date"
    
    @classmethod
    def from_env(cls) -> "NotionConfig":
        """Create config from environment variables."""
        token = os.getenv("NOTION_TOKEN")
        if not token:
            raise ValueError("NOTION_TOKEN environment variable is required")
        
        db_id = os.getenv("NOTION_SOURCES_DB")
        if not db_id:
            raise ValueError("NOTION_SOURCES_DB environment variable is required")
        
        return cls(
            token=token,
            sources_db_id=db_id,
            created_date_prop=os.getenv("CREATED_PROP", "Created Date")
        )


@dataclass
class GoogleDriveConfig:
    """Google Drive API configuration."""
    service_account_path: str
    folder_id: Optional[str] = None
    folder_name: str = "Knowledge-Base"
    
    @classmethod
    def from_env(cls) -> "GoogleDriveConfig":
        """Create config from environment variables."""
        sa_path = os.getenv("GOOGLE_APP_CREDENTIALS")
        if not sa_path:
            raise ValueError("GOOGLE_APP_CREDENTIALS environment variable is required")
        
        return cls(
            service_account_path=sa_path,
            folder_id=os.getenv("DRIVE_FOLDER_ID"),
            folder_name=os.getenv("DRIVE_FOLDER_NAME", "Knowledge-Base")
        )


@dataclass
class OpenAIConfig:
    """OpenAI API configuration."""
    api_key: str
    model_summary: str = "gpt-4.1"
    model_classifier: str = "gpt-4.1-mini"
    model_insights: str = "gpt-4.1"
    
    @property
    def model(self) -> str:
        """Default model for backward compatibility."""
        return self.model_summary
    
    @classmethod
    def from_env(cls) -> "OpenAIConfig":
        """Create config from environment variables."""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")
        
        return cls(
            api_key=api_key,
            model_summary=os.getenv("MODEL_SUMMARY", "gpt-4.1"),
            model_classifier=os.getenv("MODEL_CLASSIFIER", "gpt-4.1-mini"),
            model_insights=os.getenv("MODEL_INSIGHTS", "gpt-4.1")
        )


@dataclass
class LocalUploaderConfig:
    """Local PDF uploader configuration."""
    enabled: bool = False
    scan_days: int = 7
    upload_folder_id: Optional[str] = None  # Uses default Drive folder if None
    delete_after_upload: bool = False
    
    @classmethod
    def from_env(cls) -> "LocalUploaderConfig":
        """Create config from environment variables."""
        return cls(
            enabled=os.getenv("LOCAL_UPLOADER_ENABLED", "false").lower() == "true",
            scan_days=int(os.getenv("LOCAL_SCAN_DAYS", "7")),
            upload_folder_id=os.getenv("LOCAL_UPLOAD_FOLDER_ID"),
            delete_after_upload=os.getenv("LOCAL_DELETE_AFTER_UPLOAD", "false").lower() == "true"
        )


@dataclass
class PipelineConfig:
    """Main pipeline configuration."""
    notion: NotionConfig
    google_drive: GoogleDriveConfig
    openai: OpenAIConfig
    local_uploader: LocalUploaderConfig
    
    # Processing settings
    batch_size: int = 10
    rate_limit_delay: float = 0.3
    
    @classmethod
    def from_env(cls) -> "PipelineConfig":
        """Create complete config from environment variables."""
        return cls(
            notion=NotionConfig.from_env(),
            google_drive=GoogleDriveConfig.from_env(),
            openai=OpenAIConfig.from_env(),
            local_uploader=LocalUploaderConfig.from_env(),
            batch_size=int(os.getenv("BATCH_SIZE", "10")),
            rate_limit_delay=float(os.getenv("RATE_LIMIT_DELAY", "0.3"))
        )