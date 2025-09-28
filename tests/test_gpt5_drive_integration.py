"""
Test suite for GPT-5 Drive Integration
Comprehensive tests for Drive processor, status management, and error handling
"""

import pytest
import tempfile
import json
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import sys

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from drive.gpt5_drive_processor import GPT5DriveProcessor, ProcessingStatus, ProcessingResult
from drive.status_manager import DriveStatusManager, ProcessingRecord, Priority
from drive.error_handler import DriveErrorHandler, ErrorCategory, CircuitBreaker, CircuitBreakerState
from core.models import ContentStatus


class TestGPT5DriveProcessor:
    """Test GPT-5 Drive Processor functionality"""

    @pytest.fixture
    def mock_config(self):
        """Mock configuration for testing"""
        config = Mock()
        config.notion = Mock()
        config.google_drive = Mock()
        config.rate_limit_delay = 0.1
        return config

    @pytest.fixture
    def processor(self, mock_config):
        """Create processor instance for testing"""
        with patch('drive.gpt5_drive_processor.NotionClient'), \
             patch('drive.gpt5_drive_processor.DriveIngester'), \
             patch('drive.gpt5_drive_processor.EnhancedQualityValidator'), \
             patch('drive.gpt5_drive_processor.OptimizedNotionFormatter'):
            return GPT5DriveProcessor()

    def test_initialization(self, processor):
        """Test processor initialization"""
        assert processor is not None
        assert hasattr(processor, 'notion_client')
        assert hasattr(processor, 'drive_ingester')
        assert hasattr(processor, 'quality_validator')
        assert hasattr(processor, 'notion_formatter')

    def test_get_drive_files_by_status(self, processor):
        """Test filtering files by status"""
        # Mock notion client responses
        mock_pages = [
            {
                "id": "page1",
                "properties": {
                    "Name": {"title": [{"plain_text": "Test Document 1"}]},
                    "Drive URL": {"url": "https://drive.google.com/file/d/1abc123/view"},
                    "Status": {"select": {"name": "Inbox"}}
                }
            },
            {
                "id": "page2",
                "properties": {
                    "Name": {"title": [{"plain_text": "Test Document 2"}]},
                    "Drive URL": {"url": "https://drive.google.com/file/d/2def456/view"},
                    "Status": {"select": {"name": "Completed"}}
                }
            }
        ]

        processor.notion_client.get_inbox_items.return_value = mock_pages

        files = processor.get_drive_files_by_status()
        assert len(files) == 2
        assert files[0]["id"] == "1abc123"
        assert files[0]["name"] == "Test Document 1"
        assert files[1]["id"] == "2def456"

    def test_process_file_success(self, processor):
        """Test successful file processing"""
        file_info = {
            "id": "test123",
            "name": "Test Document",
            "notion_page_id": "page123",
            "status": "Inbox"
        }

        # Mock successful processing
        processor.quality_validator.validate_content.return_value = 9.2
        processor.notion_formatter.format_content.return_value = [{"type": "paragraph", "content": "test"}]

        result = processor.process_file(file_info)

        assert result.status == ProcessingStatus.COMPLETED
        assert result.quality_score == 9.2
        assert result.block_count == 1
        assert result.file_id == "test123"

    def test_process_file_low_quality(self, processor):
        """Test processing file with low quality score"""
        file_info = {
            "id": "test123",
            "name": "Test Document",
            "notion_page_id": "page123",
            "status": "Inbox"
        }

        # Mock low quality score
        processor.quality_validator.validate_content.return_value = 7.5

        result = processor.process_file(file_info)

        assert result.status == ProcessingStatus.FAILED
        assert "Quality score" in result.error_message

    def test_process_file_skip_existing(self, processor):
        """Test skipping already processed files"""
        file_info = {
            "id": "test123",
            "name": "Test Document",
            "notion_page_id": "page123",
            "status": "Completed"
        }

        result = processor.process_file(file_info, force_reprocess=False)

        assert result.status == ProcessingStatus.SKIPPED
        assert result.file_id == "test123"

    def test_process_batch(self, processor):
        """Test batch processing functionality"""
        file_ids = ["test1", "test2", "test3"]

        # Mock drive API responses
        mock_file_info = {
            "id": "test1",
            "name": "Test Document 1",
            "webViewLink": "https://drive.google.com/file/d/test1/view",
            "mimeType": "application/pdf"
        }
        processor.drive_ingester.drive.files().get().execute.return_value = mock_file_info

        # Mock successful processing
        processor.quality_validator.validate_content.return_value = 9.0
        processor.notion_formatter.format_content.return_value = [{"type": "paragraph"}]

        summary = processor.process_batch(file_ids, batch_size=2, dry_run=True)

        assert summary["success"] is True
        assert summary["dry_run"] is True
        assert summary["file_count"] == 3

    def test_cli_argument_parsing(self):
        """Test CLI argument parsing"""
        from drive.gpt5_drive_processor import create_cli_parser

        parser = create_cli_parser()

        # Test --all flag
        args = parser.parse_args(["--all"])
        assert args.all is True

        # Test --file-ids flag
        args = parser.parse_args(["--file-ids", "1,2,3"])
        assert args.file_ids == "1,2,3"

        # Test --dry-run flag
        args = parser.parse_args(["--all", "--dry-run"])
        assert args.dry_run is True

        # Test --force flag
        args = parser.parse_args(["--file-ids", "1", "--force"])
        assert args.force is True


