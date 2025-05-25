# Post-processing step applying additional enrichment prompts
import os
from dotenv import load_dotenv
from openai import OpenAI, APIError, RateLimitError
import openai
from notion_client import Client as Notion
from tenacity import retry, wait_exponential, stop_after_attempt

load_dotenv()
MODEL_POSTPROCESS = os.getenv("MODEL_POSTPROCESS", "gpt-4.1")
notion = Notion(auth=os.getenv("NOTION_TOKEN"))
oai = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

HAS_RESPONSES = hasattr(oai, "responses")

def _chat_create(**kwargs):
    if hasattr(oai, "chat"):
        return oai.chat.completions.create(**kwargs)
    openai.api_key = os.getenv("OPENAI_API_KEY")
    return openai.ChatCompletion.create(**kwargs)

MAX_CHUNK = 1900

POST_PROMPTS = [
    ("Executive Summary", "Please summarize the main points, critical insights, and any important data from the provided content. Use clear, concise language, and include up to three direct quotes that capture the essence of the material."),
    ("Bullet-Point Overview", "Summarize the core topics, arguments, and findings from the content in 5–7 bullet points. Keep each bullet concise and focused on a single idea."),
    ("Risks, Opportunities & Implications", "From the provided content, identify the top three risks, top three opportunities, and the main strategic implications. Organize your answer under the headings Risks, Opportunities, and Implications, with brief explanations for each point."),
    ("Market & Competitor Insights", "Analyze the content for references to market trends, competitor moves, or industry shifts. Summarize these insights under three headings: Market Trends, Competitor Actions, and Industry Shifts, with one or two sentences explaining each."),
    ("Thematic Tagging", "Extract the central themes, topics, and keywords from the content. Provide a list of 5–10 relevant tags that best represent these themes. Use single words or short phrases."),
    ("Audience Persona Identification", "Based on the content, identify 2–5 target audience personas who would benefit from or be interested in this material. For each persona, provide a brief description including their role or interest and why the content matters to them."),
    ("Social Media Post Generator", "Using key points and insights from the content, create three distinct social media posts. Each post should be catchy, under 280 characters, and include one relevant hashtag and a call-to-action or question for engagement."),
    ("Newsletter Digest Paragraph", "Write a brief, engaging summary of the content around 50–75 words as it would appear in a newsletter. It should capture the key insight and include a hook that encourages the reader to click through for full details."),
    ("Content Reformatting (Q&A Style)", "Convert the core information from the content into a Q&A format. Create 3–5 question-and-answer pairs that cover the who, what, when, where, why, or how of the main points. Keep questions clear and answers concise."),
    ("SWOT Analysis Highlights", "Identify any strengths, weaknesses, opportunities, and threats mentioned or implied in the content. List 2–3 bullet points under each category."),
    ("Action Items & Mitigation Plan", "List any problems or risks highlighted in the content, and for each, suggest one actionable step or mitigation. Present it as a clear pair so it’s easy to track and assign."),
    ("Metadata Extraction", "From the content, identify title, author, date, summary (under 50 words), and 5–7 keywords. Return JSON with fields 'title', 'author', 'date', 'summary', 'tags'. If any field is missing use null."),
    ("Relational Link Suggestions", "Based on the themes and topics in the content, suggest up to three related items (articles, reports, or database entries) that might be relevant. For each related item, provide a title and a short note on how it connects."),
    ("FAQs Generation", "Formulate 3–5 frequently asked questions that a reader of this content might have, and provide a concise answer for each."),
    ("Presentation or Video Outline", "Create a structured outline to present this content in a 10-minute talk or video. Divide the content into 4–5 sections and give 2–3 bullet points for each section that summarize what to convey."),
]

@retry(wait=wait_exponential(2, 30), stop=stop_after_attempt(5),
       retry=lambda e: isinstance(e, (APIError, RateLimitError)))
def _ask(prompt: str, text: str) -> str:
    if HAS_RESPONSES:
        resp = oai.responses.create(
            model=MODEL_POSTPROCESS,
            instructions=prompt,
            input=text,
            max_output_tokens=1000,
        )
        out = resp.output[0]
        return out.content[0].text.strip()
    else:
        resp = _chat_create(
            model=MODEL_POSTPROCESS,
            messages=[{"role": "system", "content": prompt},
                      {"role": "user", "content": text}],
            max_tokens=1000,
        )
        return resp.choices[0].message.content.strip()

def _append_toggle(page_id: str, title: str, content: str):
    block = {
        "object": "block",
        "type": "toggle",
        "toggle": {
            "rich_text": [{"type": "text", "text": {"content": title}}],
            "children": [
                {
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{"type": "text", "text": {"content": content[:MAX_CHUNK]}}]
                    },
                }
            ],
        },
    }
    notion.blocks.children.append(page_id, children=[block])

def post_process_page(page_id: str, text: str):
    for title, prompt in POST_PROMPTS:
        try:
            result = _ask(prompt, text)
            _append_toggle(page_id, title, result)
        except Exception as exc:
            _append_toggle(page_id, title, f"⚠️ {exc}")

