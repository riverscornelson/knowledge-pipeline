"""AI enrichment: agentic OpenAI loop with Notion tool-use via Responses API."""
import json
import logging
from typing import Any, Callable, Dict, List, Optional

from openai import OpenAI

from .config import OpenAIConfig
from .models import EnrichmentResult

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Tool definitions for OpenAI Responses API function calling
# ---------------------------------------------------------------------------

NOTION_TOOLS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "name": "list_clients",
        "description": (
            "List all Cornelson Advisory clients with their industry, "
            "status, and relationship notes. Call this to understand the "
            "client roster before assessing client relevance."
        ),
        "parameters": {"type": "object", "properties": {}},
    },
    {
        "type": "function",
        "name": "search_notion",
        "description": (
            "Search the Cornelson Advisory Notion workspace for pages "
            "matching a query. Use this to find projects, "
            "engagement notes, or internal research that may be relevant "
            "to the document being analyzed."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query (e.g. client name, project, topic).",
                }
            },
            "required": ["query"],
        },
    },
    {
        "type": "function",
        "name": "fetch_notion_page",
        "description": (
            "Fetch the plain-text content of a Notion page by its ID. "
            "Use this after search_notion to read details about a client "
            "engagement, project brief, or research note."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "page_id": {
                    "type": "string",
                    "description": "The Notion page ID returned by search_notion.",
                }
            },
            "required": ["page_id"],
        },
    },
    {
        "type": "function",
        "name": "search_rvf",
        "description": (
            "Semantic vector search over the Cornelson Advisory knowledge base. "
            "Unlike search_notion (keyword-based), this finds content by meaning "
            "using 384-dim embeddings. Returns the most semantically similar "
            "chunks with their source page title, database, URL, and text. "
            "Use this to find related analysis, prior research, or thematically "
            "similar content that may not share exact keywords."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Natural language query (e.g. 'enterprise AI adoption in PE').",
                },
                "k": {
                    "type": "integer",
                    "description": "Number of results to return (default 5, max 10).",
                },
            },
            "required": ["query"],
        },
    },
]

# ---------------------------------------------------------------------------
# System prompt (with tool-use + client_relevance instructions)
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are the knowledge-base analyst for Cornelson Advisory, a firm that helps
management teams turn AI tool access into measurable AI adoption. The firm's
core services are:

- AI Clarity Workshops (1-2 day leadership AI literacy and use-case prioritization)
- AI Workflow Sprints (2-6 week pilot builds with adoption measurement)
- Fractional AI Enablement Lead (ongoing embedded advisory, office hours,
  champion programs, quarterly roadmap refreshes)

The firm is vendor-agnostic (ChatGPT, Claude, Gemini, Copilot, open-source),
security-first, and focused on knowledge workers, management teams, and
enablement leaders in professional services, private equity portfolio companies,
and mid-market organizations.

You have access to the Cornelson Advisory Notion workspace via four tools:
- list_clients: List all clients with their industry, status, and notes.
- search_notion: Keyword search for projects, engagements, or research.
- fetch_notion_page: Read the content of a specific Notion page.
- search_rvf: Semantic vector search over the full knowledge base. Use this
  to find thematically similar prior analysis, related research, or content
  that shares meaning but not necessarily keywords.

When analyzing a document, you MUST ALWAYS call list_clients first to see the
full client roster before producing client_relevance. For each client, review
their industry, engagement context, and notes. Connect the document to clients
where the content could inform a workshop, shape an engagement, or surface a
relevant trend. Provide brief reasoning for each match.

You may also use search_notion, search_rvf, and fetch_notion_page for deeper
investigation into specific clients or topics found during your analysis.
Prefer search_rvf when looking for thematically related content across the
knowledge base.

Given the extracted text of a PDF document, produce a JSON object with exactly
these keys:

- "summary": A 2-4 sentence executive summary written for Rivers Cornelson.
  Highlight what matters for an AI enablement advisory practice — adoption
  trends, enterprise rollout lessons, workflow automation opportunities,
  competitive landscape shifts, or client-relevant industry developments.
