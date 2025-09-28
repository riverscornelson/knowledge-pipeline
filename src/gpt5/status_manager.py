"""
GPT-5 Status Management System
Tracks processing status, handles errors, and manages API limits.
"""
import time
import logging
from datetime import datetime, timedelta
from typing import Dict, Optional, List, Tuple, Any
from enum import Enum
from dataclasses import dataclass, field
from pathlib import Path
import json
import sqlite3
from contextlib import contextmanager
import threading
import asyncio
from functools import wraps

logger = logging.getLogger(__name__)


class ProcessingStage(Enum):
    """Stages of GPT-5 processing pipeline."""
    INITIALIZATION = "initialization"
    CONTENT_EXTRACTION = "content_extraction"
    QUALITY_VALIDATION = "quality_validation"
    ENRICHMENT = "enrichment"
    NOTION_FORMATTING = "notion_formatting"
    NOTION_UPLOAD = "notion_upload"
    COMPLETED = "completed"
    FAILED = "failed"


class ErrorSeverity(Enum):
    """Error severity levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class RetryStrategy(Enum):
    """Retry strategies for different error types."""
    EXPONENTIAL_BACKOFF = "exponential_backoff"
    LINEAR_BACKOFF = "linear_backoff"
    IMMEDIATE = "immediate"
    NO_RETRY = "no_retry"


@dataclass
class ProcessingError:
    """Represents a processing error with context."""
    timestamp: datetime
    stage: ProcessingStage
    error_type: str
    message: str
    severity: ErrorSeverity
    retry_count: int = 0
    stack_trace: Optional[str] = None
    context: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ProcessingStatus:
    """Tracks the status of a content item through processing stages."""
    content_id: str
    current_stage: ProcessingStage
    started_at: datetime
    updated_at: datetime
    completed_stages: List[ProcessingStage] = field(default_factory=list)
    errors: List[ProcessingError] = field(default_factory=list)
    retry_count: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_completed(self) -> bool:
        """Check if processing is completed successfully."""
        return self.current_stage == ProcessingStage.COMPLETED

    @property
    def is_failed(self) -> bool:
        """Check if processing has failed."""
        return self.current_stage == ProcessingStage.FAILED

    @property
    def processing_time(self) -> timedelta:
        """Calculate total processing time."""
        return self.updated_at - self.started_at

    @property
    def has_critical_errors(self) -> bool:
        """Check if there are any critical errors."""
        return any(error.severity == ErrorSeverity.CRITICAL for error in self.errors)


class APIRateLimiter:
    """Manages API rate limiting with backoff strategies."""

    def __init__(self, max_requests_per_minute: int = 50, max_tokens_per_minute: int = 40000):
        self.max_requests_per_minute = max_requests_per_minute
        self.max_tokens_per_minute = max_tokens_per_minute
        self.request_times: List[datetime] = []
        self.token_usage: List[Tuple[datetime, int]] = []
        self.lock = threading.Lock()

    def can_make_request(self, estimated_tokens: int = 0) -> Tuple[bool, Optional[float]]:
        """
        Check if a request can be made without exceeding rate limits.
        Returns (can_make_request, wait_time_seconds).
        """
        with self.lock:
            now = datetime.now()
            minute_ago = now - timedelta(minutes=1)

            # Clean old entries
            self.request_times = [t for t in self.request_times if t > minute_ago]
            self.token_usage = [(t, tokens) for t, tokens in self.token_usage if t > minute_ago]

            # Check request rate limit
            if len(self.request_times) >= self.max_requests_per_minute:
                wait_time = 60 - (now - self.request_times[0]).total_seconds()
                return False, wait_time

            # Check token rate limit
            current_tokens = sum(tokens for _, tokens in self.token_usage)
            if current_tokens + estimated_tokens > self.max_tokens_per_minute:
                if self.token_usage:
                    wait_time = 60 - (now - self.token_usage[0][0]).total_seconds()
                    return False, wait_time

            return True, None

    def record_request(self, tokens_used: int = 0):
        """Record a successful request."""
        with self.lock:
            now = datetime.now()
            self.request_times.append(now)
            if tokens_used > 0:
                self.token_usage.append((now, tokens_used))


class StatusManager:
    """Manages processing status, errors, and recovery for GPT-5 pipeline."""

    def __init__(self, db_path: str = ".gpt5_status.db"):
        self.db_path = Path(db_path)
        self.rate_limiter = APIRateLimiter()
        self._init_database()
        self.lock = threading.Lock()

    def _init_database(self):
        """Initialize SQLite database for status tracking."""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS processing_status (
                    content_id TEXT PRIMARY KEY,
                    current_stage TEXT NOT NULL,
                    started_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    completed_stages TEXT,
                    retry_count INTEGER DEFAULT 0,
                    metadata TEXT
                )
            """)

            conn.execute("""
                CREATE TABLE IF NOT EXISTS processing_errors (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    content_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    stage TEXT NOT NULL,
                    error_type TEXT NOT NULL,
                    message TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    retry_count INTEGER DEFAULT 0,
                    stack_trace TEXT,
                    context TEXT,
                    FOREIGN KEY (content_id) REFERENCES processing_status (content_id)
                )
            """)

            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_content_status ON processing_status(content_id);
            """)

            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_error_content ON processing_errors(content_id);
            """)

    @contextmanager
    def get_db_connection(self):
        """Get database connection with proper error handling."""
        conn = None
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            conn.row_factory = sqlite3.Row
            yield conn
        except sqlite3.Error as e:
            logger.error(f"Database error: {e}")
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                conn.close()

    def start_processing(self, content_id: str, metadata: Optional[Dict[str, Any]] = None) -> ProcessingStatus:
        """Start processing for a content item."""
        with self.lock:
            now = datetime.now()
            status = ProcessingStatus(
                content_id=content_id,
                current_stage=ProcessingStage.INITIALIZATION,
                started_at=now,
                updated_at=now,
                metadata=metadata or {}
            )

            with self.get_db_connection() as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO processing_status
                    (content_id, current_stage, started_at, updated_at, completed_stages, retry_count, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    content_id,
                    status.current_stage.value,
                    status.started_at.isoformat(),
                    status.updated_at.isoformat(),
                    json.dumps([]),
                    status.retry_count,
                    json.dumps(status.metadata)
                ))
                conn.commit()

            logger.info(f"Started processing for content {content_id}")
            return status

    def update_stage(self, content_id: str, new_stage: ProcessingStage, metadata: Optional[Dict[str, Any]] = None):
        """Update the current processing stage."""
        with self.lock:
            status = self.get_status(content_id)
            if not status:
                raise ValueError(f"No processing status found for content {content_id}")

            # Mark previous stage as completed
            if status.current_stage not in status.completed_stages:
                status.completed_stages.append(status.current_stage)

            status.current_stage = new_stage
            status.updated_at = datetime.now()

            if metadata:
                status.metadata.update(metadata)

            with self.get_db_connection() as conn:
                conn.execute("""
                    UPDATE processing_status
                    SET current_stage = ?, updated_at = ?, completed_stages = ?, metadata = ?
                    WHERE content_id = ?
                """, (
                    new_stage.value,
                    status.updated_at.isoformat(),
                    json.dumps([stage.value for stage in status.completed_stages]),
                    json.dumps(status.metadata),
                    content_id
                ))
                conn.commit()

            logger.info(f"Updated {content_id} to stage {new_stage.value}")

    def record_error(self, content_id: str, error: Exception, stage: ProcessingStage,
                    severity: ErrorSeverity = ErrorSeverity.MEDIUM, context: Optional[Dict[str, Any]] = None):
        """Record an error during processing."""
        with self.lock:
            processing_error = ProcessingError(
                timestamp=datetime.now(),
                stage=stage,
                error_type=type(error).__name__,
                message=str(error),
                severity=severity,
                stack_trace=str(error.__traceback__) if hasattr(error, '__traceback__') else None,
                context=context or {}
            )

            with self.get_db_connection() as conn:
                conn.execute("""
                    INSERT INTO processing_errors
                    (content_id, timestamp, stage, error_type, message, severity, stack_trace, context)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    content_id,
                    processing_error.timestamp.isoformat(),
                    processing_error.stage.value,
                    processing_error.error_type,
                    processing_error.message,
                    processing_error.severity.value,
                    processing_error.stack_trace,
                    json.dumps(processing_error.context)
                ))
                conn.commit()

            # Update status to failed if critical error
            if severity == ErrorSeverity.CRITICAL:
                self.mark_failed(content_id)

            logger.error(f"Recorded {severity.value} error for {content_id} at {stage.value}: {processing_error.message}")

    def mark_completed(self, content_id: str, metadata: Optional[Dict[str, Any]] = None):
        """Mark processing as completed successfully."""
        self.update_stage(content_id, ProcessingStage.COMPLETED, metadata)
        logger.info(f"Marked {content_id} as completed")

    def mark_failed(self, content_id: str, metadata: Optional[Dict[str, Any]] = None):
        """Mark processing as failed."""
        self.update_stage(content_id, ProcessingStage.FAILED, metadata)
        logger.error(f"Marked {content_id} as failed")

    def get_status(self, content_id: str) -> Optional[ProcessingStatus]:
        """Get current processing status for a content item."""
        with self.get_db_connection() as conn:
            row = conn.execute("""
                SELECT * FROM processing_status WHERE content_id = ?
            """, (content_id,)).fetchone()

            if not row:
                return None

            # Get errors for this content
            error_rows = conn.execute("""
                SELECT * FROM processing_errors
                WHERE content_id = ?
                ORDER BY timestamp DESC
            """, (content_id,)).fetchall()

            errors = []
            for error_row in error_rows:
                errors.append(ProcessingError(
                    timestamp=datetime.fromisoformat(error_row['timestamp']),
                    stage=ProcessingStage(error_row['stage']),
                    error_type=error_row['error_type'],
                    message=error_row['message'],
                    severity=ErrorSeverity(error_row['severity']),
                    retry_count=error_row['retry_count'],
                    stack_trace=error_row['stack_trace'],
                    context=json.loads(error_row['context']) if error_row['context'] else {}
                ))

            completed_stages = [ProcessingStage(stage) for stage in json.loads(row['completed_stages'])]

            return ProcessingStatus(
                content_id=row['content_id'],
                current_stage=ProcessingStage(row['current_stage']),
                started_at=datetime.fromisoformat(row['started_at']),
                updated_at=datetime.fromisoformat(row['updated_at']),
                completed_stages=completed_stages,
                errors=errors,
                retry_count=row['retry_count'],
                metadata=json.loads(row['metadata']) if row['metadata'] else {}
            )

    def get_all_status(self, filter_stage: Optional[ProcessingStage] = None) -> List[ProcessingStatus]:
        """Get all processing statuses, optionally filtered by stage."""
        with self.get_db_connection() as conn:
            query = "SELECT content_id FROM processing_status"
            params = []

            if filter_stage:
                query += " WHERE current_stage = ?"
                params.append(filter_stage.value)

            rows = conn.execute(query, params).fetchall()

            return [self.get_status(row['content_id']) for row in rows if self.get_status(row['content_id'])]

    def should_retry(self, content_id: str, max_retries: int = 3) -> bool:
        """Determine if processing should be retried."""
        status = self.get_status(content_id)
        if not status:
            return False

        # Don't retry if already completed
        if status.is_completed:
            return False

        # Don't retry if max retries exceeded
        if status.retry_count >= max_retries:
            return False

        # Don't retry if there are critical errors
        if status.has_critical_errors:
            return False

        return True

    def increment_retry_count(self, content_id: str):
        """Increment the retry count for a content item."""
        with self.lock:
            with self.get_db_connection() as conn:
                conn.execute("""
                    UPDATE processing_status
                    SET retry_count = retry_count + 1, updated_at = ?
                    WHERE content_id = ?
                """, (datetime.now().isoformat(), content_id))
                conn.commit()

    def wait_for_rate_limit(self, estimated_tokens: int = 0) -> bool:
        """Wait for rate limit if necessary. Returns True if waited."""
        can_proceed, wait_time = self.rate_limiter.can_make_request(estimated_tokens)

        if not can_proceed and wait_time:
            logger.info(f"Rate limit reached, waiting {wait_time:.1f} seconds...")
            time.sleep(wait_time + 1)  # Add buffer
            return True

        return False

    def record_api_usage(self, tokens_used: int = 0):
        """Record API usage for rate limiting."""
        self.rate_limiter.record_request(tokens_used)

    def get_progress_report(self) -> Dict[str, Any]:
        """Generate a comprehensive progress report."""
        all_statuses = self.get_all_status()

        stage_counts = {}
        for stage in ProcessingStage:
            stage_counts[stage.value] = len([s for s in all_statuses if s.current_stage == stage])

        error_counts = {}
        for severity in ErrorSeverity:
            error_counts[severity.value] = sum(
                len([e for e in status.errors if e.severity == severity])
                for status in all_statuses
            )

        total_processing_time = sum(
            (status.processing_time.total_seconds() for status in all_statuses),
            0
        )

        return {
            "total_items": len(all_statuses),
            "stage_distribution": stage_counts,
            "error_distribution": error_counts,
            "average_processing_time": total_processing_time / len(all_statuses) if all_statuses else 0,
            "completion_rate": stage_counts.get(ProcessingStage.COMPLETED.value, 0) / len(all_statuses) if all_statuses else 0,
            "failure_rate": stage_counts.get(ProcessingStage.FAILED.value, 0) / len(all_statuses) if all_statuses else 0,
            "timestamp": datetime.now().isoformat()
        }

    def cleanup_old_records(self, days_old: int = 30):
        """Clean up old processing records."""
        cutoff_date = datetime.now() - timedelta(days=days_old)

        with self.get_db_connection() as conn:
            # Delete old errors
            conn.execute("""
                DELETE FROM processing_errors
                WHERE timestamp < ?
            """, (cutoff_date.isoformat(),))

            # Delete old completed/failed statuses
            conn.execute("""
                DELETE FROM processing_status
                WHERE updated_at < ? AND current_stage IN (?, ?)
            """, (cutoff_date.isoformat(), ProcessingStage.COMPLETED.value, ProcessingStage.FAILED.value))

            conn.commit()

        logger.info(f"Cleaned up records older than {days_old} days")


def with_status_tracking(stage: ProcessingStage, severity: ErrorSeverity = ErrorSeverity.MEDIUM):
    """Decorator for automatic status tracking and error handling."""
    def decorator(func):
        @wraps(func)
        def wrapper(self, content_id: str, *args, **kwargs):
            status_manager = getattr(self, 'status_manager', None)
            if not status_manager:
                return func(self, content_id, *args, **kwargs)

            try:
                status_manager.update_stage(content_id, stage)
                result = func(self, content_id, *args, **kwargs)
                return result
            except Exception as e:
                status_manager.record_error(content_id, e, stage, severity)
                raise

        return wrapper
    return decorator


# Singleton instance for global use
_status_manager = None

def get_status_manager() -> StatusManager:
    """Get the global status manager instance."""
    global _status_manager
    if _status_manager is None:
        _status_manager = StatusManager()
    return _status_manager