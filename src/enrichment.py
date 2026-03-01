"""AI enrichment: single OpenAI call with structured output."""
import json
import logging
from typing import Optional

from openai import OpenAI

from .config import OpenAIConfig
from .models import EnrichmentResult

log = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a knowledge-base analyst. Given the extracted text of a PDF document,
produce a JSON object with exactly these keys:

- "summary": A concise 2-4 sentence executive summary.
- "insights": A list of 3-5 key insights or takeaways (strings).
- "content_type": One of: "Research Paper", "Industry Report", "Technical Documentation",
  "Business Strategy", "News Article", "Legal Document", "Tutorial", "Other".
- "ai_primitives": List of AI-related concepts mentioned (e.g. "LLM", "RAG",
  "Fine-tuning", "Embeddings"). Empty list if none.
- "vendor": The primary company or vendor discussed, or null if none.
- "topical_tags": 3-6 topical tags describing the subject matter.
- "domain_tags": 1-3 broad domain tags (e.g. "AI/ML", "Finance", "Healthcare").

Return ONLY valid JSON, no markdown fences.
"""


def enrich(text: str, config: OpenAIConfig) -> Optional[EnrichmentResult]:
    """Run a single OpenAI call to enrich extracted PDF text.

    Returns an EnrichmentResult or None on failure.
    """
    # Truncate very long documents to stay within context limits
    max_chars = 80_000
    if len(text) > max_chars:
        text = text[:max_chars] + "\n\n[...truncated]"

    client = OpenAI(api_key=config.api_key)

    try:
        response = client.chat.completions.create(
            model=config.model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            temperature=0.2,
        )
        raw = response.choices[0].message.content
        data = json.loads(raw)

        return EnrichmentResult(
            summary=data.get("summary", ""),
            insights=data.get("insights", []),
            content_type=data.get("content_type", "Other"),
            ai_primitives=data.get("ai_primitives", []),
            vendor=data.get("vendor"),
            topical_tags=data.get("topical_tags", []),
            domain_tags=data.get("domain_tags", []),
        )
    except Exception as e:
        log.error("Enrichment failed: %s", e)
        return None