- "insights": 3-5 key insights framed as actionable takeaways for the firm.
  Examples: how a finding could shape a client workshop, inform a champion
  program, or surface a new engagement opportunity.
- "content_type": One of: "Research Paper", "Industry Report",
  "Technical Documentation", "Business Strategy", "News Article",
  "Legal Document", "Tutorial", "Other".
- "ai_primitives": List from this controlled list ONLY:
  "LLM", "RAG", "Fine-tuning", "Embeddings", "Agents", "MCP",
  "Computer Vision", "NLP", "Speech", "Multimodal", "Reasoning",
  "Code Generation", "Function Calling", "Prompt Engineering",
  "RLHF", "Diffusion Models", "Transformers", "Knowledge Graphs",
  "Vector Search", "Guardrails", "Evaluation", "Distillation",
  "Quantization", "Retrieval", "Summarization", "Classification",
  "OCR", "Chatbot", "Copilot", "Search", "Recommendations".
  Empty list if none. Do NOT invent new primitives outside this list.
- "vendor": The primary company or vendor discussed, or null if none.
- "topical_tags": 3-6 tags from this controlled list ONLY:
  "AI Strategy", "AI Adoption", "AI Governance", "AI Ethics",
  "AI Regulation", "AI Safety", "AI Agents", "AI Assistants",
  "AI Search", "AI Infrastructure", "AI Benchmarks", "AI Startups",
  "Enterprise AI", "Generative AI", "Conversational AI", "Multimodal AI",
  "Prompt Engineering", "Workflow Automation", "Change Management",
  "Digital Transformation", "Workforce Development", "Productivity",
  "Knowledge Management", "Data Strategy", "Cybersecurity",
  "Product Management", "Software Development", "Open Source",
  "Vendor Landscape", "Model Evaluation", "Cost Optimization",
  "Leadership", "Consulting", "Training & Enablement",
  "Use Case Design", "ROI & Measurement", "Industry Trends",
  "Research & Analysis", "Content Creation", "Customer Experience",
  "Supply Chain", "Healthcare", "Legal", "Finance", "Education",
  "Private Equity", "Professional Services".
  Do NOT invent new tags outside this list.
- "domain_tags": 1-3 broad domain tags from this list ONLY:
  "AI/ML", "Finance", "Healthcare", "Legal", "Education",
  "Professional Services", "Private Equity", "Technology",
  "Manufacturing", "Energy", "Retail", "Media & Entertainment",
  "Government", "Real Estate", "Telecommunications".
  Do NOT invent new domain tags outside this list.
- "title": A clean, descriptive title for this document (like an article
  headline). Do not include file extensions or upload artifacts.
- "created_date": The date this document was originally created or published,
  in ISO 8601 format (YYYY-MM-DD). Infer this from dates in the content such
  as publication dates, report dates, copyright notices, headers/footers, or
  the most prominent date referenced. If you cannot determine a date with
  reasonable confidence, return null.
- "client_relevance": A list of strings connecting this document to specific
  Cornelson Advisory clients or engagements found in the Notion workspace.
  Each entry should follow the format:
  "ClientName — Engagement: How this document relates."
  If no relevant clients are found, return an empty list.

