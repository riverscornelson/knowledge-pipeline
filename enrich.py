"""
enrich.py  – Drive PDF ➜ Notion enrichment
  • Summary (≈250 words) with GPT-4.1
  • Classification with GPT-4.1 (tool call)

ENV (.env)
  NOTION_TOKEN, NOTION_SOURCES_DB
  GOOGLE_APP_CREDENTIALS
  OPENAI_API_KEY
  MODEL_SUMMARY=gpt-4.1
  MODEL_CLASSIFIER=gpt-4.1
"""
import os, io, json, time
from dotenv import load_dotenv
from notion_client import Client as Notion
from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials
from googleapiclient.http import MediaIoBaseDownload
from pdfminer.high_level import extract_text
from tenacity import retry, wait_exponential, stop_after_attempt
from openai import OpenAI, APIError, RateLimitError
import openai
from postprocess import post_process_page
from infer_vendor import infer_vendor_name

# ── init ──────────────────────────────────────────────
load_dotenv()
NOTION_DB        = os.getenv("NOTION_SOURCES_DB")
MODEL_SUMMARY    = os.getenv("MODEL_SUMMARY",    "gpt-4.1")
MODEL_CLASSIFIER = os.getenv("MODEL_CLASSIFIER", "gpt-4.1")

notion = Notion(auth=os.getenv("NOTION_TOKEN"))
oai    = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

HAS_RESPONSES = hasattr(oai, "responses")

def _chat_create(**kwargs):
    """Compatibility wrapper for ChatCompletion calls."""
    if hasattr(oai, "chat"):
        return oai.chat.completions.create(**kwargs)
    # Fallback for very old openai versions
    openai.api_key = os.getenv("OPENAI_API_KEY")
    return openai.ChatCompletion.create(**kwargs)

drive = build(
    "drive", "v3",
    credentials=Credentials.from_service_account_file(os.getenv("GOOGLE_APP_CREDENTIALS")),
    cache_discovery=False
)

# ── helpers ───────────────────────────────────────────

MAX_CHUNK = 1900                    # Notion limit per text object

def add_fulltext_blocks(page_id: str, full_text: str):
    """Append the extracted text as a toggle block containing paragraph chunks."""
    chunks = [full_text[i:i+MAX_CHUNK] for i in range(0, len(full_text), MAX_CHUNK)]
    # limit to first 25 chunks (≈50k) – adjust as you wish
    chunks = chunks[:25]

    children = [
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [
                    {"type": "text", "text": {"content": chunk}}
                ]
            },
        }
        for chunk in chunks
    ]

    block = {
        "object": "block",
        "type": "toggle",
        "toggle": {
            "rich_text": [{"type": "text", "text": {"content": "Raw"}}],
            "children": children,
        },
    }

    notion.blocks.children.append(page_id, children=[block])


def add_summary_block(page_id: str, summary: str):
    """Append a toggle block containing the provided summary."""
    block = {
        "object": "block",
        "type": "toggle",
        "toggle": {
            "rich_text": [{"type": "text", "text": {"content": "Summary"}}],
            "children": [
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [
                            {
                                "type": "text",
                                "text": {"content": summary[:MAX_CHUNK]}
                            }
                        ]
                    },
                }
            ],
        },
    }

    notion.blocks.children.append(page_id, children=[block])


def inbox_rows(require_url: str | None = None):
    """Return all rows in the Inbox, optionally ensuring a URL property is set."""
    base_filter = {"property": "Status", "select": {"equals": "Inbox"}}
    if require_url:
        filter_ = {"and": [base_filter,
                              {"property": require_url,
                               "url": {"is_not_empty": True}}]}
    else:
        filter_ = base_filter

    results = []
    kwargs = dict(database_id=NOTION_DB, filter=filter_, page_size=100)
    while True:
        resp = notion.databases.query(**kwargs)
        results.extend(resp["results"])
        if not resp.get("has_more"):
            break
        kwargs["start_cursor"] = resp["next_cursor"]
    return results

def drive_id(url: str) -> str:
    """Extract the file ID from a Google Drive share URL."""
    try:
        return url.split("/d/")[1].split("/")[0]
    except Exception:
        raise ValueError(f"invalid Drive URL: {url}")

