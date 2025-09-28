"""
Enhanced Error Handling and Retry Logic for GPT-5 Drive Processing
Provides robust error handling with exponential backoff, circuit breakers, and monitoring
"""

import time
import logging
import traceback
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable, Type
from enum import Enum
from dataclasses import dataclass
from functools import wraps
import json

from googleapiclient.errors import HttpError
from notion_client.errors import NotionClientError, APIResponseError, RequestTimeoutError
from utils.logging import setup_logger


class ErrorCategory(Enum):
    """Error categorization for handling strategies"""
    TRANSIENT = "transient"           # Temporary issues, safe to retry
    RATE_LIMIT = "rate_limit"         # API rate limiting
    AUTHENTICATION = "authentication" # Auth/permission issues
    NOT_FOUND = "not_found"          # Resource not found
    VALIDATION = "validation"         # Data validation errors
    QUOTA_EXCEEDED = "quota_exceeded" # Quota/limit exceeded
    NETWORK = "network"              # Network connectivity issues
    SYSTEM = "system"                # System/infrastructure errors
    UNKNOWN = "unknown"              # Unclassified errors


class RetryStrategy(Enum):
    """Retry strategy types"""
    EXPONENTIAL_BACKOFF = "exponential_backoff"
    LINEAR_BACKOFF = "linear_backoff"
    FIXED_DELAY = "fixed_delay"
    NO_RETRY = "no_retry"


@dataclass
class ErrorPattern:
    """Error pattern configuration"""
    error_types: List[Type[Exception]]
    keywords: List[str]
    category: ErrorCategory
    retry_strategy: RetryStrategy
    max_retries: int
    base_delay: float
    description: str


@dataclass
class RetryConfig:
    """Retry configuration for specific operations"""
    max_retries: int = 3
    base_delay: float = 1.0
    max_delay: float = 300.0
    backoff_multiplier: float = 2.0
    jitter: bool = True


@dataclass
class CircuitBreakerConfig:
    """Circuit breaker configuration"""
    failure_threshold: int = 5
    recovery_timeout: float = 60.0
    half_open_max_calls: int = 3


class CircuitBreakerState(Enum):
    """Circuit breaker states"""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Blocking calls due to failures
    HALF_OPEN = "half_open" # Testing if service has recovered


class CircuitBreaker:
    """Circuit breaker implementation for API calls"""

    def __init__(self, config: CircuitBreakerConfig, name: str = "default"):
        self.config = config
        self.name = name
        self.state = CircuitBreakerState.CLOSED
        self.failure_count = 0
        self.last_failure_time = None
        self.half_open_calls = 0
        self.logger = setup_logger(f"{__name__}.CircuitBreaker.{name}")

    def can_execute(self) -> bool:
        """Check if execution is allowed"""
        if self.state == CircuitBreakerState.CLOSED:
            return True
        elif self.state == CircuitBreakerState.OPEN:
            if self._should_attempt_reset():
                self.state = CircuitBreakerState.HALF_OPEN
                self.half_open_calls = 0
                self.logger.info(f"Circuit breaker {self.name}: Transitioning to HALF_OPEN")
                return True
            return False
        else:  # HALF_OPEN
            return self.half_open_calls < self.config.half_open_max_calls

    def record_success(self):
        """Record successful execution"""
        if self.state == CircuitBreakerState.HALF_OPEN:
            self.state = CircuitBreakerState.CLOSED
            self.failure_count = 0
            self.logger.info(f"Circuit breaker {self.name}: Transitioning to CLOSED (recovered)")
        else:
            self.failure_count = max(0, self.failure_count - 1)

    def record_failure(self):
        """Record failed execution"""
        self.failure_count += 1
        self.last_failure_time = datetime.now()

        if self.state == CircuitBreakerState.HALF_OPEN:
            self.state = CircuitBreakerState.OPEN
            self.logger.warning(f"Circuit breaker {self.name}: Transitioning to OPEN (recovery failed)")
        elif self.state == CircuitBreakerState.CLOSED and self.failure_count >= self.config.failure_threshold:
            self.state = CircuitBreakerState.OPEN
            self.logger.error(f"Circuit breaker {self.name}: Transitioning to OPEN (threshold reached)")

        if self.state == CircuitBreakerState.HALF_OPEN:
            self.half_open_calls += 1

    def _should_attempt_reset(self) -> bool:
        """Check if we should attempt to reset from OPEN state"""
        if not self.last_failure_time:
            return True

        time_since_failure = datetime.now() - self.last_failure_time
        return time_since_failure.total_seconds() >= self.config.recovery_timeout


