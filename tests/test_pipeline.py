"""Tests for the simplified knowledge pipeline."""
import json
from unittest.mock import MagicMock, patch

from src.config import PipelineConfig, NotionConfig, DriveConfig, OpenAIConfig
from src.models import ContentStatus, SourceContent, EnrichmentResult
from src.formatter import format_blocks
from src.enrichment import enrich


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def test_config_from_env(monkeypatch):
    monkeypatch.setenv("NOTION_TOKEN", "tok")
    monkeypatch.setenv("NOTION_SOURCES_DB", "db123")
    monkeypatch.setenv("GOOGLE_APP_CREDENTIALS", "/tmp/sa.json")
    monkeypatch.setenv("DRIVE_FOLDER_ID", "folder1")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    cfg = PipelineConfig.from_env()
    assert cfg.notion.token == "tok"
    assert cfg.drive.folder_id == "folder1"
    assert cfg.openai.api_key == "sk-test"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

def test_source_content_to_notion_properties():
    sc = SourceContent(title="test.pdf", hash="abc123", drive_url="https://drive.google.com/file/d/1/view")
    props = sc.to_notion_properties()
    assert props["Title"]["title"][0]["text"]["content"] == "test.pdf"
    assert props["Status"]["select"]["name"] == "Inbox"
    assert props["Hash"]["rich_text"][0]["text"]["content"] == "abc123"
    assert props["Drive URL"]["url"] == "https://drive.google.com/file/d/1/view"


# ---------------------------------------------------------------------------
# Formatter
# ---------------------------------------------------------------------------

def test_format_blocks_structure():
    result = EnrichmentResult(
        summary="This is a test summary. It has two sentences.",
        insights=["Insight one", "Insight two"],
        content_type="Research Paper",
        ai_primitives=["LLM"],
        vendor="OpenAI",
        topical_tags=["testing"],
        domain_tags=["AI/ML"],
    )
    blocks = format_blocks(result)

    # Should contain headings, paragraphs, bullets, dividers
    types = [b["type"] for b in blocks]
    assert "heading_2" in types
    assert "paragraph" in types
    assert "bulleted_list_item" in types
    assert "divider" in types


def test_format_blocks_respects_2000_char_limit():
    long_text = "A" * 5000
    result = EnrichmentResult(
        summary=long_text,
        insights=["ok"],
        content_type="Other",
    )
    blocks = format_blocks(result)
    for block in blocks:
        if block["type"] == "paragraph":
            for rt in block["paragraph"]["rich_text"]:
                assert len(rt["text"]["content"]) <= 2000


# ---------------------------------------------------------------------------
# Enrichment (mocked OpenAI)
# ---------------------------------------------------------------------------

def test_enrich_parses_response():
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = json.dumps({
        "summary": "A test summary.",
        "insights": ["First insight"],
        "content_type": "Research Paper",
        "ai_primitives": ["LLM"],
        "vendor": "Acme",
        "topical_tags": ["testing"],
        "domain_tags": ["AI/ML"],
    })

    config = OpenAIConfig(api_key="sk-test", model="gpt-4.1")

    with patch("src.enrichment.OpenAI") as MockOpenAI:
        client = MockOpenAI.return_value
        client.chat.completions.create.return_value = mock_response

        result = enrich("Some PDF text", config)

    assert result is not None
    assert result.summary == "A test summary."
    assert result.vendor == "Acme"
    assert "LLM" in result.ai_primitives


def test_enrich_returns_none_on_error():
    config = OpenAIConfig(api_key="sk-test", model="gpt-4.1")

    with patch("src.enrichment.OpenAI") as MockOpenAI:
        client = MockOpenAI.return_value
        client.chat.completions.create.side_effect = RuntimeError("API down")

        result = enrich("Some text", config)

    assert result is None