def download_pdf(fid: str) -> bytes:
    buf = io.BytesIO()
    MediaIoBaseDownload(buf, drive.files().get_media(fileId=fid)).next_chunk()
    return buf.getvalue()

@retry(wait=wait_exponential(2, 30), stop=stop_after_attempt(5),
       retry=lambda e: isinstance(e, (APIError, RateLimitError)))
def summarise(text: str) -> str:
    """Summarise text using the Responses API."""
    text = text[:10000000000]
    instructions = (
        "Summarise the following document in no more than 175 words, markdown. "
        "Focus on relevant takeaways for AI use in business."
    )
    if HAS_RESPONSES:
        resp = oai.responses.create(
            model=MODEL_SUMMARY,
            instructions=instructions,
            input=text,
            max_output_tokens=1000,
        )
        out = resp.output[0]
        return out.content[0].text.strip()
    else:
        resp = _chat_create(
            model=MODEL_SUMMARY,
            messages=[{"role": "system", "content": instructions},
                      {"role": "user", "content": text}],
            max_tokens=1000,
        )
        return resp.choices[0].message.content.strip()

@retry(wait=wait_exponential(2, 30), stop=stop_after_attempt(5),
       retry=lambda e: isinstance(e, (APIError, RateLimitError)))
def summarise_exec(text: str) -> str:
    """Return a five-sentence executive summary using the Responses API."""
    text = text[:10000000000]
    instructions = (
        "Summarise the following document in five sentences for an "
        "executive audience. Focus on relevant takeaways for AI use in business."
    )
    if HAS_RESPONSES:
        resp = oai.responses.create(
            model=MODEL_SUMMARY,
            instructions=instructions,
            input=text,
            max_output_tokens=1000,
        )
        out = resp.output[0]
        return out.content[0].text.strip()
    else:
        resp = _chat_create(
            model=MODEL_SUMMARY,
            messages=[{"role": "system", "content": instructions},
                      {"role": "user", "content": text}],
            max_tokens=1000,
        )
        return resp.choices[0].message.content.strip()

@retry(wait=wait_exponential(2, 30), stop=stop_after_attempt(5),
       retry=lambda e: isinstance(e, (APIError, RateLimitError)))
def classify(text: str) -> tuple[str, str]:
    schema = {
        "name": "classify",
        "description": "Return the content_type and ai_primitive for the text.",
        "parameters": {
            "type": "object",
            "properties": {
                "content_type": {
                    "type": "string",
                    "enum": [
                        "Market News", "Thought Leadership", "Personal Note",
                        "Vendor Capability", "Client Deliverable"
                    ]
                },
                "ai_primitive": {
                    "type": "string",
                    "enum": [
                        "Content Creation", "Research", "Coding",
                        "Data Analysis", "Ideation/Strategy", "Automation"
                    ]
                }
            },
            "required": ["content_type", "ai_primitive"]
        }
    }
    instructions = (
        "Classify the document using ONLY the enum values. If unsure pick the closest match."
    )
    if HAS_RESPONSES:
        # The Responses API expects the tool name at the top level rather than
        # nested inside the ``function`` object.  Older client versions throw
        # a ``tools[0].name`` error if this field is missing.
        tool = {
            "name": schema["name"],
            "type": "function",
            "description": schema["description"],
            "parameters": schema["parameters"],
        }
        resp = oai.responses.create(
            model=MODEL_CLASSIFIER,
            tools=[tool],
            tool_choice={"name": "classify"},
            instructions=instructions,
            input=text[:600000],
            max_output_tokens=60,
        )
        out = resp.output[0]
        tc = getattr(out, "tool_calls", None)
    else:
        if hasattr(oai, "chat"):
            resp = _chat_create(
                model=MODEL_CLASSIFIER,
                messages=[{"role": "system", "content": instructions},
                          {"role": "user", "content": text[:600000]}],
                tools=[{"type": "function", "function": schema}],
                tool_choice={"type": "function", "function": {"name": "classify"}},
                max_tokens=60,
            )
            tc = resp.choices[0].message.tool_calls
            if not tc:
                raise ValueError("GPT-4.1 did not return a tool call")
            args = json.loads(tc[0].function.arguments)
        else:
            resp = _chat_create(
                model=MODEL_CLASSIFIER,
                messages=[{"role": "system", "content": instructions},
                          {"role": "user", "content": text[:600000]}],
                functions=[schema],
                function_call={"name": "classify"},
                max_tokens=60,
            )
            fc = resp["choices"][0]["message"].get("function_call")
            if not fc:
                raise ValueError("GPT-4.1 did not return a function call")
            args = json.loads(fc["arguments"])

    # ─ enum validation / coercion
    allowed_ct = {"Market News","Thought Leadership","Personal Note",
                  "Vendor Capability","Client Deliverable"}
    allowed_ap = {"Content Creation","Research","Coding",
                  "Data Analysis","Ideation/Strategy","Automation"}

    if args["content_type"] not in allowed_ct:
        print("   ⚠️  Invalid content_type ->", args["content_type"])
        args["content_type"] = "Thought Leadership"
    if args["ai_primitive"] not in allowed_ap:
        print("   ⚠️  Invalid ai_primitive ->", args["ai_primitive"])
        args["ai_primitive"] = "Research"

    return args["content_type"], args["ai_primitive"]

