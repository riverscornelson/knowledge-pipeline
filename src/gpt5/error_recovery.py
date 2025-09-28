"""
Error Recovery and Retry Logic for GPT-5 Pipeline
Implements sophisticated error handling and recovery strategies.
"""

import time
import random
import logging
from typing import Dict, List, Optional, Callable, Any, Type
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import asyncio
from functools import wraps

from .status_manager import (
    StatusManager, ProcessingStage, ErrorSeverity,
    ProcessingError, RetryStrategy
)

logger = logging.getLogger(__name__)


class ErrorType(Enum):
    """Categories of errors in the pipeline."""
    NETWORK_ERROR = "network_error"
    API_RATE_LIMIT = "api_rate_limit"
    API_QUOTA_EXCEEDED = "api_quota_exceeded"
    AUTHENTICATION_ERROR = "authentication_error"
    VALIDATION_ERROR = "validation_error"
    PROCESSING_ERROR = "processing_error"
    NOTION_API_ERROR = "notion_api_error"
    CONTENT_ERROR = "content_error"
    TIMEOUT_ERROR = "timeout_error"
    UNKNOWN_ERROR = "unknown_error"


@dataclass
class RetryConfig:
    """Configuration for retry behavior."""
    max_retries: int = 3
    base_delay: float = 1.0
    max_delay: float = 60.0
    exponential_factor: float = 2.0
    jitter: bool = True
    retry_on_errors: List[ErrorType] = None
    no_retry_on_errors: List[ErrorType] = None

    def __post_init__(self):
        if self.retry_on_errors is None:
            self.retry_on_errors = [
                ErrorType.NETWORK_ERROR,
                ErrorType.API_RATE_LIMIT,
                ErrorType.TIMEOUT_ERROR,
                ErrorType.PROCESSING_ERROR
            ]

        if self.no_retry_on_errors is None:
            self.no_retry_on_errors = [
                ErrorType.AUTHENTICATION_ERROR,
                ErrorType.API_QUOTA_EXCEEDED,
                ErrorType.VALIDATION_ERROR
            ]


class ErrorClassifier:
    """Classifies errors and determines appropriate recovery strategies."""

    @staticmethod
    def classify_error(error: Exception) -> ErrorType:
        """Classify an error into appropriate category."""
        error_str = str(error).lower()
        error_type_name = type(error).__name__.lower()

        # Network and connection errors
        if any(term in error_str for term in ['connection', 'network', 'timeout', 'socket']):
            return ErrorType.NETWORK_ERROR

        # API rate limiting
        if any(term in error_str for term in ['rate limit', 'too many requests', '429']):
            return ErrorType.API_RATE_LIMIT

        # API quota
        if any(term in error_str for term in ['quota', 'billing', 'exceeded', '402', '403']):
            return ErrorType.API_QUOTA_EXCEEDED

        # Authentication
        if any(term in error_str for term in ['auth', 'unauthorized', '401', 'api key', 'token']):
            return ErrorType.AUTHENTICATION_ERROR

        # Validation errors
        if any(term in error_str for term in ['validation', 'invalid', 'malformed', 'schema']):
            return ErrorType.VALIDATION_ERROR

        # Notion API specific
        if any(term in error_str for term in ['notion', 'database', 'page not found']):
            return ErrorType.NOTION_API_ERROR

        # Content processing errors
        if any(term in error_str for term in ['content', 'parsing', 'format', 'encoding']):
            return ErrorType.CONTENT_ERROR

        # Timeout errors
        if 'timeout' in error_type_name or 'timeout' in error_str:
            return ErrorType.TIMEOUT_ERROR

        return ErrorType.UNKNOWN_ERROR

    @staticmethod
    def get_error_severity(error_type: ErrorType, retry_count: int = 0) -> ErrorSeverity:
        """Determine error severity based on type and retry count."""
        if error_type in [ErrorType.API_QUOTA_EXCEEDED, ErrorType.AUTHENTICATION_ERROR]:
            return ErrorSeverity.CRITICAL

        if error_type == ErrorType.VALIDATION_ERROR:
            return ErrorSeverity.HIGH

        if retry_count >= 3:
            return ErrorSeverity.HIGH

        if error_type in [ErrorType.NETWORK_ERROR, ErrorType.API_RATE_LIMIT]:
            return ErrorSeverity.LOW if retry_count < 2 else ErrorSeverity.MEDIUM

        return ErrorSeverity.MEDIUM


