"""Google Drive client: list files, download PDFs, extract text."""
import hashlib
import io
import logging
import warnings
from typing import List, Dict, Any, Optional

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from pdfminer.high_level import extract_text as pdfminer_extract

from .config import DriveConfig

logging.getLogger("pdfminer").setLevel(logging.ERROR)
warnings.filterwarnings("ignore", message=".*FontBBox.*")

log = logging.getLogger(__name__)


class DriveClient:
    """Minimal Google Drive client using a service account."""

    def __init__(self, config: DriveConfig):
        creds = Credentials.from_service_account_file(config.service_account_path)
        self.service = build("drive", "v3", credentials=creds, cache_discovery=False)
        self.folder_id = config.folder_id

    def list_pdfs(self) -> List[Dict[str, Any]]:
        """List all PDF files in the configured Drive folder."""
        query = (
            f"'{self.folder_id}' in parents and trashed=false "
            f"and mimeType='application/pdf'"
        )
        response = self.service.files().list(
            q=query,
            fields="files(id, name, webViewLink, createdTime)",
            pageSize=1000,
        ).execute()
        return response.get("files", [])

    def download_pdf(self, file_id: str) -> bytes:
        """Download a file's content from Drive."""
        request = self.service.files().get_media(fileId=file_id)
        buf = io.BytesIO()
        downloader = MediaIoBaseDownload(buf, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        return buf.getvalue()

    @staticmethod
    def extract_text(pdf_bytes: bytes) -> Optional[str]:
        """Extract text from PDF bytes using pdfminer."""
        try:
            text = pdfminer_extract(io.BytesIO(pdf_bytes))
            if not text or not text.strip():
                return None
            # Basic cleanup
            lines = [l.strip() for l in text.split("\n") if l.strip()]
            cleaned = "\n".join(lines)
            return cleaned.replace("\x0c", "").replace("\xa0", " ")
        except Exception as e:
            log.error("PDF extraction failed: %s", e)
            return None

    @staticmethod
    def content_hash(data: bytes) -> str:
        """SHA-256 hash of raw PDF bytes for deduplication."""
        return hashlib.sha256(data).hexdigest()