class TestDriveStatusManager:
    """Test Drive Status Manager functionality"""

    @pytest.fixture
    def temp_db(self):
        """Create temporary database for testing"""
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
            yield f.name
        Path(f.name).unlink(missing_ok=True)

    @pytest.fixture
    def status_manager(self, temp_db):
        """Create status manager instance for testing"""
        return DriveStatusManager(temp_db)

    def test_initialization(self, status_manager):
        """Test status manager initialization"""
        assert status_manager is not None
        assert status_manager.db_path.exists()

    def test_add_file(self, status_manager):
        """Test adding file to tracking system"""
        record = status_manager.add_file(
            file_id="test123",
            file_name="Test Document",
            drive_url="https://drive.google.com/file/d/test123/view",
            priority=Priority.HIGH
        )

        assert record.file_id == "test123"
        assert record.status == ProcessingStatus.DISCOVERED
        assert record.priority == Priority.HIGH

    def test_update_status(self, status_manager):
        """Test status updates"""
        # Add file first
        status_manager.add_file(
            file_id="test123",
            file_name="Test Document",
            drive_url="https://drive.google.com/file/d/test123/view"
        )

        # Update to processing
        success = status_manager.update_status("test123", ProcessingStatus.PROCESSING)
        assert success is True

        # Check updated record
        record = status_manager.get_file_status("test123")
        assert record.status == ProcessingStatus.PROCESSING
        assert record.started_at is not None

        # Update to completed
        success = status_manager.update_status(
            "test123",
            ProcessingStatus.COMPLETED,
            quality_score=9.2,
            block_count=10
        )
        assert success is True

        record = status_manager.get_file_status("test123")
        assert record.status == ProcessingStatus.COMPLETED
        assert record.quality_score == 9.2
        assert record.block_count == 10
        assert record.processing_time is not None

    def test_invalid_status_transition(self, status_manager):
        """Test invalid status transitions"""
        # Add file and set to completed
        status_manager.add_file("test123", "Test", "https://example.com")
        status_manager.update_status("test123", ProcessingStatus.COMPLETED)

        # Try invalid transition from completed to failed
        success = status_manager.update_status("test123", ProcessingStatus.FAILED)
        assert success is False

    def test_get_files_by_status(self, status_manager):
        """Test filtering files by status"""
        # Add files with different statuses
        status_manager.add_file("test1", "Doc1", "https://example.com/1")
        status_manager.add_file("test2", "Doc2", "https://example.com/2")
        status_manager.add_file("test3", "Doc3", "https://example.com/3")

        status_manager.update_status("test1", ProcessingStatus.PROCESSING)
        status_manager.update_status("test2", ProcessingStatus.COMPLETED)

        # Get processing files
        processing_files = status_manager.get_files_by_status(ProcessingStatus.PROCESSING)
        assert len(processing_files) == 1
        assert processing_files[0].file_id == "test1"

        # Get discovered files
        discovered_files = status_manager.get_files_by_status(ProcessingStatus.DISCOVERED)
        assert len(discovered_files) == 1
        assert discovered_files[0].file_id == "test3"

    def test_retry_logic(self, status_manager):
        """Test retry candidate identification"""
        # Add file and mark as failed
        status_manager.add_file("test123", "Test", "https://example.com")
        status_manager.update_status("test123", ProcessingStatus.FAILED, error_message="Test error")

        # Should be retry candidate immediately
        candidates = status_manager.get_retry_candidates()
        assert len(candidates) == 1
        assert candidates[0].file_id == "test123"

        # After max retries, should not be candidate
        record = status_manager.get_file_status("test123")
        status_manager.update_status("test123", ProcessingStatus.RETRY_PENDING)

        # Simulate multiple retries
        with status_manager._get_connection() as conn:
            conn.execute(
                "UPDATE processing_records SET retry_count = ? WHERE file_id = ?",
                (3, "test123")  # Assuming max_retries = 3
            )
            conn.commit()

        candidates = status_manager.get_retry_candidates()
        assert len(candidates) == 0

    def test_performance_metrics(self, status_manager):
        """Test performance metrics collection"""
        # Add and process some files
        for i in range(5):
            status_manager.add_file(f"test{i}", f"Doc{i}", f"https://example.com/{i}")
            status_manager.update_status(f"test{i}", ProcessingStatus.COMPLETED, quality_score=9.0 + i * 0.1)

        stats = status_manager.get_processing_stats(days=1)
        assert stats["period_days"] == 1
        assert len(stats["overall_stats"]) > 0

    def test_bulk_operations(self, status_manager):
        """Test bulk status updates"""
        file_ids = ["test1", "test2", "test3"]

        # Add files
        for file_id in file_ids:
            status_manager.add_file(file_id, f"Doc {file_id}", f"https://example.com/{file_id}")

        # Bulk update to processing
        updated_count = status_manager.bulk_update_status(file_ids, ProcessingStatus.PROCESSING)
        assert updated_count == 3

        # Verify all are updated
        for file_id in file_ids:
            record = status_manager.get_file_status(file_id)
            assert record.status == ProcessingStatus.PROCESSING


