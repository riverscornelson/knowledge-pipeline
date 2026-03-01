"""Google Drive client: list files, download PDFs, extract text."""
import hashlib
import io
import logging
import os
import warnings
from typing import List, Dict, Any, Optional

from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from pdfminer.high_level import extract_text as pdfminer_extract

from .config import DriveConfig

logging.getLogger("pdfminer").setLevel(logging.ERROR)
warnings.filterwarnings("ignore", message=".*FontBBox.*")

log = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]


def _build_credentials(config: DriveConfig):
    """Build Google credentials from service account or OAuth desktop flow."""
    # Option 1: Service account key file
    if config.service_account_path and os.path.exists(config.service_account_path):
        from google.oauth2.service_account import Credentials
        return Credentials.from_service_account_file(
            config.service_account_path, scopes=SCOPES
        )

    # Option 2: OAuth desktop flow
    if config.oauth_client_secret_path and os.path.exists(config.oauth_client_secret_path):
        from google.oauth2.credentials import Credentials as OAuthCredentials
        from google_auth_oauthlib.flow import InstalledAppFlow

        token_path = config.oauth_token_path

        # Try loading existing token
        creds = None
        if os.path.exists(token_path):
            creds = OAuthCredentials.from_authorized_user_file(token_path, SCOPES)

        # Refresh or run new auth flow
        if creds and creds.valid:
            return creds
        if creds and creds.expired and creds.refresh_token:
            from google.auth.transport.requests import Request
            creds.refresh(Request())
            with open(token_path, "w") as f:
                f.write(creds.to_json())
            return creds

        # New auth flow — try local server, fall back to console for headless
        flow = InstalledAppFlow.from_client_secrets_file(
            config.oauth_client_secret_path, SCOPES
        )
        try:
            creds = flow.run_local_server(port=0, open_browser=False)
        except OSError:
            creds = flow.run_console()
        with open(token_path, "w") as f:
            f.write(creds.to_json())
        return creds

    raise RuntimeError(
        "No Google credentials configured. Set either GOOGLE_APP_CREDENTIALS "
        "(service account) or GOOGLE_OAUTH_CLIENT_SECRET (OAuth desktop flow)."
    )


class DriveClient:
    """Minimal Google Drive client supporting service account or OAuth."""

    def __init__(self, config: DriveConfig):
        creds = _build_credentials(config)
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
            fields="files(id, name, webViewLink, createdTime, size)",
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
