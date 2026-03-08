"""Tests for the simplified knowledge pipeline."""
import json
import os
from unittest.mock import MagicMock, patch

import pytest

from src.config import PipelineConfig, NotionConfig, DriveConfig, OpenAIConfig
from src.models import ContentStatus, SourceContent, EnrichmentResult
from src.formatter import format_blocks
from src.enrichment import enrich
from src.retry import retry_on_transient
from src.pipeline import Pipeline


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
    assert props["Source File"]["rich_text"][0]["text"]["content"] == "test.pdf"
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


def test_format_blocks_includes_client_relevance():
    result = EnrichmentResult(
        summary="Test summary.",
        insights=["Insight"],
        content_type="Other",
        client_relevance=[
            "CapitalSpring — Foundation Engagement: PE data informs AI readiness.",
            "AcmeCorp — Workshop: Relevant trends for upcoming session.",
        ],
    )
    blocks = format_blocks(result)
    heading_texts = [
        b["heading_2"]["rich_text"][0]["text"]["content"]
        for b in blocks
        if b["type"] == "heading_2"
    ]
    assert "Client Relevance" in heading_texts
    bullets = [b for b in blocks if b["type"] == "bulleted_list_item"]
    assert len(bullets) >= 2


def test_format_blocks_includes_new_sections():
    result = EnrichmentResult(
        summary="Test summary.",
        insights=["Insight"],
        content_type="Other",
        key_quotes=["On AI: 'This is transformative.'"],
        outline=["- Introduction", "- Main argument", "- Conclusion"],
        connections=["Builds on Prior Report's findings on adoption."],
    )
    blocks = format_blocks(result)
    headings = [
        b[b["type"]]["rich_text"][0]["text"]["content"]
        for b in blocks
        if b["type"] == "heading_2"
    ]
    assert "Key Quotes" in headings
    assert "Outline" in headings
    assert "Related Knowledge" in headings
    # Key Quotes should come before Key Insights
    assert headings.index("Key Quotes") < headings.index("Key Insights")
    # Verify quote block type exists
    quote_blocks = [b for b in blocks if b["type"] == "quote"]
    assert len(quote_blocks) == 1


def test_format_blocks_omits_empty_new_sections():
    result = EnrichmentResult(
        summary="Test summary.",
        insights=["Insight"],
        content_type="Other",
        key_quotes=[],
        outline=[],
        connections=[],
    )
    blocks = format_blocks(result)
    headings = [
        b[b["type"]]["rich_text"][0]["text"]["content"]
        for b in blocks
        if b["type"] == "heading_2"
    ]
    assert "Key Quotes" not in headings
    assert "Outline" not in headings
    assert "Related Knowledge" not in headings


def test_format_blocks_quote_chunking():
    long_quote = "A" * 5000
    result = EnrichmentResult(
        summary="Test.",
        insights=["Insight"],
        content_type="Other",
        key_quotes=[long_quote],
    )
    blocks = format_blocks(result)
    quote_blocks = [b for b in blocks if b["type"] == "quote"]
    assert len(quote_blocks) == 1
    for rt in quote_blocks[0]["quote"]["rich_text"]:
        assert len(rt["text"]["content"]) <= 2000


def test_format_blocks_no_client_relevance_when_empty():
    result = EnrichmentResult(
        summary="Test summary.",
        insights=["Insight"],
        content_type="Other",
        client_relevance=[],
    )
    blocks = format_blocks(result)
    heading_texts = [
        b["heading_2"]["rich_text"][0]["text"]["content"]
        for b in blocks
        if b["type"] == "heading_2"
    ]
    assert "Client Relevance" not in heading_texts


# ---------------------------------------------------------------------------
# Helpers for mocking OpenAI Responses API objects
# ---------------------------------------------------------------------------

def _mock_text_response(json_data):
    """Create a mock Responses API response with a text message output."""
    text_content = MagicMock()
    text_content.text = json.dumps(json_data)

    message_item = MagicMock()
    message_item.type = "message"
    message_item.content = [text_content]

    response = MagicMock()
    response.output = [message_item]
    response.output_text = json.dumps(json_data)
    return response


def _mock_function_call(call_id, name, arguments):
    """Create a mock function_call output item."""
    fc = MagicMock()
    fc.type = "function_call"
    fc.call_id = call_id
    fc.name = name
    fc.arguments = json.dumps(arguments)
    return fc


