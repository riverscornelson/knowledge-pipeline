"""Shared Google credential builder for Drive and Gmail clients."""
import os
from typing import List

from .config import DriveConfig

# Combined scopes for both Drive (full) and Gmail (modify labels)
SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/gmail.modify",
]


def build_credentials(config: DriveConfig, scopes: List[str] = SCOPES):  # type: ignore[assignment]
    """Build Google credentials from service account or OAuth desktop flow."""
    # Option 1: Service account key file
    if config.service_account_path and os.path.exists(config.service_account_path):
        from google.oauth2.service_account import Credentials

        return Credentials.from_service_account_file(
            config.service_account_path, scopes=scopes
        )

    # Option 2: OAuth desktop flow
    if config.oauth_client_secret_path and os.path.exists(
        config.oauth_client_secret_path
    ):
        from google.oauth2.credentials import Credentials as OAuthCredentials
        from google_auth_oauthlib.flow import InstalledAppFlow

        token_path = config.oauth_token_path

        # Try loading existing token
        creds = None
        if os.path.exists(token_path):
            creds = OAuthCredentials.from_authorized_user_file(token_path, scopes)

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
            config.oauth_client_secret_path, scopes
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
