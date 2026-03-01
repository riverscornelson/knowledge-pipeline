"""Retry helper for transient API errors across Google, Notion, and OpenAI."""
import logging
import time

log = logging.getLogger(__name__)

TRANSIENT_HTTP_CODES = {429, 500, 502, 503}

# Max retries and initial backoff (doubles each attempt: 2s → 4s → 8s)
MAX_RETRIES = 3
INITIAL_BACKOFF = 2


def _is_transient(exc: Exception) -> bool:
    """Return True if the exception is a transient/retryable error."""
    # Google API errors
    try:
        from googleapiclient.errors import HttpError
        if isinstance(exc, HttpError) and exc.resp.status in TRANSIENT_HTTP_CODES:
            return True
    except ImportError:
        pass

    # Notion SDK errors
    try:
        from notion_client.errors import HTTPResponseError
        if isinstance(exc, HTTPResponseError) and exc.status in TRANSIENT_HTTP_CODES:
            return True
    except ImportError:
        pass

    # OpenAI errors
    try:
        from openai import RateLimitError, InternalServerError, APIConnectionError, APITimeoutError
        if isinstance(exc, (RateLimitError, InternalServerError, APIConnectionError, APITimeoutError)):
            return True
    except ImportError:
        pass

    return False


def retry_on_transient(fn, *args, **kwargs):
    """Call fn with retries on transient errors. Exponential backoff: 2s → 4s → 8s."""
    last_exc = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            return fn(*args, **kwargs)
        except Exception as exc:
            last_exc = exc
            if not _is_transient(exc) or attempt == MAX_RETRIES:
                raise
            delay = INITIAL_BACKOFF * (2 ** attempt)
            log.warning("Transient error (attempt %d/%d), retrying in %ds: %s",
                        attempt + 1, MAX_RETRIES, delay, exc)
            time.sleep(delay)
    raise last_exc  # unreachable, but satisfies type checkers