def _mock_tool_response(function_calls):
    """Create a mock Responses API response with function_call items."""
    response = MagicMock()
    response.output = function_calls
    response.output_text = ""
    return response


# ---------------------------------------------------------------------------
# Enrichment (mocked OpenAI Responses API)
# ---------------------------------------------------------------------------

def test_enrich_parses_response():
    config = OpenAIConfig(api_key="sk-test", model="gpt-5.3-codex")

    mock_response = _mock_text_response({
        "summary": "A test summary.",
        "insights": ["First insight"],
        "content_type": "Research Paper",
        "ai_primitives": ["LLM"],
        "vendor": "Acme",
        "topical_tags": ["testing"],
        "domain_tags": ["AI/ML"],
        "key_quotes": ["On testing: 'This is a direct quote.'"],
        "outline": ["- Introduction", "  - Background", "- Conclusion"],
        "connections": ["Builds on Prior AI Report analysis of adoption."],
    })

    with patch("src.enrichment.OpenAI") as MockOpenAI:
        client = MockOpenAI.return_value
        client.responses.create.return_value = mock_response

        result = enrich("Some PDF text", config)

    assert result is not None
    assert result.summary == "A test summary."
    assert result.vendor == "Acme"
    assert "LLM" in result.ai_primitives
    assert result.client_relevance == []
    assert result.key_quotes == ["On testing: 'This is a direct quote.'"]
    assert len(result.outline) == 3
    assert len(result.connections) == 1


def test_enrich_new_fields_default_empty():
    """Missing key_quotes, outline, connections should default to empty lists."""
    config = OpenAIConfig(api_key="sk-test", model="gpt-5.3-codex")

    mock_response = _mock_text_response({
        "summary": "Summary.",
        "insights": ["Insight"],
        "content_type": "Other",
    })

    with patch("src.enrichment.OpenAI") as MockOpenAI:
        client = MockOpenAI.return_value
        client.responses.create.return_value = mock_response

        result = enrich("Some text", config)

    assert result is not None
    assert result.key_quotes == []
    assert result.outline == []
    assert result.connections == []


def test_enrich_returns_none_on_error():
    config = OpenAIConfig(api_key="sk-test", model="gpt-5.3-codex")

    with patch("src.enrichment.OpenAI") as MockOpenAI:
        client = MockOpenAI.return_value
        client.responses.create.side_effect = RuntimeError("API down")

        result = enrich("Some text", config)

    assert result is None


def test_enrich_with_tool_calls():
    """Test two-round agentic loop: model calls search_notion, then returns JSON."""
    # Round 1: model wants to call search_notion
    fc = _mock_function_call("call_001", "search_notion", {"query": "CapitalSpring"})
    first_response = _mock_tool_response([fc])

    # Round 2: model returns final JSON
    second_response = _mock_text_response({
        "summary": "PE AI adoption report.",
        "insights": ["Key insight"],
        "content_type": "Industry Report",
        "ai_primitives": ["LLM"],
        "vendor": None,
        "topical_tags": ["PE", "AI"],
        "domain_tags": ["Private Equity"],
        "client_relevance": [
            "CapitalSpring — Foundation Engagement: PE data informs AI readiness."
        ],
    })

    config = OpenAIConfig(api_key="sk-test", model="gpt-5.3-codex")
    mock_notion = MagicMock()
    mock_notion.search_workspace.return_value = [
        {"page_id": "abc123", "title": "CapitalSpring Overview", "url": "https://notion.so/abc123"}
    ]

    with patch("src.enrichment.OpenAI") as MockOpenAI:
        client = MockOpenAI.return_value
        client.responses.create.side_effect = [first_response, second_response]

        result = enrich("AI in PE report text", config, notion=mock_notion)

    assert result is not None
    assert result.summary == "PE AI adoption report."
    assert len(result.client_relevance) == 1
    assert "CapitalSpring" in result.client_relevance[0]
    mock_notion.search_workspace.assert_called_once_with("CapitalSpring")