class TestDriveErrorHandler:
    """Test Drive Error Handler functionality"""

    @pytest.fixture
    def error_handler(self):
        """Create error handler instance for testing"""
        return DriveErrorHandler()

    def test_error_categorization(self, error_handler):
        """Test error categorization"""
        from googleapiclient.errors import HttpError
        from notion_client.errors import APIResponseError

        # Test rate limit error
        rate_limit_error = HttpError(
            resp=Mock(status=429),
            content=b'{"error": {"code": 429, "message": "quotaExceeded"}}'
        )
        category = error_handler.categorize_error(rate_limit_error)
        assert category == ErrorCategory.RATE_LIMIT

        # Test authentication error
        auth_error = HttpError(
            resp=Mock(status=403),
            content=b'{"error": {"code": 403, "message": "forbidden"}}'
        )
        category = error_handler.categorize_error(auth_error)
        assert category == ErrorCategory.AUTHENTICATION

        # Test network error
        network_error = ConnectionError("Connection failed")
        category = error_handler.categorize_error(network_error)
        assert category == ErrorCategory.NETWORK

    def test_retry_configuration(self, error_handler):
        """Test retry configuration generation"""
        from googleapiclient.errors import HttpError

        # Rate limit error should have high retry count
        rate_limit_error = HttpError(
            resp=Mock(status=429),
            content=b'{"error": {"message": "quotaExceeded"}}'
        )
        config = error_handler.get_retry_config(rate_limit_error)
        assert config.max_retries >= 3
        assert config.base_delay > 0

        # Authentication error should not retry
        auth_error = HttpError(
            resp=Mock(status=403),
            content=b'{"error": {"message": "forbidden"}}'
        )
        config = error_handler.get_retry_config(auth_error)
        assert config.max_retries == 0

    def test_circuit_breaker(self):
        """Test circuit breaker functionality"""
        from drive.error_handler import CircuitBreakerConfig

        config = CircuitBreakerConfig(failure_threshold=2, recovery_timeout=1.0)
        cb = CircuitBreaker(config, "test")

        # Initial state should be closed
        assert cb.state == CircuitBreakerState.CLOSED
        assert cb.can_execute() is True

        # Record failures to trigger open state
        cb.record_failure()
        assert cb.state == CircuitBreakerState.CLOSED  # Still closed
        cb.record_failure()
        assert cb.state == CircuitBreakerState.OPEN  # Now open

        # Should not allow execution when open
        assert cb.can_execute() is False

        # After timeout, should transition to half-open
        import time
        time.sleep(1.1)  # Wait for timeout
        assert cb.can_execute() is True
        assert cb.state == CircuitBreakerState.HALF_OPEN

        # Success should close the circuit
        cb.record_success()
        assert cb.state == CircuitBreakerState.CLOSED

    @patch('time.sleep')  # Mock sleep to speed up tests
    def test_retry_decorator(self, mock_sleep, error_handler):
        """Test retry decorator functionality"""
        call_count = 0

        @error_handler.with_retry("test_service")
        def failing_function():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ConnectionError("Network error")
            return "success"

        result = failing_function()
        assert result == "success"
        assert call_count == 3
        assert mock_sleep.call_count >= 2  # Should have slept between retries

    def test_batch_error_handling(self, error_handler):
        """Test batch error analysis"""
        errors = [
            ("file1", ConnectionError("Network timeout")),
            ("file2", ValueError("Invalid data")),
            ("file3", ConnectionError("Connection refused")),
        ]

        summary = error_handler.handle_batch_errors(errors, "test_operation")

        assert summary["total_errors"] == 3
        assert summary["by_category"]["network"] == 2
        assert len(summary["retryable_errors"]) >= 2  # Network errors are retryable
        assert len(summary["recommendations"]) > 0

    def test_error_metrics(self, error_handler):
        """Test error metrics collection"""
        # Simulate some errors
        try:
            error_handler.execute_with_retry(
                lambda: (_ for _ in ()).throw(ConnectionError("Test error")),
                "test_service"
            )
        except:
            pass

        metrics = error_handler.get_error_metrics()
        assert metrics["total_errors"] > 0
        assert "errors_by_category" in metrics
        assert "circuit_breakers" in metrics


