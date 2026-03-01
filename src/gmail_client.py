"""Gmail API client: search labeled emails, download attachments, swap labels."""
import base64
import logging
import re
from typing import Any, Dict, List, Optional, TypedDict

from googleapiclient.discovery import build

from .config import DriveConfig, GmailConfig
from .google_auth import build_credentials

log = logging.getLogger(__name__)

GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]


class Attachment(TypedDict):
    id: str
    filename: str
    mime_type: str


class EmailMessage(TypedDict):
    id: str
    subject: str
    body: str
    attachments: List[Attachment]


class GmailClient:
    """Minimal Gmail client for label-driven email ingestion."""

    def __init__(self, gmail_config: GmailConfig, drive_config: DriveConfig):
        creds = build_credentials(drive_config, GMAIL_SCOPES)
        self.service = build("gmail", "v1", credentials=creds, cache_discovery=False)
        self.label_source = gmail_config.label_source
        self.label_processed = gmail_config.label_processed
        self._label_id_cache: Dict[str, str] = {}

    def search_labeled(self) -> List[str]:
        """Return message IDs for emails with the source label."""
        response = (
            self.service.users()
            .messages()
            .list(userId="me", q=f"label:{self.label_source}")
            .execute()
        )
        messages = response.get("messages", [])
        return [m["id"] for m in messages]

    def get_message(self, msg_id: str) -> EmailMessage:
        """Fetch a full message and parse subject, body text, and PDF attachments."""
        msg = (
            self.service.users()
            .messages()
            .get(userId="me", id=msg_id, format="full")
            .execute()
        )
        headers = {h["name"]: h["value"] for h in msg["payload"].get("headers", [])}
        subject = headers.get("Subject", "(no subject)")
        body = self._extract_body(msg["payload"])
        attachments = self._extract_pdf_attachments(msg["payload"])
        return EmailMessage(
            id=msg_id, subject=subject, body=body, attachments=attachments
        )

    def download_attachment(self, msg_id: str, attachment_id: str) -> bytes:
        """Download and base64-decode an attachment."""
        att = (
            self.service.users()
            .messages()
            .attachments()
            .get(userId="me", messageId=msg_id, id=attachment_id)
            .execute()
        )
        data = att["data"]
        return base64.urlsafe_b64decode(data)

    def update_labels(self, msg_id: str) -> None:
        """Remove source label and add processed label."""
        source_id = self._get_or_create_label(self.label_source)
        processed_id = self._get_or_create_label(self.label_processed)
        self.service.users().messages().modify(
            userId="me",
            id=msg_id,
            body={
                "removeLabelIds": [source_id],
                "addLabelIds": [processed_id],
            },
        ).execute()

    def _get_or_create_label(self, name: str) -> str:
        """Look up a label ID by name, creating it if it doesn't exist."""
        if name in self._label_id_cache:
            return self._label_id_cache[name]

        result = self.service.users().labels().list(userId="me").execute()
        for label in result.get("labels", []):
            if label["name"] == name:
                self._label_id_cache[name] = label["id"]
                return label["id"]

        # Create the label
        created = (
            self.service.users()
            .labels()
            .create(userId="me", body={"name": name, "labelListVisibility": "labelShow"})
            .execute()
        )
        self._label_id_cache[name] = created["id"]
        return created["id"]

    @staticmethod
    def _extract_body(payload: Dict[str, Any]) -> str:
        """Walk MIME parts to find plain text body, falling back to stripped HTML."""
        parts = [payload]
        plain_text: Optional[str] = None
        html_text: Optional[str] = None

        while parts:
            part = parts.pop(0)
            mime = part.get("mimeType", "")
            if "parts" in part:
                parts.extend(part["parts"])
                continue
            body_data = part.get("body", {}).get("data")
            if not body_data:
                continue
            decoded = base64.urlsafe_b64decode(body_data).decode("utf-8", errors="replace")
            if mime == "text/plain" and plain_text is None:
                plain_text = decoded
            elif mime == "text/html" and html_text is None:
                html_text = decoded

        if plain_text is not None:
            return plain_text
        if html_text is not None:
            return _strip_html(html_text)
        return ""

    @staticmethod
    def _extract_pdf_attachments(payload: Dict[str, Any]) -> List[Attachment]:
        """Find PDF attachments in MIME parts."""
        attachments: List[Attachment] = []
        parts = [payload]
        while parts:
            part = parts.pop(0)
            if "parts" in part:
                parts.extend(part["parts"])
                continue
            filename = part.get("filename", "")
            mime = part.get("mimeType", "")
            att_id = part.get("body", {}).get("attachmentId")
            if not att_id or not filename:
                continue
            if mime == "application/pdf" or filename.lower().endswith(".pdf"):
                attachments.append(
                    Attachment(id=att_id, filename=filename, mime_type=mime)
                )
        return attachments


def _strip_html(html: str) -> str:
    """Basic HTML tag stripping for body fallback."""
    text = re.sub(r"<br\s*/?>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    return text.strip()