def test_enrich_with_list_clients_tool():
    """Test that list_clients tool is dispatched and results inform client_relevance."""
    # Round 1: model calls list_clients
    fc = _mock_function_call("call_lc", "list_clients", {})
    first_response = _mock_tool_response([fc])

    # Round 2: model returns final JSON using client data
    second_response = _mock_text_response({
        "summary": "AI workflow automation trends.",
        "insights": ["Key insight about PE adoption"],
        "content_type": "Industry Report",
        "ai_primitives": ["LLM"],
        "vendor": None,
        "topical_tags": ["AI", "PE"],
        "domain_tags": ["Private Equity"],
        "client_relevance": [
            "CapitalSpring — Foundation Engagement: PE AI adoption data directly relevant.",
            "Acme Services — Workshop: Professional services AI trends applicable.",
        ],
    })

    config = OpenAIConfig(api_key="sk-test", model="gpt-5.3-codex")
    mock_notion = MagicMock()
    mock_notion.list_clients.return_value = [
        {
            "company": "CapitalSpring",
            "industry": "PE/Investment",
            "status": "Active Customer",
            "notes": "PE firm focused on foodservice.",
            "page_id": "client-001",
        },
        {
            "company": "Acme Services",
            "industry": "Professional Services",
            "status": "Prospect",
            "notes": "Interested in AI workshops.",
            "page_id": "client-002",
        },
    ]

    with patch("src.enrichment.OpenAI") as MockOpenAI:
        client = MockOpenAI.return_value
        client.responses.create.side_effect = [first_response, second_response]

        result = enrich("AI in PE report text", config, notion=mock_notion)

    assert result is not None
    assert len(result.client_relevance) == 2
    assert "CapitalSpring" in result.client_relevance[0]
    mock_notion.list_clients.assert_called_once()


def test_enrich_with_search_rvf_tool():
    """Test that search_rvf tool is dispatched to the rvf_search callback."""
    # Round 1: model calls search_rvf
    fc = _mock_function_call("call_rvf", "search_rvf", {"query": "enterprise AI adoption"})
    first_response = _mock_tool_response([fc])

    # Round 2: model returns final JSON
    second_response = _mock_text_response({
        "summary": "Enterprise AI trends report.",
        "insights": ["RVF found related prior research"],
        "content_type": "Industry Report",
        "ai_primitives": ["LLM"],
        "vendor": None,
        "topical_tags": ["AI", "Enterprise"],
        "domain_tags": ["AI/ML"],
        "client_relevance": [],
    })

    config = OpenAIConfig(api_key="sk-test", model="gpt-5.3-codex")
    mock_notion = MagicMock()
    mock_notion.list_clients.return_value = []

    mock_rvf = MagicMock(return_value=[
        {"title": "Prior AI Report", "text": "Related content...", "score": 0.85}
    ])

    with patch("src.enrichment.OpenAI") as MockOpenAI:
        client = MockOpenAI.return_value
        client.responses.create.side_effect = [first_response, second_response]

        result = enrich(
            "AI adoption text", config,
            notion=mock_notion, rvf_search=mock_rvf,
        )

    assert result is not None
    assert result.summary == "Enterprise AI trends report."
    # rvf_search is called by prefetch (2 calls) + tool dispatch (1 call)
    assert mock_rvf.call_count == 3
    mock_rvf.assert_any_call("enterprise AI adoption", k=5)


def test_enrich_search_rvf_without_callback():
    """Test that search_rvf returns error when no rvf_search callback is provided."""
    # Round 1: model calls search_rvf (but no callback)
    fc = _mock_function_call("call_rvf", "search_rvf", {"query": "test"})
    first_response = _mock_tool_response([fc])

    # Round 2: model returns final JSON
    second_response = _mock_text_response({
        "summary": "Fallback.",
        "insights": ["Insight"],
        "content_type": "Other",
        "ai_primitives": [],
        "vendor": None,
        "topical_tags": [],
        "domain_tags": [],
        "client_relevance": [],
    })

    config = OpenAIConfig(api_key="sk-test", model="gpt-5.3-codex")
    mock_notion = MagicMock()

    with patch("src.enrichment.OpenAI") as MockOpenAI:
        client = MockOpenAI.return_value
        client.responses.create.side_effect = [first_response, second_response]

        result = enrich("Text", config, notion=mock_notion, rvf_search=None)

    assert result is not None
    assert result.summary == "Fallback."


def test_enrich_max_iterations():
    """Verify None is returned when the model keeps calling tools beyond max_iterations."""
    fc = _mock_function_call("call_loop", "search_notion", {"query": "infinite"})
    looping_response = _mock_tool_response([fc])

    config = OpenAIConfig(api_key="sk-test", model="gpt-5.3-codex")
    mock_notion = MagicMock()
    mock_notion.search_workspace.return_value = []

    with patch("src.enrichment.OpenAI") as MockOpenAI:
        client = MockOpenAI.return_value
        client.responses.create.return_value = looping_response

        result = enrich("Some text", config, notion=mock_notion, max_iterations=3)

    assert result is None


