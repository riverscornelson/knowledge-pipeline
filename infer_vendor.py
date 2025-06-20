"""
infer_vendor.py – fill blank Vendor fields using an LLM.

ENV (.env)
  NOTION_TOKEN, NOTION_SOURCES_DB
  OPENAI_API_KEY
  GOOGLE_APP_CREDENTIALS (optional for Drive PDFs)
  MODEL_VENDOR=gpt-4.1
"""
import os, io, re, html, time, argparse, urllib.request
from urllib.error import URLError
from dotenv import load_dotenv
from notion_client import Client as Notion
from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials
from googleapiclient.http import MediaIoBaseDownload
from pdfminer.high_level import extract_text
from tenacity import retry, wait_exponential, stop_after_attempt
from openai import OpenAI, APIError, RateLimitError
import openai

load_dotenv()

NOTION_DB     = os.getenv("NOTION_SOURCES_DB")
MODEL_VENDOR  = os.getenv("MODEL_VENDOR", "gpt-4.1")

notion = Notion(auth=os.getenv("NOTION_TOKEN"))
oai    = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

HAS_RESPONSES = hasattr(oai, "responses")

# Vendor names that may be assigned to a page. Any other value returned by
# the model will be treated as "Unknown".
ALLOWED_VENDORS = {
    "openai": "OpenAI",
    "anthropic": "Anthropic",
    "google": "Google",
    "meta": "Meta",
    "x ai": "X AI",
    "deepseek": "DeepSeek",
}


def _chat_create(**kwargs):
    if hasattr(oai, "chat"):
        return oai.chat.completions.create(**kwargs)
    openai.api_key = os.getenv("OPENAI_API_KEY")
    return openai.ChatCompletion.create(**kwargs)


def _drive_client():
    cred_path = os.getenv("GOOGLE_APP_CREDENTIALS")
    if not cred_path:
        return None
    return build(
        "drive", "v3",
        credentials=Credentials.from_service_account_file(cred_path),
        cache_discovery=False,
    )


def drive_id(url: str) -> str:
    try:
        return url.split("/d/")[1].split("/")[0]
    except Exception:
        raise ValueError(f"invalid Drive URL: {url}")


def download_pdf(drive, fid: str) -> bytes:
    """Return the full binary contents of a Drive file."""
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, drive.files().get_media(fileId=fid))
    done = False
    while not done:
        status, done = downloader.next_chunk()
    return buf.getvalue()


def fetch_article_text(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120 Safari/537.36"
            )
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = resp.read().decode("utf-8", "ignore")
    except URLError as exc:
        raise RuntimeError(f"failed to fetch {url}: {exc}")
    data = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", data, flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", data)
    text = html.unescape(text)
    return " ".join(text.split())


@retry(wait=wait_exponential(2, 30), stop=stop_after_attempt(5),
       retry=lambda e: isinstance(e, (APIError, RateLimitError)))
def infer_vendor_name(text: str) -> str:
    """Infer a vendor from text, limited to a predefined set of names."""
    prompt = (
        "Based on the following text, what is the most relevant vendor, company, or publisher mentioned? "
        "Choose from OpenAI, Anthropic, Google, Meta, X AI, DeepSeek. If none or unclear, return 'Unknown'."
    )
    text = text[:6000]
    if HAS_RESPONSES:
        resp = oai.responses.create(
            model=MODEL_VENDOR,
            instructions=prompt,
            input=text,
            max_output_tokens=60,
        )
        out = resp.output[0]
        answer = out.content[0].text.strip()
    else:
        resp = _chat_create(
            model=MODEL_VENDOR,
            messages=[{"role": "system", "content": prompt},
                      {"role": "user", "content": text}],
            max_tokens=60,
        )
        answer = resp.choices[0].message.content.strip()

    if not answer or answer.lower().startswith("unknown"):
        return "Unknown"
    answer = answer.splitlines()[0].strip().strip("'\"").rstrip(".")
    key = re.sub(r"\s+", " ", answer).lower()
    return ALLOWED_VENDORS.get(key, "Unknown")


def query_pages():
    flt = {
        "and": [
            {"property": "Vendor", "select": {"is_empty": True}},
            {
                "or": [
                    {"property": "Status", "select": {"equals": "Inbox"}},
                    {"property": "Status", "select": {"equals": "Enriched"}},
                ]
            },
        ]
    }
    results = []
    kwargs = dict(database_id=NOTION_DB, filter=flt, page_size=100)
    while True:
        resp = notion.databases.query(**kwargs)
        results.extend(resp["results"])
        if not resp.get("has_more"):
            break
        kwargs["start_cursor"] = resp["next_cursor"]
    return results


def main():
    ap = argparse.ArgumentParser(description="Fill blank Vendor fields")
    ap.add_argument("--dry-run", action="store_true", help="Preview changes")
    args = ap.parse_args()

    drive = _drive_client()

    rows = query_pages()
    if not rows:
        print("🚩 Nothing to update."); return
    print(f"🔍 Found {len(rows)} page(s)\n")

    for row in rows:
        title = row["properties"]["Title"]["title"][0]["plain_text"]
        print(f"➡️  {title}")
        text = ""
        summary_rich = row["properties"].get("Summary", {}).get("rich_text", [])
        if summary_rich:
            text = summary_rich[0].get("plain_text", "")
        else:
            art = row["properties"].get("Article URL")
            drive_prop = row["properties"].get("Drive URL")
            if art and art.get("url"):
                try:
                    print("   • Fetching article …")
                    text = fetch_article_text(art["url"])
                except Exception as exc:
                    print("   ⚠️", exc)
            elif drive_prop and drive_prop.get("url") and drive:
                try:
                    print("   • Downloading PDF …")
                    fid = drive_id(drive_prop["url"])
                    pdf_text = extract_text(io.BytesIO(download_pdf(drive, fid)))
                    text = pdf_text
                except Exception as exc:
                    print("   ⚠️", exc)
        if not text:
            print("   ⚠️  No text available\n")
            continue

        try:
            vendor = infer_vendor_name(text)
        except Exception as exc:
            print("   ⚠️  Vendor inference failed:", exc, "\n")
            continue

        if vendor == "Unknown":
            print("   ↳ Vendor: Unknown\n")
            continue
        print(f"   ↳ Vendor: {vendor}")
        if args.dry_run:
            print("   (dry run)\n")
            continue
        try:
            notion.pages.update(row["id"], properties={"Vendor": {"select": {"name": vendor}}})
            print("   ✓ Updated\n")
        except Exception as exc:
            print("   ⚠️  Failed to update:", exc, "\n")
        time.sleep(0.3)


if __name__ == "__main__":
    main()
