"""Pipeline configuration loaded from environment variables."""
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass
class NotionConfig:
    token: str
    sources_db_id: str

    @classmethod
    def from_env(cls) -> "NotionConfig":
        token = os.environ["NOTION_TOKEN"]
        db_id = os.environ["NOTION_SOURCES_DB"]
        return cls(token=token, sources_db_id=db_id)


@dataclass
class DriveConfig:
    service_account_path: str
    folder_id: str

    @classmethod
    def from_env(cls) -> "DriveConfig":
        return cls(
            service_account_path=os.environ["GOOGLE_APP_CREDENTIALS"],
            folder_id=os.environ["DRIVE_FOLDER_ID"],
        )


@dataclass
class OpenAIConfig:
    api_key: str
    model: str = "gpt-5.3-codex"
    max_tool_iterations: int = 50

    @classmethod
    def from_env(cls) -> "OpenAIConfig":
        return cls(
            api_key=os.environ["OPENAI_API_KEY"],
            model=os.getenv("OPENAI_MODEL", "gpt-5.3-codex"),
            max_tool_iterations=int(os.getenv("ENRICHMENT_MAX_ITERATIONS", "5")),
        )


@dataclass
class PipelineConfig:
    notion: NotionConfig
    drive: DriveConfig
    openai: OpenAIConfig

    @classmethod
    def from_env(cls) -> "PipelineConfig":
        return cls(
            notion=NotionConfig.from_env(),
            drive=DriveConfig.from_env(),
            openai=OpenAIConfig.from_env(),
        )
