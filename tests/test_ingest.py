"""Tests for the Gmail → Drive ingest module (all mocked)."""
from unittest.mock import MagicMock, patch, call

import pytest

from src.config import PipelineConfig, NotionConfig, DriveConfig, OpenAIConfig, GmailConfig
from src.ingest import ingest, text_to_pdf, main


def _test_config() -> PipelineConfig:
    return PipelineConfig(
        notion=NotionConfig(token="tok", sources_db_id="db1"),
        drive=DriveConfig(folder_id="folder1"),
        openai=OpenAIConfig(api_key="sk-test"),
        gmail=GmailConfig(),
    )


# ---------------------------------------------------------------------------
# text_to_pdf
# ---------------------------------------------------------------------------


def test_text_to_pdf_valid_output() -> None:
    result = text_to_pdf("Test Subject", "This is the body text.")
    assert isinstance(result, bytes)
    assert result[:5] == b"%PDF-"


def test_text_to_pdf_unicode() -> None:
    result = text_to_pdf("Caf\u00e9 & R\u00e9sum\u00e9", "Price: \u20ac100 \u2014 special chars \u2022 here")
    assert isinstance(result, bytes)
    assert result[:5] == b"%PDF-"


def test_text_to_pdf_empty_body() -> None:
    result = text_to_pdf("Subject Only", "")
    assert isinstance(result, bytes)
    assert result[:5] == b"%PDF-"


# ---------------------------------------------------------------------------
# ingest()
# ---------------------------------------------------------------------------


@patch("src.ingest.DriveClient")
@patch("src.ingest.GmailClient")
def test_ingest_uploads_pdf_attachment(MockGmail: MagicMock, MockDrive: MagicMock) -> None:
    gmail = MockGmail.return_value
    drive = MockDrive.return_value

    gmail.search_labeled.return_value = ["msg1"]
    gmail.get_message.return_value = {
        "id": "msg1",
        "subject": "Report",
        "body": "body text",
        "attachments": [{"id": "att1", "filename": "report.pdf", "mime_type": "application/pdf"}],
    }
    gmail.download_attachment.return_value = b"fake-pdf-bytes"

    stats = ingest(_test_config())

    drive.upload_pdf.assert_called_once_with("report.pdf", b"fake-pdf-bytes")
    gmail.update_labels.assert_called_once_with("msg1")
    assert stats["uploaded"] == 1
    assert stats["failed"] == 0


@patch("src.ingest.DriveClient")
@patch("src.ingest.GmailClient")
def test_ingest_body_fallback_no_attachments(MockGmail: MagicMock, MockDrive: MagicMock) -> None:
    gmail = MockGmail.return_value
    drive = MockDrive.return_value

    gmail.search_labeled.return_value = ["msg1"]
    gmail.get_message.return_value = {
        "id": "msg1",
        "subject": "Newsletter",
        "body": "Some newsletter content",
        "attachments": [],
    }

    stats = ingest(_test_config())

    drive.upload_pdf.assert_called_once()
    filename = drive.upload_pdf.call_args[0][0]
    pdf_bytes = drive.upload_pdf.call_args[0][1]
    assert filename.endswith(".pdf")
    assert pdf_bytes[:5] == b"%PDF-"
    gmail.update_labels.assert_called_once()
    assert stats["uploaded"] == 1


@patch("src.ingest.DriveClient")
@patch("src.ingest.GmailClient")
def test_ingest_body_fallback_non_pdf_only(MockGmail: MagicMock, MockDrive: MagicMock) -> None:
    """Email with only non-PDF attachments → body fallback (rules 3 & 4)."""
    gmail = MockGmail.return_value
    drive = MockDrive.return_value

    gmail.search_labeled.return_value = ["msg1"]
    # get_message already filters to PDF-only, so non-PDF attachments = empty list
    gmail.get_message.return_value = {
        "id": "msg1",
        "subject": "With DOCX",
        "body": "Body text here",
        "attachments": [],  # non-PDFs filtered out by gmail_client
    }

    stats = ingest(_test_config())

    drive.upload_pdf.assert_called_once()
    pdf_bytes = drive.upload_pdf.call_args[0][1]
    assert pdf_bytes[:5] == b"%PDF-"
    assert stats["uploaded"] == 1


