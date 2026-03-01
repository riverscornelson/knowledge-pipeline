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
    folder_id: str
    service_account_path: str = ""
    oauth_client_secret_path: str = ""
    oauth_token_path: str = ""

    @classmethod
    def from_env(cls) -> "DriveConfig":
        return cls(
            folder_id=os.environ["DRIVE_FOLDER_ID"],
            service_account_path=os.getenv("GOOGLE_APP_CREDENTIALS", ""),
            oauth_client_secret_path=os.getenv("GOOGLE_OAUTH_CLIENT_SECRET", ""),
            oauth_token_path=os.getenv("GOOGLE_OAUTH_TOKEN", "token.json"),
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