def test_enrich_tool_error_handled():
    """Verify that a tool execution error is passed back gracefully."""
    # Round 1: model calls fetch_notion_page
    fc = _mock_function_call("call_err", "fetch_notion_page", {"page_id": "bad-id"})
    first_response = _mock_tool_response([fc])

    # Round 2: model produces final JSON despite the error
    second_response = _mock_text_response({
        "summary": "Fallback summary.",
        "insights": ["Insight"],
        "content_type": "Other",
        "ai_primitives": [],
        "vendor": None,
        "topical_tags": ["test"],
        "domain_tags": ["AI/ML"],
        "client_relevance": [],
    })

    config = OpenAIConfig(api_key="sk-test", model="gpt-5.3-codex")
    mock_notion = MagicMock()
    mock_notion.fetch_page_content.side_effect = RuntimeError("Page not found")

    with patch("src.enrichment.OpenAI") as MockOpenAI:
        client = MockOpenAI.return_value
        client.responses.create.side_effect = [first_response, second_response]

        result = enrich("Some text", config, notion=mock_notion)

    assert result is not None
    assert result.summary == "Fallback summary."
    assert result.client_relevance == []


# ---------------------------------------------------------------------------
# Real integration tests (require .env credentials)
# ---------------------------------------------------------------------------

_has_notion_token = bool(os.getenv("NOTION_TOKEN"))
_has_openai_key = bool(os.getenv("OPENAI_API_KEY"))

skip_no_notion = pytest.mark.skipif(
    not _has_notion_token, reason="NOTION_TOKEN not set"
)
skip_no_openai = pytest.mark.skipif(
    not _has_openai_key, reason="OPENAI_API_KEY not set"
)
skip_no_credentials = pytest.mark.skipif(
    not (_has_notion_token and _has_openai_key),
    reason="NOTION_TOKEN and/or OPENAI_API_KEY not set",
)


def _real_notion_client():
    """Create a real NotionClient from environment variables."""
    from src.notion_client import NotionClient
    cfg = NotionConfig.from_env()
    return NotionClient(cfg)


@skip_no_notion
def test_real_notion_search_workspace():
    """Search workspace — results depend on pages shared with the integration."""
    notion = _real_notion_client()
    results = notion.search_workspace("CapitalSpring")
    assert isinstance(results, list)
    print(f"Found {len(results)} results for 'CapitalSpring'")
    if results:
        first = results[0]
        assert "page_id" in first
        assert "title" in first
        for r in results:
            print(f"  - {r['title']} ({r['page_id']})")
    else:
        # Empty is OK if no pages have been shared with the integration token.
        # To fix: share pages with the integration in Notion settings.
        print("  (no results — share pages with the Notion integration to enable)")


@skip_no_notion
def test_real_notion_fetch_page_content():
    """Fetch page content — skips if no searchable pages."""
    notion = _real_notion_client()
    results = notion.search_workspace("CapitalSpring")
    if not results:
        pytest.skip("No pages accessible to integration token — share pages in Notion")
    page_id = results[0]["page_id"]
    content = notion.fetch_page_content(page_id)
    assert isinstance(content, str)
    assert len(content) <= 4000
    print(f"Fetched {len(content)} chars from page {page_id}:")
    print(content[:500])


@skip_no_credentials
def test_real_codex_enrich_with_tools():
    notion = _real_notion_client()
    config = OpenAIConfig.from_env()

    text = (
        "AI Adoption in Private Equity Portfolio Companies\n\n"
        "This report examines how PE-backed firms are deploying large language "
        "models and AI workflow automation across their portfolio. Key findings "
        "include a 40% increase in AI tool adoption among mid-market portfolio "
        "companies, with notable traction in professional services and financial "
        "operations. The study highlights best practices for AI readiness "
        "assessments, champion programs, and measuring adoption ROI. Firms like "
        "CapitalSpring and similar PE-focused organizations are leading the "
        "charge in embedding AI enablement into their value creation playbooks."
    )

    result = enrich(text, config, notion=notion)

    assert result is not None, "Enrichment should return a result"
    assert result.summary, "Summary should be non-empty"
    assert len(result.insights) > 0, "Should have at least one insight"
    # Note: client_relevance depends on Notion pages being shared with the
    # integration token. If the workspace has no accessible pages, the model
    # may still return an empty list — which is correct behavior.
    print("\n=== Full Enrichment Result ===")
    print(f"Summary: {result.summary}")
    print(f"Insights: {result.insights}")
    print(f"Content type: {result.content_type}")
    print(f"AI primitives: {result.ai_primitives}")
    print(f"Vendor: {result.vendor}")
    print(f"Topical tags: {result.topical_tags}")
    print(f"Domain tags: {result.domain_tags}")
    print(f"Client relevance: {result.client_relevance}")