class RecoveryStrategy:
    """Implements recovery strategies for different error types."""

    def __init__(self, status_manager: StatusManager):
        self.status_manager = status_manager

    async def handle_rate_limit_error(self, content_id: str, error: Exception, retry_count: int) -> float:
        """Handle rate limit errors with exponential backoff."""
        base_delay = 60  # Start with 1 minute
        delay = min(base_delay * (2 ** retry_count), 300)  # Max 5 minutes

        logger.warning(f"Rate limit hit for {content_id}, waiting {delay}s (attempt {retry_count + 1})")
        return delay

    async def handle_network_error(self, content_id: str, error: Exception, retry_count: int) -> float:
        """Handle network errors with jittered exponential backoff."""
        base_delay = 2
        delay = min(base_delay * (2 ** retry_count), 30)  # Max 30 seconds

        # Add jitter to prevent thundering herd
        jitter = random.uniform(0.5, 1.5)
        delay *= jitter

        logger.warning(f"Network error for {content_id}, retrying in {delay:.1f}s (attempt {retry_count + 1})")
        return delay

    async def handle_processing_error(self, content_id: str, error: Exception, retry_count: int) -> float:
        """Handle processing errors with linear backoff."""
        delay = 5 * (retry_count + 1)  # 5, 10, 15 seconds

        logger.warning(f"Processing error for {content_id}, retrying in {delay}s (attempt {retry_count + 1})")
        return delay

    async def handle_notion_api_error(self, content_id: str, error: Exception, retry_count: int) -> float:
        """Handle Notion API errors."""
        if "rate" in str(error).lower():
            return await self.handle_rate_limit_error(content_id, error, retry_count)

        # Generic API error
        delay = 10 * (retry_count + 1)
        logger.warning(f"Notion API error for {content_id}, retrying in {delay}s (attempt {retry_count + 1})")
        return delay

    async def handle_critical_error(self, content_id: str, error: Exception) -> None:
        """Handle critical errors that should not be retried."""
        logger.error(f"Critical error for {content_id}: {error}")
        self.status_manager.mark_failed(content_id, {"critical_error": str(error)})

    async def get_recovery_delay(self, content_id: str, error: Exception,
                               error_type: ErrorType, retry_count: int) -> Optional[float]:
        """Get appropriate recovery delay for error type."""
        if error_type == ErrorType.API_RATE_LIMIT:
            return await self.handle_rate_limit_error(content_id, error, retry_count)

        elif error_type == ErrorType.NETWORK_ERROR:
            return await self.handle_network_error(content_id, error, retry_count)

        elif error_type == ErrorType.PROCESSING_ERROR:
            return await self.handle_processing_error(content_id, error, retry_count)

        elif error_type == ErrorType.NOTION_API_ERROR:
            return await self.handle_notion_api_error(content_id, error, retry_count)

        elif error_type in [ErrorType.AUTHENTICATION_ERROR, ErrorType.API_QUOTA_EXCEEDED]:
            await self.handle_critical_error(content_id, error)
            return None

        else:
            # Default handling
            delay = 5 * (retry_count + 1)
            logger.warning(f"Unknown error for {content_id}, retrying in {delay}s")
            return delay