def notion_update(pid, status, summary=None, ctype=None, prim=None, vendor=None):
    """Update a Notion page status and optional five-sentence summary."""
    props = {"Status": {"select": {"name": status}}}

    if summary is not None:
        content = summary.strip() or "⚠️ summary empty"
        props["Summary"] = {
            "rich_text": [{"type": "text", "text": {"content": content[:1950]}}]
        }
    if ctype:
        props["Content-Type"] = {"select": {"name": ctype}}
    if prim:
        props["AI-Primitive"] = {"multi_select": [{"name": prim}]}
    if vendor:
        props["Vendor"] = {"select": {"name": vendor}}

    notion.pages.update(pid, properties=props)

# ── main ────────────────────────────────────────────────
def main():
    rows = inbox_rows(require_url="Drive URL")
    if not rows:
        print("🚩 Nothing in Inbox."); return
    print(f"🔍 Found {len(rows)} row(s) to enrich\n")

    for row in rows:
        title = row["properties"]["Title"]["title"][0]["plain_text"]
        print(f"➡️  {title}")

        drive_prop = row["properties"].get("Drive URL")
        url = drive_prop.get("url") if drive_prop else None

        try:
            fid = drive_id(url)
            print("   • Downloading …")

            pdf_text = extract_text(io.BytesIO(download_pdf(fid)))

            print("   • Summarising with GPT-4.1 …")
            detail = summarise(pdf_text)
            add_summary_block(row["id"], detail)

            add_fulltext_blocks(row["id"], pdf_text)

            print("     ↳ extracted chars:", len(pdf_text))

            if not pdf_text.strip():
                raise ValueError("empty text after extraction")

            print("   • Summarising with GPT-4.1 (exec) …")
            summary = summarise_exec(pdf_text)
            print("     ↳ exec summary chars:", len(summary))

            print("   • Classifying with GPT-4.1 …")
            ctype, prim = classify(pdf_text)
            print(f"     ↳ {ctype}  /  {prim}")

            vendor = None
            vend_prop = row["properties"].get("Vendor", {})
            if not vend_prop.get("select"):
                print("   • Inferring vendor …")
                try:
                    vendor = infer_vendor_name(summary or pdf_text)
                    if vendor == "Unknown":
                        print("     ↳ Vendor: Unknown")
                        vendor = None
                    else:
                        print(f"     ↳ Vendor: {vendor}")
                except Exception as exc:
                    print(f"     ⚠️ Vendor inference error: {exc}")

            print("   • Post-processing …")
            post_process_page(row["id"], pdf_text)

            notion_update(row["id"], "Enriched", summary, ctype, prim, vendor)
            print("✅ Updated row → Enriched\n")

        except Exception as err:
            print("❌", err, "\n")
            notion_update(row["id"], "Failed")
        time.sleep(0.3)

if __name__ == "__main__":
    main()
