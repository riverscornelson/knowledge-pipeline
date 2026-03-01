"""Gmail → Drive ingest: fetch labeled emails, upload PDFs, run pipeline."""
import logging
import sys
from typing import Dict

from fpdf import FPDF

from .config import PipelineConfig
from .drive_client import DriveClient
from .gmail_client import GmailClient
from .pipeline import Pipeline

log = logging.getLogger(__name__)


def text_to_pdf(subject: str, body: str) -> bytes:
    """Render an email subject + body as a simple PDF. Returns PDF bytes."""
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Subject heading
    pdf.set_font("Helvetica", style="B", size=14)
    pdf.multi_cell(0, 7, subject)
    pdf.ln(4)

    # Body text
    pdf.set_font("Helvetica", size=11)
    # Encode to latin-1 with replacements for unsupported chars
    safe_body = body.encode("latin-1", errors="replace").decode("latin-1")
    pdf.multi_cell(0, 5, safe_body)

    return bytes(pdf.output())


def ingest(config: PipelineConfig) -> Dict[str, int]:
    """Fetch labeled emails from Gmail, upload PDFs to Drive.

    Returns stats: {found, uploaded, skipped, failed}.
    """
    stats = {"found": 0, "uploaded": 0, "skipped": 0, "failed": 0}

    gmail = GmailClient(config.gmail, config.drive)
    drive = DriveClient(config.drive)

    msg_ids = gmail.search_labeled()
    stats["found"] = len(msg_ids)

    if not msg_ids:
        return stats

    for msg_id in msg_ids:
        try:
            email = gmail.get_message(msg_id)
            subject = email["subject"]
            pdf_attachments = email["attachments"]

            uploaded_count = 0
            upload_failed = False

            if pdf_attachments:
                # Rule 2: upload PDF attachments
                for att in pdf_attachments:
                    try:
                        pdf_bytes = gmail.download_attachment(msg_id, att["id"])
                        drive.upload_pdf(att["filename"], pdf_bytes)
                        uploaded_count += 1
                    except Exception as e:
                        log.warning(
                            "Failed to upload attachment %s: %s", att["filename"], e
                        )
                        upload_failed = True
            else:
                # Rule 3: body fallback — no PDF attachments
                try:
                    filename = _sanitize_filename(subject) + ".pdf"
                    pdf_bytes = text_to_pdf(subject, email["body"])
                    drive.upload_pdf(filename, pdf_bytes)
                    uploaded_count += 1
                except Exception as e:
                    log.warning("Failed to upload body PDF for '%s': %s", subject, e)
                    upload_failed = True

            if upload_failed:
                # Rule 5: don't swap labels if any upload failed
                stats["failed"] += 1
                log.warning("Skipping label swap for '%s' due to upload failure", subject)
            else:
                # Rule 5: swap labels only on full success
                gmail.update_labels(msg_id)
                stats["uploaded"] += uploaded_count

        except Exception as e:
            # Rule 6: skip and continue
            stats["failed"] += 1
            log.warning("Error processing email %s: %s", msg_id, e)

    return stats


def _sanitize_filename(name: str) -> str:
    """Remove characters that are problematic in filenames."""
    safe = "".join(c if c.isalnum() or c in " -_." else "_" for c in name)
    return safe.strip() or "email"


def main() -> None:
    """CLI entry point: ingest from Gmail then run the enrichment pipeline."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    try:
        config = PipelineConfig.from_env()
    except KeyError as e:
        print(f"Missing required environment variable: {e}", file=sys.stderr)
        sys.exit(1)

    stats = ingest(config)
    print(
        f"Ingest: {stats['uploaded']} uploaded from {stats['found']} emails "
        f"({stats['failed']} failed)"
    )

    # Rule 9: chain into the existing pipeline
    pipeline = Pipeline(config)
    pipeline.run()


if __name__ == "__main__":
    main()