@skip_no_credentials
def test_real_codex_no_tools_fallback():
    config = OpenAIConfig.from_env()

    text = (
        "Generic document about cloud computing trends and enterprise "
        "software adoption in 2025."
    )

    result = enrich(text, config, notion=None)

    assert result is not None, "Single-shot enrichment should still work"
    assert result.summary, "Summary should be non-empty"
    assert result.client_relevance == [], (
        "Without Notion tools, client_relevance should be empty"
    )
    print(f"\nFallback result summary: {result.summary}")


# ---------------------------------------------------------------------------
# Retry
# ---------------------------------------------------------------------------

def test_retry_succeeds_first_try():
    calls = []
    def fn():
        calls.append(1)
        return "ok"
    assert retry_on_transient(fn) == "ok"
    assert len(calls) == 1


@patch("src.retry.time.sleep")
def test_retry_recovers_from_transient(mock_sleep):
    from openai import RateLimitError
    call_count = 0
    def fn():
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            raise RateLimitError(
                message="rate limit",
                response=MagicMock(status_code=429, headers={}),
                body=None,
            )
        return "recovered"
    assert retry_on_transient(fn) == "recovered"
    assert call_count == 2
    mock_sleep.assert_called_once_with(2)  # first backoff


def test_retry_non_transient_propagates():
    def fn():
        raise ValueError("bad input")
    with pytest.raises(ValueError, match="bad input"):
        retry_on_transient(fn)


@patch("src.retry.time.sleep")
def test_retry_exhaustion_raises(mock_sleep):
    from openai import RateLimitError
    def fn():
        raise RateLimitError(
            message="rate limit",
            response=MagicMock(status_code=429, headers={}),
            body=None,
        )
    with pytest.raises(RateLimitError):
        retry_on_transient(fn)
    assert mock_sleep.call_count == 3  # 3 sleeps before final raise


# ---------------------------------------------------------------------------
# Duplicate filename filtering
# ---------------------------------------------------------------------------

def test_duplicate_filename_detected():
    assert Pipeline._is_duplicate("report (1).pdf") is True
    assert Pipeline._is_duplicate("doc (2).pdf") is True
    assert Pipeline._is_duplicate("file (12).pdf") is True


def test_normal_filename_not_filtered():
    assert Pipeline._is_duplicate("report.pdf") is False
    assert Pipeline._is_duplicate("my (cool) report.pdf") is False
    assert Pipeline._is_duplicate("section (1) overview.pdf") is False


# ---------------------------------------------------------------------------
# Re-enrichment helpers
# ---------------------------------------------------------------------------

def test_drive_file_id_extraction():
    assert Pipeline._drive_file_id(
        "https://drive.google.com/file/d/1ABC_def-123/view?usp=sharing"
    ) == "1ABC_def-123"
    assert Pipeline._drive_file_id(
        "https://drive.google.com/file/d/xyz/view"
    ) == "xyz"
    assert Pipeline._drive_file_id(None) is None
    assert Pipeline._drive_file_id("https://example.com/no-match") is None


def test_clear_blocks():
    mock_client = MagicMock()
    mock_client.blocks.children.list.return_value = {
        "results": [
            {"id": "block-1"},
            {"id": "block-2"},
            {"id": "block-3"},
        ]
    }
    from src.notion_client import NotionClient
    notion = NotionClient.__new__(NotionClient)
    notion.client = mock_client
    notion.clear_blocks("page-123")
    assert mock_client.blocks.delete.call_count == 3
    mock_client.blocks.delete.assert_any_call(block_id="block-1")
    mock_client.blocks.delete.assert_any_call(block_id="block-2")
    mock_client.blocks.delete.assert_any_call(block_id="block-3")