@patch("src.ingest.DriveClient")
@patch("src.ingest.GmailClient")
def test_ingest_labels_swapped_on_success(MockGmail: MagicMock, MockDrive: MagicMock) -> None:
    gmail = MockGmail.return_value
    drive = MockDrive.return_value

    gmail.search_labeled.return_value = ["msg1"]
    gmail.get_message.return_value = {
        "id": "msg1",
        "subject": "Test",
        "body": "body",
        "attachments": [{"id": "att1", "filename": "a.pdf", "mime_type": "application/pdf"}],
    }
    gmail.download_attachment.return_value = b"pdf"

    ingest(_test_config())

    gmail.update_labels.assert_called_once_with("msg1")


@patch("src.ingest.DriveClient")
@patch("src.ingest.GmailClient")
def test_ingest_labels_unchanged_on_upload_failure(MockGmail: MagicMock, MockDrive: MagicMock) -> None:
    gmail = MockGmail.return_value
    drive = MockDrive.return_value

    gmail.search_labeled.return_value = ["msg1"]
    gmail.get_message.return_value = {
        "id": "msg1",
        "subject": "Test",
        "body": "body",
        "attachments": [{"id": "att1", "filename": "a.pdf", "mime_type": "application/pdf"}],
    }
    gmail.download_attachment.return_value = b"pdf"
    drive.upload_pdf.side_effect = RuntimeError("Drive API error")

    stats = ingest(_test_config())

    gmail.update_labels.assert_not_called()
    assert stats["failed"] == 1


@patch("src.ingest.DriveClient")
@patch("src.ingest.GmailClient")
def test_ingest_continues_after_failure(MockGmail: MagicMock, MockDrive: MagicMock) -> None:
    gmail = MockGmail.return_value
    drive = MockDrive.return_value

    gmail.search_labeled.return_value = ["msg1", "msg2"]

    # First email: get_message raises
    # Second email: succeeds
    def get_msg(msg_id: str):  # type: ignore[override]
        if msg_id == "msg1":
            raise RuntimeError("API error")
        return {
            "id": "msg2",
            "subject": "Good",
            "body": "body",
            "attachments": [{"id": "att1", "filename": "b.pdf", "mime_type": "application/pdf"}],
        }

    gmail.get_message.side_effect = get_msg
    gmail.download_attachment.return_value = b"pdf"

    stats = ingest(_test_config())

    assert stats["uploaded"] == 1
    assert stats["failed"] == 1
    gmail.update_labels.assert_called_once_with("msg2")


@patch("src.ingest.DriveClient")
@patch("src.ingest.GmailClient")
def test_ingest_no_labeled_emails(MockGmail: MagicMock, MockDrive: MagicMock) -> None:
    gmail = MockGmail.return_value
    drive = MockDrive.return_value

    gmail.search_labeled.return_value = []

    stats = ingest(_test_config())

    assert stats == {"found": 0, "uploaded": 0, "skipped": 0, "failed": 0}
    gmail.get_message.assert_not_called()
    drive.upload_pdf.assert_not_called()


@patch("src.ingest.DriveClient")
@patch("src.ingest.GmailClient")
def test_ingest_multiple_pdf_attachments(MockGmail: MagicMock, MockDrive: MagicMock) -> None:
    gmail = MockGmail.return_value
    drive = MockDrive.return_value

    gmail.search_labeled.return_value = ["msg1"]
    gmail.get_message.return_value = {
        "id": "msg1",
        "subject": "Multi PDF",
        "body": "",
        "attachments": [
            {"id": "att1", "filename": "a.pdf", "mime_type": "application/pdf"},
            {"id": "att2", "filename": "b.pdf", "mime_type": "application/pdf"},
            {"id": "att3", "filename": "c.pdf", "mime_type": "application/pdf"},
        ],
    }
    gmail.download_attachment.return_value = b"pdf-bytes"

    stats = ingest(_test_config())

    assert drive.upload_pdf.call_count == 3
    assert stats["uploaded"] == 3
    gmail.update_labels.assert_called_once()


# ---------------------------------------------------------------------------
# main() chains pipeline
# ---------------------------------------------------------------------------


@patch("src.ingest.Pipeline")
@patch("src.ingest.ingest")
@patch("src.ingest.PipelineConfig")
def test_ingest_chains_pipeline(MockConfig: MagicMock, mock_ingest: MagicMock, MockPipeline: MagicMock) -> None:
    MockConfig.from_env.return_value = _test_config()
    mock_ingest.return_value = {"found": 1, "uploaded": 1, "skipped": 0, "failed": 0}

    main()

    mock_ingest.assert_called_once()
    MockPipeline.assert_called_once()
    MockPipeline.return_value.run.assert_called_once()
