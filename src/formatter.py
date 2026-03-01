"""Convert an EnrichmentResult into Notion blocks."""
from typing import List, Dict, Any

from .models import EnrichmentResult

MAX_TEXT = 2000  # Notion rich-text character limit


def _rich_text(text: str) -> List[Dict[str, Any]]:
    """Create a rich_text array, chunking if text exceeds the Notion limit."""
    parts: List[Dict[str, Any]] = []
    for i in range(0, max(len(text), 1), MAX_TEXT):
        parts.append({"type": "text", "text": {"content": text[i : i + MAX_TEXT]}})
    return parts


def _heading(text: str, level: int = 2) -> Dict[str, Any]:
    key = f"heading_{level}"
    return {"type": key, key: {"rich_text": _rich_text(text)}}


def _paragraph(text: str) -> Dict[str, Any]:
    return {"type": "paragraph", "paragraph": {"rich_text": _rich_text(text)}}


def _bullet(text: str) -> Dict[str, Any]:
    return {
        "type": "bulleted_list_item",
        "bulleted_list_item": {"rich_text": _rich_text(text)},
    }


def _divider() -> Dict[str, Any]:
    return {"type": "divider", "divider": {}}


def format_blocks(result: EnrichmentResult) -> List[Dict[str, Any]]:
    """Build a list of Notion blocks from an EnrichmentResult."""
    blocks: List[Dict[str, Any]] = []

    # Summary
    blocks.append(_heading("Summary"))
    # Split summary into paragraphs at sentence boundaries (~3 sentences each)
    sentences = [s.strip() for s in result.summary.replace("\n", " ").split(". ") if s.strip()]
    chunk: List[str] = []
    for s in sentences:
        chunk.append(s if s.endswith(".") else s + ".")
        if len(chunk) >= 3:
            blocks.append(_paragraph(" ".join(chunk)))
            chunk = []
    if chunk:
        blocks.append(_paragraph(" ".join(chunk)))

    blocks.append(_divider())

    # Key Insights
    blocks.append(_heading("Key Insights"))
    for insight in result.insights:
        blocks.append(_bullet(insight))

    blocks.append(_divider())

    # Classification
    blocks.append(_heading("Classification"))
    blocks.append(_paragraph(f"Content type: {result.content_type}"))
    if result.vendor:
        blocks.append(_paragraph(f"Vendor: {result.vendor}"))
    if result.ai_primitives:
        blocks.append(_paragraph(f"AI primitives: {', '.join(result.ai_primitives)}"))

    blocks.append(_divider())

    # Tags
    blocks.append(_heading("Tags"))
    if result.topical_tags:
        blocks.append(_paragraph(f"Topical: {', '.join(result.topical_tags)}"))
    if result.domain_tags:
        blocks.append(_paragraph(f"Domain: {', '.join(result.domain_tags)}"))

    return blocks
