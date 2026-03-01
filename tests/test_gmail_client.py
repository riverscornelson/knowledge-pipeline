"""Tests for Gmail client (all mocked, no credentials needed)."""
import base64
from unittest.mock import MagicMock, patch

from src.config import DriveConfig, GmailConfig
from src.gmail_client import GmailClient


def _make_client(
    label_source: str = "knowledge-pipeline",
    label_processed: str = "pipeline-processed",
) -> GmailClient:
    """Build a GmailClient with mocked credentials and service."""
    gmail_cfg = GmailConfig(label_source=label_source, label_processed=label_processed)
    drive_cfg = DriveConfig(folder_id="folder1")
    with patch("src.gmail_client.build_credentials"), patch(
        "src.gmail_client.build"
    ) as mock_build:
        client = GmailClient(gmail_cfg, drive_cfg)
        client.service = mock_build.return_value
    return client


# --- search_labeled ---


def test_search_labeled_returns_message_ids() -> None:
    client = _make_client()
    client.service.users().messages().list().execute.return_value = {
        "messages": [{"id": "msg1"}, {"id": "msg2"}]
    }
    ids = client.search_labeled()
    assert ids == ["msg1", "msg2"]


def test_search_labeled_empty() -> None:
    client = _make_client()
    client.service.users().messages().list().execute.return_value = {}
    ids = client.search_labeled()
    assert ids == []


# --- get_message ---


def _b64(text: str) -> str:
    return base64.urlsafe_b64encode(text.encode()).decode()


def _make_mime_message(
    subject: str = "Test Subject",
    body_text: str = "Hello world",
    attachments: list = None,
) -> dict:
    """Build a minimal Gmail API full-format message dict."""
    parts = []
    if body_text:
        parts.append(
            {
                "mimeType": "text/plain",
                "body": {"data": _b64(body_text), "size": len(body_text)},
            }
        )
    for att in attachments or []:
        parts.append(
            {
                "mimeType": att["mime"],
                "filename": att["filename"],
                "body": {"attachmentId": att["id"], "size": 1024},
            }
        )
    return {
        "id": "msg1",
        "payload": {
            "mimeType": "multipart/mixed",
            "headers": [{"name": "Subject", "value": subject}],
            "parts": parts,
        },
    }


def test_get_message_extracts_subject_and_body() -> None:
    client = _make_client()
    raw = _make_mime_message(subject="Weekly Report", body_text="Here is the report.")
    client.service.users().messages().get().execute.return_value = raw
    email = client.get_message("msg1")
    assert email["subject"] == "Weekly Report"
    assert email["body"] == "Here is the report."


def test_get_message_identifies_pdf_attachments() -> None:
    client = _make_client()
    raw = _make_mime_message(
        attachments=[
            {"id": "att1", "filename": "report.pdf", "mime": "application/pdf"},
        ]
    )
    client.service.users().messages().get().execute.return_value = raw
    email = client.get_message("msg1")
    assert len(email["attachments"]) == 1
    assert email["attachments"][0]["filename"] == "report.pdf"


def test_get_message_ignores_non_pdf_attachments() -> None:
    client = _make_client()
    raw = _make_mime_message(
        attachments=[
            {"id": "att1", "filename": "doc.docx", "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
            {"id": "att2", "filename": "image.png", "mime": "image/png"},
        ]
    )
    client.service.users().messages().get().execute.return_value = raw
    email = client.get_message("msg1")
    assert email["attachments"] == []


# --- download_attachment ---


def test_download_attachment_decodes_base64() -> None:
    client = _make_client()
    raw_bytes = b"fake pdf content"
    encoded = base64.urlsafe_b64encode(raw_bytes).decode()
    client.service.users().messages().attachments().get().execute.return_value = {
        "data": encoded
    }
    result = client.download_attachment("msg1", "att1")
    assert result == raw_bytes


# --- _get_or_create_label ---


def test_get_or_create_label_existing() -> None:
    client = _make_client()
    client.service.users().labels().list().execute.return_value = {
        "labels": [
            {"name": "knowledge-pipeline", "id": "Label_1"},
            {"name": "INBOX", "id": "INBOX"},
        ]
    }
    label_id = client._get_or_create_label("knowledge-pipeline")
    assert label_id == "Label_1"


def test_get_or_create_label_creates_new() -> None:
    client = _make_client()
    client.service.users().labels().list().execute.return_value = {
        "labels": [{"name": "INBOX", "id": "INBOX"}]
    }
    client.service.users().labels().create().execute.return_value = {
        "name": "pipeline-processed",
        "id": "Label_NEW",
    }
    label_id = client._get_or_create_label("pipeline-processed")
    assert label_id == "Label_NEW"


# --- update_labels ---


def test_update_labels_removes_and_adds() -> None:
    client = _make_client()
    # Pre-populate label cache to skip API lookup
    client._label_id_cache = {
        "knowledge-pipeline": "Label_SRC",
        "pipeline-processed": "Label_DST",
    }
    client.update_labels("msg1")
    client.service.users().messages().modify.assert_called_once_with(
        userId="me",
        id="msg1",
        body={
            "removeLabelIds": ["Label_SRC"],
            "addLabelIds": ["Label_DST"],
        },
    )
