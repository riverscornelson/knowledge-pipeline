"""
Drive Processing Status Management System
Tracks and manages the status of Google Drive document processing
"""

import json
import sqlite3
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from enum import Enum
from dataclasses import dataclass, asdict
from contextlib import contextmanager

from utils.logging import setup_logger


class ProcessingStatus(Enum):
    """Processing status enumeration"""
    DISCOVERED = "discovered"
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    RETRY_PENDING = "retry_pending"


class Priority(Enum):
    """Processing priority levels"""
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4


@dataclass
class ProcessingRecord:
    """Record of file processing status and metadata"""
    file_id: str
    file_name: str
    drive_url: str
    notion_page_id: Optional[str]
    status: ProcessingStatus
    priority: Priority
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    processing_time: Optional[float] = None
    quality_score: Optional[float] = None
    block_count: Optional[int] = None
    retry_count: int = 0
    max_retries: int = 3
    error_message: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class DriveStatusManager:
    """
    Manages processing status for Google Drive documents with SQLite persistence.

    Features:
    - Thread-safe operations
    - Status transitions with validation
    - Retry logic with exponential backoff
    - Performance metrics tracking
    - Bulk operations support
    - Status history and auditing
    """

    def __init__(self, db_path: Optional[str] = None):
        """Initialize status manager with SQLite database"""
        self.logger = setup_logger(__name__)

        # Database setup
        if db_path is None:
            db_path = Path("/workspaces/knowledge-pipeline/.drive_status/status.db")

        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        # Thread safety
        self._lock = threading.RLock()
        self._local = threading.local()

        # Initialize database
        self._init_database()

        self.logger.info(f"📊 Drive Status Manager initialized with database: {self.db_path}")

    @contextmanager
    def _get_connection(self):
        """Get thread-safe database connection"""
        if not hasattr(self._local, 'connection'):
            self._local.connection = sqlite3.connect(
                str(self.db_path),
                timeout=30.0,
                check_same_thread=False
            )
            self._local.connection.row_factory = sqlite3.Row

        try:
            yield self._local.connection
        except Exception:
            self._local.connection.rollback()
            raise

    def _init_database(self):
        """Initialize SQLite database with required tables"""
        with self._get_connection() as conn:
            # Main processing records table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS processing_records (
                    file_id TEXT PRIMARY KEY,
                    file_name TEXT NOT NULL,
                    drive_url TEXT NOT NULL,
                    notion_page_id TEXT,
                    status TEXT NOT NULL,
                    priority INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    started_at TEXT,
                    completed_at TEXT,
                    processing_time REAL,
                    quality_score REAL,
                    block_count INTEGER,
                    retry_count INTEGER DEFAULT 0,
                    max_retries INTEGER DEFAULT 3,
                    error_message TEXT,
                    metadata TEXT
                )
            """)

            # Status history for auditing
            conn.execute("""
                CREATE TABLE IF NOT EXISTS status_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_id TEXT NOT NULL,
                    old_status TEXT,
                    new_status TEXT NOT NULL,
                    changed_at TEXT NOT NULL,
                    reason TEXT,
                    FOREIGN KEY (file_id) REFERENCES processing_records (file_id)
                )
            """)

            # Performance metrics
            conn.execute("""
                CREATE TABLE IF NOT EXISTS performance_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    total_processed INTEGER DEFAULT 0,
                    total_completed INTEGER DEFAULT 0,
                    total_failed INTEGER DEFAULT 0,
                    avg_processing_time REAL DEFAULT 0,
                    avg_quality_score REAL DEFAULT 0,
                    avg_block_count REAL DEFAULT 0
                )
            """)

            # Create indexes for performance
            conn.execute("CREATE INDEX IF NOT EXISTS idx_status ON processing_records(status)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_priority ON processing_records(priority)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_updated_at ON processing_records(updated_at)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_history_file_id ON status_history(file_id)")

            conn.commit()

    def add_file(self, file_id: str, file_name: str, drive_url: str,
                notion_page_id: Optional[str] = None, priority: Priority = Priority.MEDIUM,
                metadata: Optional[Dict[str, Any]] = None) -> ProcessingRecord:
        """Add a new file to tracking system"""
        with self._lock:
            now = datetime.now()

            record = ProcessingRecord(
                file_id=file_id,
                file_name=file_name,
                drive_url=drive_url,
                notion_page_id=notion_page_id,
                status=ProcessingStatus.DISCOVERED,
                priority=priority,
                created_at=now,
                updated_at=now,
                metadata=metadata or {}
            )

            with self._get_connection() as conn:
                # Check if file already exists
                existing = conn.execute(
                    "SELECT file_id FROM processing_records WHERE file_id = ?",
                    (file_id,)
                ).fetchone()

                if existing:
                    self.logger.warning(f"File {file_id} already exists in tracking system")
                    return self.get_file_status(file_id)

                # Insert new record
                conn.execute("""
                    INSERT INTO processing_records
                    (file_id, file_name, drive_url, notion_page_id, status, priority,
                     created_at, updated_at, retry_count, max_retries, metadata)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    record.file_id, record.file_name, record.drive_url, record.notion_page_id,
                    record.status.value, record.priority.value, record.created_at.isoformat(),
                    record.updated_at.isoformat(), record.retry_count, record.max_retries,
                    json.dumps(record.metadata) if record.metadata else None
                ))

                # Record status history
                self._add_status_history(conn, file_id, None, ProcessingStatus.DISCOVERED, "File discovered")

                conn.commit()

            self.logger.info(f"📁 Added file to tracking: {file_name} ({file_id})")
            return record

    def update_status(self, file_id: str, new_status: ProcessingStatus,
                     reason: Optional[str] = None, **kwargs) -> bool:
        """Update file processing status with validation"""
        with self._lock:
            now = datetime.now()

            with self._get_connection() as conn:
                # Get current record
                row = conn.execute(
                    "SELECT * FROM processing_records WHERE file_id = ?",
                    (file_id,)
                ).fetchone()

                if not row:
                    self.logger.error(f"File {file_id} not found in tracking system")
                    return False

                old_status = ProcessingStatus(row['status'])

                # Validate status transition
                if not self._is_valid_transition(old_status, new_status):
                    self.logger.warning(f"Invalid status transition for {file_id}: {old_status.value} -> {new_status.value}")
                    return False

                # Prepare update data
                update_data = {
                    'status': new_status.value,
                    'updated_at': now.isoformat()
                }

                # Handle status-specific updates
                if new_status == ProcessingStatus.PROCESSING:
                    update_data['started_at'] = now.isoformat()
                elif new_status in [ProcessingStatus.COMPLETED, ProcessingStatus.FAILED]:
                    update_data['completed_at'] = now.isoformat()
                    if row['started_at']:
                        start_time = datetime.fromisoformat(row['started_at'])
                        update_data['processing_time'] = (now - start_time).total_seconds()
                elif new_status == ProcessingStatus.RETRY_PENDING:
                    update_data['retry_count'] = row['retry_count'] + 1

                # Add any additional kwargs
                for key, value in kwargs.items():
                    if key in ['quality_score', 'block_count', 'error_message', 'notion_page_id']:
                        update_data[key] = value

                # Build update query
                set_clause = ', '.join([f"{key} = ?" for key in update_data.keys()])
                values = list(update_data.values()) + [file_id]

                conn.execute(f"UPDATE processing_records SET {set_clause} WHERE file_id = ?", values)

                # Record status history
                self._add_status_history(conn, file_id, old_status, new_status, reason)

                conn.commit()

            self.logger.info(f"📊 Status updated for {file_id}: {old_status.value} -> {new_status.value}")
            return True

    def _is_valid_transition(self, old_status: ProcessingStatus, new_status: ProcessingStatus) -> bool:
        """Validate status transition rules"""
        valid_transitions = {
            ProcessingStatus.DISCOVERED: [ProcessingStatus.QUEUED, ProcessingStatus.SKIPPED],
            ProcessingStatus.QUEUED: [ProcessingStatus.PROCESSING, ProcessingStatus.SKIPPED],
            ProcessingStatus.PROCESSING: [ProcessingStatus.COMPLETED, ProcessingStatus.FAILED, ProcessingStatus.RETRY_PENDING],
            ProcessingStatus.FAILED: [ProcessingStatus.RETRY_PENDING, ProcessingStatus.SKIPPED],
            ProcessingStatus.RETRY_PENDING: [ProcessingStatus.QUEUED, ProcessingStatus.SKIPPED],
            ProcessingStatus.COMPLETED: [ProcessingStatus.PROCESSING],  # Allow reprocessing
            ProcessingStatus.SKIPPED: [ProcessingStatus.QUEUED, ProcessingStatus.PROCESSING]  # Allow reactivation
        }

        return new_status in valid_transitions.get(old_status, [])

    def _add_status_history(self, conn, file_id: str, old_status: Optional[ProcessingStatus],
                           new_status: ProcessingStatus, reason: Optional[str]):
        """Add entry to status history"""
        conn.execute("""
            INSERT INTO status_history (file_id, old_status, new_status, changed_at, reason)
            VALUES (?, ?, ?, ?, ?)
        """, (
            file_id,
            old_status.value if old_status else None,
            new_status.value,
            datetime.now().isoformat(),
            reason
        ))

    def get_file_status(self, file_id: str) -> Optional[ProcessingRecord]:
        """Get current status of a file"""
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM processing_records WHERE file_id = ?",
                (file_id,)
            ).fetchone()

            if not row:
                return None

            return self._row_to_record(row)

    def get_files_by_status(self, status: ProcessingStatus, limit: Optional[int] = None) -> List[ProcessingRecord]:
        """Get all files with specified status"""
        with self._get_connection() as conn:
            query = "SELECT * FROM processing_records WHERE status = ? ORDER BY priority DESC, updated_at ASC"
            params = [status.value]

            if limit:
                query += " LIMIT ?"
                params.append(limit)

            rows = conn.execute(query, params).fetchall()
            return [self._row_to_record(row) for row in rows]

    def get_retry_candidates(self) -> List[ProcessingRecord]:
        """Get files that should be retried based on retry logic"""
        with self._get_connection() as conn:
            # Get files that failed and haven't exceeded max retries
            rows = conn.execute("""
                SELECT * FROM processing_records
                WHERE status = ? AND retry_count < max_retries
                ORDER BY priority DESC, updated_at ASC
            """, (ProcessingStatus.FAILED.value,)).fetchall()

            candidates = []
            for row in rows:
                record = self._row_to_record(row)
                # Check if enough time has passed for retry (exponential backoff)
                if self._should_retry(record):
                    candidates.append(record)

            return candidates

    def _should_retry(self, record: ProcessingRecord) -> bool:
        """Determine if a failed record should be retried based on exponential backoff"""
        if record.retry_count >= record.max_retries:
            return False

        if not record.updated_at:
            return True

        # Exponential backoff: wait 2^retry_count minutes
        wait_minutes = 2 ** record.retry_count
        wait_time = timedelta(minutes=wait_minutes)

        return datetime.now() - record.updated_at >= wait_time

    def _row_to_record(self, row) -> ProcessingRecord:
        """Convert database row to ProcessingRecord"""
        return ProcessingRecord(
            file_id=row['file_id'],
            file_name=row['file_name'],
            drive_url=row['drive_url'],
            notion_page_id=row['notion_page_id'],
            status=ProcessingStatus(row['status']),
            priority=Priority(row['priority']),
            created_at=datetime.fromisoformat(row['created_at']),
            updated_at=datetime.fromisoformat(row['updated_at']),
            started_at=datetime.fromisoformat(row['started_at']) if row['started_at'] else None,
            completed_at=datetime.fromisoformat(row['completed_at']) if row['completed_at'] else None,
            processing_time=row['processing_time'],
            quality_score=row['quality_score'],
            block_count=row['block_count'],
            retry_count=row['retry_count'],
            max_retries=row['max_retries'],
            error_message=row['error_message'],
            metadata=json.loads(row['metadata']) if row['metadata'] else {}
        )

    def get_processing_stats(self, days: int = 7) -> Dict[str, Any]:
        """Get processing statistics for the last N days"""
        since_date = datetime.now() - timedelta(days=days)

        with self._get_connection() as conn:
            # Overall stats
            stats = conn.execute("""
                SELECT
                    status,
                    COUNT(*) as count,
                    AVG(processing_time) as avg_processing_time,
                    AVG(quality_score) as avg_quality_score,
                    AVG(block_count) as avg_block_count
                FROM processing_records
                WHERE updated_at >= ?
                GROUP BY status
            """, (since_date.isoformat(),)).fetchall()

            # Daily breakdown
            daily_stats = conn.execute("""
                SELECT
                    DATE(updated_at) as date,
                    status,
                    COUNT(*) as count
                FROM processing_records
                WHERE updated_at >= ?
                GROUP BY DATE(updated_at), status
                ORDER BY date DESC
            """, (since_date.isoformat(),)).fetchall()

            # Error patterns
            error_patterns = conn.execute("""
                SELECT
                    error_message,
                    COUNT(*) as count
                FROM processing_records
                WHERE status = 'failed' AND updated_at >= ? AND error_message IS NOT NULL
                GROUP BY error_message
                ORDER BY count DESC
                LIMIT 10
            """, (since_date.isoformat(),)).fetchall()

            return {
                "period_days": days,
                "overall_stats": [dict(row) for row in stats],
                "daily_breakdown": [dict(row) for row in daily_stats],
                "error_patterns": [dict(row) for row in error_patterns],
                "generated_at": datetime.now().isoformat()
            }

    def bulk_update_status(self, file_ids: List[str], new_status: ProcessingStatus,
                          reason: Optional[str] = None) -> int:
        """Update status for multiple files"""
        updated_count = 0

        for file_id in file_ids:
            if self.update_status(file_id, new_status, reason):
                updated_count += 1

        self.logger.info(f"📊 Bulk status update: {updated_count}/{len(file_ids)} files updated to {new_status.value}")
        return updated_count

    def cleanup_old_records(self, days: int = 90) -> int:
        """Clean up old completed/failed records"""
        cutoff_date = datetime.now() - timedelta(days=days)

        with self._lock:
            with self._get_connection() as conn:
                # Delete old completed/failed records
                result = conn.execute("""
                    DELETE FROM processing_records
                    WHERE status IN ('completed', 'failed', 'skipped')
                    AND updated_at < ?
                """, (cutoff_date.isoformat(),))

                deleted_count = result.rowcount

                # Clean up orphaned history records
                conn.execute("""
                    DELETE FROM status_history
                    WHERE file_id NOT IN (SELECT file_id FROM processing_records)
                """)

                conn.commit()

        self.logger.info(f"🧹 Cleaned up {deleted_count} old records older than {days} days")
        return deleted_count

    def export_status_report(self, output_path: Optional[str] = None) -> str:
        """Export comprehensive status report"""
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = f"/workspaces/knowledge-pipeline/results/drive_status_report_{timestamp}.json"

        # Get comprehensive data
        stats = self.get_processing_stats(30)  # Last 30 days

        with self._get_connection() as conn:
            # All current records
            all_records = conn.execute("""
                SELECT * FROM processing_records
                ORDER BY priority DESC, updated_at DESC
            """).fetchall()

            # Recent history
            recent_history = conn.execute("""
                SELECT * FROM status_history
                WHERE changed_at >= ?
                ORDER BY changed_at DESC
                LIMIT 1000
            """, ((datetime.now() - timedelta(days=7)).isoformat(),)).fetchall()

        report = {
            "generated_at": datetime.now().isoformat(),
            "statistics": stats,
            "current_records": [dict(row) for row in all_records],
            "recent_history": [dict(row) for row in recent_history],
            "summary": {
                "total_files": len(all_records),
                "by_status": {},
                "by_priority": {}
            }
        }

        # Calculate summary stats
        for row in all_records:
            status = row['status']
            priority = row['priority']

            report["summary"]["by_status"][status] = report["summary"]["by_status"].get(status, 0) + 1
            report["summary"]["by_priority"][str(priority)] = report["summary"]["by_priority"].get(str(priority), 0) + 1

        # Save report
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w') as f:
            json.dump(report, f, indent=2, default=str)

        self.logger.info(f"📄 Status report exported to: {output_path}")
        return str(output_path)