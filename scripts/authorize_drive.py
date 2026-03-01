"""One-time OAuth flow for Google Drive in headless environments.

Usage:
  Step 1: python scripts/authorize_drive.py generate
  Step 2: python scripts/authorize_drive.py exchange "REDIRECT_URL"
"""
import json
import os
import sys
from urllib.parse import urlparse, parse_qs

from google_auth_oauthlib.flow import Flow

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
CLIENT_SECRET = "client_secret.json"
TOKEN_PATH = "token.json"
VERIFIER_PATH = "/tmp/oauth_code_verifier.json"
REDIRECT_URI = "http://localhost:1"


def generate():
    flow = Flow.from_client_secrets_file(
        CLIENT_SECRET, scopes=SCOPES, redirect_uri=REDIRECT_URI
    )
    auth_url, state = flow.authorization_url(access_type="offline", prompt="consent")

    # Save the code_verifier and state for the exchange step
    with open(VERIFIER_PATH, "w") as f:
        json.dump({
            "code_verifier": flow.code_verifier,
            "state": state,
        }, f)

    print("\n1. Visit this URL and authorize:\n")
    print(auth_url)
    print("\n2. Browser will redirect to a URL that won't load — that's OK.")
    print("   Copy the FULL URL from the address bar.")
    print('\n3. Run: python scripts/authorize_drive.py exchange "PASTE_URL_HERE"')


def exchange(redirect_url):
    with open(VERIFIER_PATH) as f:
        saved = json.load(f)

    flow = Flow.from_client_secrets_file(
        CLIENT_SECRET, scopes=SCOPES, redirect_uri=REDIRECT_URI
    )
    flow.code_verifier = saved["code_verifier"]

    if "code=" in redirect_url:
        parsed = urlparse(redirect_url)
        code = parse_qs(parsed.query)["code"][0]
    else:
        code = redirect_url

    flow.fetch_token(code=code)
    creds = flow.credentials

    with open(TOKEN_PATH, "w") as f:
        f.write(creds.to_json())

    os.remove(VERIFIER_PATH)
    print(f"\nSaved credentials to {TOKEN_PATH}")
    print("You can now run: python -m src.run")


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] == "generate":
        generate()
    elif sys.argv[1] == "exchange" and len(sys.argv) >= 3:
        exchange(sys.argv[2])
    else:
        print("Usage:")
        print("  python scripts/authorize_drive.py generate")
        print('  python scripts/authorize_drive.py exchange "REDIRECT_URL"')