Return ONLY valid JSON, no markdown fences.
"""


def _execute_tool(
    tool_name: str,
    arguments: Dict[str, Any],
    notion: Any,
    rvf_search: Optional[Callable[..., List[Dict[str, Any]]]] = None,
) -> str:
    """Dispatch a tool call to the appropriate handler."""
    try:
        if tool_name == "list_clients":
            results = notion.list_clients()
            return json.dumps(results)
        elif tool_name == "search_notion":
            results = notion.search_workspace(arguments["query"])
            return json.dumps(results)
        elif tool_name == "fetch_notion_page":
            content = notion.fetch_page_content(arguments["page_id"])
            return json.dumps({"content": content})
        elif tool_name == "search_rvf":
            if rvf_search is None:
                return json.dumps({"error": "RVF knowledge base not available"})
            k = min(arguments.get("k", 5), 10)
            results = rvf_search(arguments["query"], k=k)
            return json.dumps(results)
        else:
            return json.dumps({"error": f"Unknown tool: {tool_name}"})
    except Exception as e:
        log.warning("Tool %s failed: %s", tool_name, e)
        return json.dumps({"error": str(e)})


def enrich(
    text: str,
    config: OpenAIConfig,
    notion: Any = None,
    rvf_search: Optional[Callable[..., List[Dict[str, Any]]]] = None,
    max_iterations: Optional[int] = None,
) -> Optional[EnrichmentResult]:
    """Run an agentic OpenAI Responses API loop to enrich extracted PDF text.

    When notion is provided, the model can call search_notion and
    fetch_notion_page tools to query the Cornelson Advisory workspace.
    When rvf_search is provided, the model can also call search_rvf for
    semantic vector search over the knowledge base.
    When notion is None, falls back to a single-shot call (no tools).

    Returns an EnrichmentResult or None on failure.
    """
    if max_iterations is None:
        max_iterations = config.max_tool_iterations

    # Truncate very long documents to stay within context limits
    max_chars = 80_000
    if len(text) > max_chars:
        text = text[:max_chars] + "\n\n[...truncated]"

    client = OpenAI(api_key=config.api_key)

    # Build initial input for the Responses API
    # Note: include "json" in the user message to satisfy json_object format requirement
    input_items: List[Dict[str, Any]] = [
        {"role": "user", "content": f"Analyze this document and return your response as json:\n\n{text}"},
    ]

    # Only include tools if notion client is available
    use_tools = notion is not None

    try:
        for iteration in range(max_iterations):
            kwargs: Dict[str, Any] = {
                "model": config.model,
                "instructions": SYSTEM_PROMPT,
                "input": input_items,
                "temperature": 0.2,
            }
            if use_tools:
                kwargs["tools"] = NOTION_TOOLS
            if not use_tools:
                kwargs["text"] = {"format": {"type": "json_object"}}

            response = client.responses.create(**kwargs)

            # Separate function_call items from message items
            function_calls = [
                item for item in response.output
                if item.type == "function_call"
            ]

            if function_calls and notion is not None:
                # Append the model's output (including function_call items)
                # then append our function_call_output results
                for item in response.output:
                    if item.type == "function_call":
                        input_items.append({
                            "type": "function_call",
                            "call_id": item.call_id,
                            "name": item.name,
                            "arguments": item.arguments,
                        })
                        # Execute and append result
                        args = json.loads(item.arguments)
                        result_str = _execute_tool(
                            item.name, args, notion, rvf_search=rvf_search
                        )
                        input_items.append({
                            "type": "function_call_output",
                            "call_id": item.call_id,
                            "output": result_str,
                        })
                    elif item.type == "message":
                        # Append any interleaved message content too
                        input_items.append({
                            "role": "assistant",
                            "content": item.content[0].text if item.content else "",
                        })

                log.info(
                    "Enrichment iteration %d: %d tool call(s)",
                    iteration + 1,
                    len(function_calls),
                )
                continue

            # No tool calls — parse the final JSON response
            raw = response.output_text
            if not raw:
                log.error("Empty response from model on iteration %d", iteration + 1)
                return None

            data = json.loads(raw)
            return EnrichmentResult(
                summary=data.get("summary", ""),
                insights=data.get("insights", []),
                content_type=data.get("content_type", "Other"),
                ai_primitives=data.get("ai_primitives", []),
                vendor=data.get("vendor"),
                topical_tags=data.get("topical_tags", []),
                domain_tags=data.get("domain_tags", []),
                client_relevance=data.get("client_relevance", []),
                created_date=data.get("created_date"),
                title=data.get("title"),
            )

        # Exhausted max iterations without a final response
        log.error("Enrichment hit max iterations (%d) without completing", max_iterations)
        return None

    except Exception as e:
        log.error("Enrichment failed: %s", e)
        return None