class TestIntegrationWorkflow:
    """Integration tests for complete workflow"""

    @pytest.fixture
    def temp_env(self):
        """Set up temporary testing environment"""
        temp_dir = Path(tempfile.mkdtemp())
        db_path = temp_dir / "test_status.db"
        results_dir = temp_dir / "results"
        results_dir.mkdir()

        yield {
            "temp_dir": temp_dir,
            "db_path": db_path,
            "results_dir": results_dir
        }

        # Cleanup
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)

    @patch('drive.gpt5_drive_processor.NotionClient')
    @patch('drive.gpt5_drive_processor.DriveIngester')
    @patch('drive.gpt5_drive_processor.EnhancedQualityValidator')
    @patch('drive.gpt5_drive_processor.OptimizedNotionFormatter')
    def test_full_processing_workflow(self, mock_formatter, mock_validator,
                                    mock_ingester, mock_notion, temp_env):
        """Test complete processing workflow"""
        # Setup mocks
        mock_validator.return_value.validate_content.return_value = 9.2
        mock_formatter.return_value.format_content.return_value = [
            {"type": "paragraph", "content": "Test content"}
        ]

        # Create processor
        processor = GPT5DriveProcessor()

        # Mock file processing
        file_info = {
            "id": "test123",
            "name": "Test Document.pdf",
            "notion_page_id": "page123",
            "status": "Inbox"
        }

        result = processor.process_file(file_info)

        # Verify result
        assert result.status == ProcessingStatus.COMPLETED
        assert result.quality_score == 9.2
        assert result.block_count == 1
        assert result.processing_time > 0

        # Verify Notion client was called
        mock_notion.return_value.update_page_status.assert_called()
        mock_notion.return_value.add_content_blocks.assert_called()

    def test_cli_integration(self, temp_env):
        """Test CLI integration with mocked components"""
        with patch('sys.argv', ['script', '--file-ids', 'test1,test2', '--dry-run']), \
             patch('drive.gpt5_drive_processor.GPT5DriveProcessor') as mock_processor_class:

            mock_processor = Mock()
            mock_processor.process_batch.return_value = {
                "success": True,
                "dry_run": True,
                "file_count": 2
            }
            mock_processor_class.return_value = mock_processor

            from drive.gpt5_drive_processor import main

            exit_code = main()
            assert exit_code == 0
            mock_processor.process_batch.assert_called_once()


@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Set up test environment"""
    # Ensure test directories exist
    test_dirs = [
        "/workspaces/knowledge-pipeline/logs",
        "/workspaces/knowledge-pipeline/results",
        "/workspaces/knowledge-pipeline/.drive_status"
    ]

    for dir_path in test_dirs:
        Path(dir_path).mkdir(parents=True, exist_ok=True)

    yield

    # Cleanup test artifacts
    test_artifacts = [
        "/workspaces/knowledge-pipeline/logs/test_*.log",
        "/workspaces/knowledge-pipeline/results/test_*.json",
        "/workspaces/knowledge-pipeline/.drive_status/test_*.db"
    ]

    import glob
    for pattern in test_artifacts:
        for file_path in glob.glob(pattern):
            Path(file_path).unlink(missing_ok=True)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])