class DriveErrorHandler:
    """
    Enhanced error handling system for GPT-5 Drive processing.

    Features:
    - Intelligent error categorization
    - Configurable retry strategies
    - Circuit breaker pattern
    - Error pattern analysis
    - Metrics collection
    """

    def __init__(self):
        self.logger = setup_logger(__name__)

        # Error patterns for categorization
        self.error_patterns = self._define_error_patterns()

        # Circuit breakers for different services
        self.circuit_breakers = {
            "drive_api": CircuitBreaker(CircuitBreakerConfig(failure_threshold=5, recovery_timeout=60), "drive_api"),
            "notion_api": CircuitBreaker(CircuitBreakerConfig(failure_threshold=3, recovery_timeout=30), "notion_api"),
            "gpt_api": CircuitBreaker(CircuitBreakerConfig(failure_threshold=3, recovery_timeout=120), "gpt_api")
        }

        # Error metrics
        self.error_metrics = {
            "total_errors": 0,
            "errors_by_category": {},
            "errors_by_service": {},
            "retry_attempts": 0,
            "circuit_breaker_trips": 0
        }

        self.logger.info("🛡️ Drive Error Handler initialized with enhanced retry logic")

    def _define_error_patterns(self) -> List[ErrorPattern]:
        """Define error patterns for categorization"""
        return [
            # Google Drive API errors
            ErrorPattern(
                error_types=[HttpError],
                keywords=["quotaExceeded", "userRateLimitExceeded"],
                category=ErrorCategory.RATE_LIMIT,
                retry_strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
                max_retries=5,
                base_delay=2.0,
                description="Google Drive rate limiting"
            ),
            ErrorPattern(
                error_types=[HttpError],
                keywords=["forbidden", "insufficientPermissions"],
                category=ErrorCategory.AUTHENTICATION,
                retry_strategy=RetryStrategy.NO_RETRY,
                max_retries=0,
                base_delay=0,
                description="Google Drive authentication/permission error"
            ),
            ErrorPattern(
                error_types=[HttpError],
                keywords=["notFound", "fileNotFound"],
                category=ErrorCategory.NOT_FOUND,
                retry_strategy=RetryStrategy.LINEAR_BACKOFF,
                max_retries=2,
                base_delay=1.0,
                description="Google Drive file not found"
            ),
            ErrorPattern(
                error_types=[HttpError],
                keywords=["internalError", "backendError"],
                category=ErrorCategory.TRANSIENT,
                retry_strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
                max_retries=3,
                base_delay=2.0,
                description="Google Drive internal server error"
            ),

            # Notion API errors
            ErrorPattern(
                error_types=[APIResponseError],
                keywords=["rate_limited"],
                category=ErrorCategory.RATE_LIMIT,
                retry_strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
                max_retries=5,
                base_delay=3.0,
                description="Notion API rate limiting"
            ),
            ErrorPattern(
                error_types=[RequestTimeoutError],
                keywords=["timeout"],
                category=ErrorCategory.NETWORK,
                retry_strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
                max_retries=3,
                base_delay=1.0,
                description="Notion API timeout"
            ),
            ErrorPattern(
                error_types=[NotionClientError],
                keywords=["unauthorized", "invalid_token"],
                category=ErrorCategory.AUTHENTICATION,
                retry_strategy=RetryStrategy.NO_RETRY,
                max_retries=0,
                base_delay=0,
                description="Notion authentication error"
            ),
            ErrorPattern(
                error_types=[NotionClientError],
                keywords=["validation_error", "invalid_request"],
                category=ErrorCategory.VALIDATION,
                retry_strategy=RetryStrategy.NO_RETRY,
                max_retries=0,
                base_delay=0,
                description="Notion data validation error"
            ),

            # Network and system errors
            ErrorPattern(
                error_types=[ConnectionError, TimeoutError],
                keywords=["connection", "timeout", "network"],
                category=ErrorCategory.NETWORK,
                retry_strategy=RetryStrategy.EXPONENTIAL_BACKOFF,
                max_retries=3,
                base_delay=2.0,
                description="Network connectivity error"
            ),
            ErrorPattern(
                error_types=[Exception],
                keywords=["memory", "system", "resource"],
                category=ErrorCategory.SYSTEM,
                retry_strategy=RetryStrategy.LINEAR_BACKOFF,
                max_retries=2,
                base_delay=5.0,
                description="System resource error"
            )
        ]

    def categorize_error(self, error: Exception) -> ErrorCategory:
        """Categorize error based on type and message"""
        error_str = str(error).lower()
        error_type = type(error)

        for pattern in self.error_patterns:
            # Check error type match
            if any(isinstance(error, err_type) for err_type in pattern.error_types):
                # Check keyword match
                if any(keyword.lower() in error_str for keyword in pattern.keywords):
                    return pattern.category

            # For HttpError, also check the response content
            if isinstance(error, HttpError):
                try:
                    error_content = error.content.decode('utf-8').lower()
                    if any(keyword.lower() in error_content for keyword in pattern.keywords):
                        return pattern.category
                except:
                    pass

        return ErrorCategory.UNKNOWN

    def get_retry_config(self, error: Exception, service: str = "default") -> RetryConfig:
        """Get retry configuration for specific error and service"""
        category = self.categorize_error(error)

        # Find matching pattern
        for pattern in self.error_patterns:
            if any(isinstance(error, err_type) for err_type in pattern.error_types):
                error_str = str(error).lower()
                if any(keyword.lower() in error_str for keyword in pattern.keywords):
                    return RetryConfig(
                        max_retries=pattern.max_retries,
                        base_delay=pattern.base_delay,
                        backoff_multiplier=2.0 if pattern.retry_strategy == RetryStrategy.EXPONENTIAL_BACKOFF else 1.0
                    )

        # Default configs by category
        default_configs = {
            ErrorCategory.RATE_LIMIT: RetryConfig(max_retries=5, base_delay=3.0, backoff_multiplier=2.0),
            ErrorCategory.TRANSIENT: RetryConfig(max_retries=3, base_delay=1.0, backoff_multiplier=2.0),
            ErrorCategory.NETWORK: RetryConfig(max_retries=3, base_delay=2.0, backoff_multiplier=2.0),
            ErrorCategory.SYSTEM: RetryConfig(max_retries=2, base_delay=5.0, backoff_multiplier=1.5),
            ErrorCategory.AUTHENTICATION: RetryConfig(max_retries=0, base_delay=0),
            ErrorCategory.VALIDATION: RetryConfig(max_retries=0, base_delay=0),
            ErrorCategory.NOT_FOUND: RetryConfig(max_retries=1, base_delay=1.0, backoff_multiplier=1.0),
            ErrorCategory.UNKNOWN: RetryConfig(max_retries=1, base_delay=2.0, backoff_multiplier=1.0)
        }

        return default_configs.get(category, RetryConfig())

    def with_retry(self, service: str = "default"):
        """Decorator for adding retry logic to functions"""
        def decorator(func: Callable):
            @wraps(func)
            def wrapper(*args, **kwargs):
                return self.execute_with_retry(func, service, *args, **kwargs)
            return wrapper
        return decorator

    def execute_with_retry(self, func: Callable, service: str, *args, **kwargs) -> Any:
        """Execute function with retry logic and circuit breaker"""
        circuit_breaker = self.circuit_breakers.get(service)

        # Check circuit breaker
        if circuit_breaker and not circuit_breaker.can_execute():
            raise Exception(f"Circuit breaker {service} is OPEN - service unavailable")

        last_exception = None
        retry_count = 0

        while True:
            try:
                result = func(*args, **kwargs)

                # Record success
                if circuit_breaker:
                    circuit_breaker.record_success()

                # Log successful retry
                if retry_count > 0:
                    self.logger.info(f"✅ Operation succeeded after {retry_count} retries: {func.__name__}")

                return result

            except Exception as e:
                last_exception = e
                category = self.categorize_error(e)
                retry_config = self.get_retry_config(e, service)

                # Update metrics
                self.error_metrics["total_errors"] += 1
                self.error_metrics["errors_by_category"][category.value] = \
                    self.error_metrics["errors_by_category"].get(category.value, 0) + 1
                self.error_metrics["errors_by_service"][service] = \
                    self.error_metrics["errors_by_service"].get(service, 0) + 1

                # Record failure in circuit breaker
                if circuit_breaker:
                    circuit_breaker.record_failure()
                    if circuit_breaker.state == CircuitBreakerState.OPEN:
                        self.error_metrics["circuit_breaker_trips"] += 1

                # Check if we should retry
                if retry_count >= retry_config.max_retries:
                    self.logger.error(f"❌ Max retries ({retry_config.max_retries}) exceeded for {func.__name__}: {e}")
                    break

                # Calculate delay
                delay = self._calculate_delay(retry_config, retry_count)

                self.logger.warning(
                    f"⚠️ Retry {retry_count + 1}/{retry_config.max_retries} for {func.__name__} "
                    f"(category: {category.value}, delay: {delay:.1f}s): {e}"
                )

                retry_count += 1
                self.error_metrics["retry_attempts"] += 1

                # Wait before retry
                time.sleep(delay)

        # If we get here, all retries failed
        raise last_exception

    def _calculate_delay(self, config: RetryConfig, retry_count: int) -> float:
        """Calculate delay for retry attempt"""
        if config.backoff_multiplier == 1.0:
            # Linear backoff
            delay = config.base_delay * (retry_count + 1)
        else:
            # Exponential backoff
            delay = config.base_delay * (config.backoff_multiplier ** retry_count)

        # Apply maximum delay limit
        delay = min(delay, config.max_delay)

        # Add jitter if enabled
        if config.jitter:
            import random
            jitter = random.uniform(0.1, 0.3) * delay
            delay += jitter

        return delay

    def handle_batch_errors(self, errors: List[tuple], operation: str) -> Dict[str, Any]:
        """Handle and analyze batch processing errors"""
        error_summary = {
            "total_errors": len(errors),
            "by_category": {},
            "by_type": {},
            "retryable_errors": [],
            "non_retryable_errors": [],
            "recommendations": []
        }

        for i, (item_id, error) in enumerate(errors):
            category = self.categorize_error(error)
            error_type = type(error).__name__

            # Count by category and type
            error_summary["by_category"][category.value] = \
                error_summary["by_category"].get(category.value, 0) + 1
            error_summary["by_type"][error_type] = \
                error_summary["by_type"].get(error_type, 0) + 1

            # Categorize as retryable or not
            retry_config = self.get_retry_config(error)
            if retry_config.max_retries > 0:
                error_summary["retryable_errors"].append({
                    "item_id": item_id,
                    "error": str(error),
                    "category": category.value,
                    "recommended_delay": retry_config.base_delay
                })
            else:
                error_summary["non_retryable_errors"].append({
                    "item_id": item_id,
                    "error": str(error),
                    "category": category.value
                })

        # Generate recommendations
        error_summary["recommendations"] = self._generate_recommendations(error_summary)

        # Log summary
        self.logger.warning(f"📊 Batch operation '{operation}' errors summary: {json.dumps(error_summary, indent=2)}")

        return error_summary

    def _generate_recommendations(self, error_summary: Dict[str, Any]) -> List[str]:
        """Generate recommendations based on error patterns"""
        recommendations = []

        # Rate limiting recommendations
        if error_summary["by_category"].get("rate_limit", 0) > 0:
            recommendations.append("Consider reducing batch size or increasing delays between requests")
            recommendations.append("Implement more aggressive rate limiting to prevent API quota exhaustion")

        # Authentication recommendations
        if error_summary["by_category"].get("authentication", 0) > 0:
            recommendations.append("Check API credentials and permissions")
            recommendations.append("Verify service account has necessary access to resources")

        # Network recommendations
        if error_summary["by_category"].get("network", 0) > 0:
            recommendations.append("Check network connectivity and firewall settings")
            recommendations.append("Consider implementing connection pooling and keep-alive")

        # System recommendations
        if error_summary["by_category"].get("system", 0) > 0:
            recommendations.append("Monitor system resources (memory, CPU, disk)")
            recommendations.append("Consider scaling up processing resources")

        return recommendations

    def get_error_metrics(self) -> Dict[str, Any]:
        """Get current error metrics"""
        # Add circuit breaker states
        circuit_breaker_states = {
            name: {
                "state": cb.state.value,
                "failure_count": cb.failure_count,
                "last_failure": cb.last_failure_time.isoformat() if cb.last_failure_time else None
            }
            for name, cb in self.circuit_breakers.items()
        }

        return {
            **self.error_metrics,
            "circuit_breakers": circuit_breaker_states,
            "generated_at": datetime.now().isoformat()
        }

    def reset_circuit_breaker(self, service: str) -> bool:
        """Manually reset a circuit breaker"""
        if service in self.circuit_breakers:
            cb = self.circuit_breakers[service]
            cb.state = CircuitBreakerState.CLOSED
            cb.failure_count = 0
            cb.last_failure_time = None
            self.logger.info(f"🔄 Circuit breaker {service} manually reset")
            return True
        return False

    def export_error_report(self, output_path: Optional[str] = None) -> str:
        """Export comprehensive error analysis report"""
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = f"/workspaces/knowledge-pipeline/results/error_analysis_report_{timestamp}.json"

        report = {
            "generated_at": datetime.now().isoformat(),
            "metrics": self.get_error_metrics(),
            "error_patterns": [
                {
                    "category": pattern.category.value,
                    "retry_strategy": pattern.retry_strategy.value,
                    "max_retries": pattern.max_retries,
                    "description": pattern.description
                }
                for pattern in self.error_patterns
            ],
            "recommendations": self._generate_global_recommendations()
        }

        with open(output_path, 'w') as f:
            json.dump(report, f, indent=2, default=str)

        self.logger.info(f"📄 Error analysis report exported to: {output_path}")
        return output_path

    def _generate_global_recommendations(self) -> List[str]:
        """Generate global recommendations based on overall error patterns"""
        recommendations = []

        metrics = self.error_metrics
        total_errors = metrics["total_errors"]

        if total_errors == 0:
            return ["No errors recorded - system is operating smoothly"]

        # High error rate
        if total_errors > 100:
            recommendations.append("High error rate detected - consider implementing more robust error prevention")

        # Circuit breaker trips
        if metrics["circuit_breaker_trips"] > 0:
            recommendations.append("Circuit breakers have triggered - investigate underlying service issues")

        # Retry efficiency
        retry_ratio = metrics["retry_attempts"] / total_errors if total_errors > 0 else 0
        if retry_ratio > 2:
            recommendations.append("High retry ratio - consider adjusting retry strategies or fixing root causes")

        return recommendations


# Convenience functions for common operations
def with_drive_retry(func):
    """Decorator for Drive API operations with appropriate retry logic"""
    handler = DriveErrorHandler()
    return handler.with_retry("drive_api")(func)


def with_notion_retry(func):
    """Decorator for Notion API operations with appropriate retry logic"""
    handler = DriveErrorHandler()
    return handler.with_retry("notion_api")(func)


def with_gpt_retry(func):
    """Decorator for GPT API operations with appropriate retry logic"""
    handler = DriveErrorHandler()
    return handler.with_retry("gpt_api")(func)