class ErrorRecoveryManager:
    """Manages error recovery and retry logic for the pipeline."""

    def __init__(self, status_manager: StatusManager, retry_config: Optional[RetryConfig] = None):
        self.status_manager = status_manager
        self.retry_config = retry_config or RetryConfig()
        self.recovery_strategy = RecoveryStrategy(status_manager)
        self.error_classifier = ErrorClassifier()

    def should_retry(self, content_id: str, error: Exception, error_type: ErrorType,
                    retry_count: int) -> bool:
        """Determine if an error should be retried."""
        # Check max retries
        if retry_count >= self.retry_config.max_retries:
            logger.info(f"Max retries ({self.retry_config.max_retries}) reached for {content_id}")
            return False

        # Check if error type is in no-retry list
        if error_type in self.retry_config.no_retry_on_errors:
            logger.info(f"Error type {error_type.value} configured for no retry")
            return False

        # Check if error type is in retry list
        if error_type not in self.retry_config.retry_on_errors:
            logger.info(f"Error type {error_type.value} not configured for retry")
            return False

        # Check status manager
        if not self.status_manager.should_retry(content_id, self.retry_config.max_retries):
            logger.info(f"Status manager says no retry for {content_id}")
            return False

        return True

    async def handle_error(self, content_id: str, error: Exception, stage: ProcessingStage) -> bool:
        """
        Handle an error with appropriate recovery strategy.
        Returns True if retry should be attempted, False otherwise.
        """
        # Classify the error
        error_type = self.error_classifier.classify_error(error)

        # Get current retry count
        status = self.status_manager.get_status(content_id)
        retry_count = status.retry_count if status else 0

        # Determine severity
        severity = self.error_classifier.get_error_severity(error_type, retry_count)

        # Record the error
        self.status_manager.record_error(
            content_id=content_id,
            error=error,
            stage=stage,
            severity=severity,
            context={
                "error_type": error_type.value,
                "retry_count": retry_count,
                "recovery_attempted": True
            }
        )

        # Check if we should retry
        if not self.should_retry(content_id, error, error_type, retry_count):
            return False

        # Get recovery delay
        delay = await self.recovery_strategy.get_recovery_delay(
            content_id, error, error_type, retry_count
        )

        if delay is None:
            return False

        # Apply delay with jitter if configured
        if self.retry_config.jitter and delay > 0:
            jitter_factor = random.uniform(0.8, 1.2)
            delay *= jitter_factor

        # Wait for recovery delay
        if delay > 0:
            logger.info(f"Waiting {delay:.1f}s before retry for {content_id}")
            await asyncio.sleep(delay)

        # Increment retry count
        self.status_manager.increment_retry_count(content_id)

        logger.info(f"Retrying {content_id} after {error_type.value} (attempt {retry_count + 2})")
        return True

    def with_error_recovery(self, stage: ProcessingStage):
        """Decorator for automatic error recovery."""
        def decorator(func):
            @wraps(func)
            async def async_wrapper(self_obj, content_id: str, *args, **kwargs):
                while True:
                    try:
                        result = await func(self_obj, content_id, *args, **kwargs)
                        return result
                    except Exception as e:
                        should_retry = await self.handle_error(content_id, e, stage)
                        if not should_retry:
                            raise

            @wraps(func)
            def sync_wrapper(self_obj, content_id: str, *args, **kwargs):
                while True:
                    try:
                        result = func(self_obj, content_id, *args, **kwargs)
                        return result
                    except Exception as e:
                        # Convert to async for error handling
                        loop = asyncio.get_event_loop()
                        should_retry = loop.run_until_complete(
                            self.handle_error(content_id, e, stage)
                        )
                        if not should_retry:
                            raise

            # Return appropriate wrapper based on function type
            if asyncio.iscoroutinefunction(func):
                return async_wrapper
            else:
                return sync_wrapper

        return decorator


class CircuitBreaker:
    """Implements circuit breaker pattern for error handling."""

    def __init__(self, failure_threshold: int = 5, recovery_timeout: float = 60.0):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.state = "closed"  # closed, open, half_open

    def call(self, func: Callable, *args, **kwargs):
        """Execute function with circuit breaker protection."""
        if self.state == "open":
            if self._should_attempt_reset():
                self.state = "half_open"
            else:
                raise Exception("Circuit breaker is open")

        try:
            result = func(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise

    def _should_attempt_reset(self) -> bool:
        """Check if circuit breaker should attempt reset."""
        if not self.last_failure_time:
            return True

        return (datetime.now() - self.last_failure_time).total_seconds() > self.recovery_timeout

    def _on_success(self):
        """Handle successful call."""
        self.failure_count = 0
        self.state = "closed"

    def _on_failure(self):
        """Handle failed call."""
        self.failure_count += 1
        self.last_failure_time = datetime.now()

        if self.failure_count >= self.failure_threshold:
            self.state = "open"
            logger.warning(f"Circuit breaker opened after {self.failure_count} failures")


# Global error recovery manager instance
_error_recovery_manager = None

def get_error_recovery_manager(status_manager: Optional[StatusManager] = None) -> ErrorRecoveryManager:
    """Get the global error recovery manager instance."""
    global _error_recovery_manager
    if _error_recovery_manager is None:
        from .status_manager import get_status_manager
        sm = status_manager or get_status_manager()
        _error_recovery_manager = ErrorRecoveryManager(sm)
    return _error_recovery_manager