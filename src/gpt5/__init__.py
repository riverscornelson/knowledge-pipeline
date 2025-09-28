"""
GPT-5 Enhanced Processing Module
High-performance content processing with GPT-5 optimization and status management
"""

# Status Management Components
from .status_manager import (
    StatusManager,
    ProcessingStage,
    ProcessingStatus,
    ProcessingError,
    ErrorSeverity,
    RetryStrategy,
    APIRateLimiter,
    with_status_tracking,
    get_status_manager
)

from .progress_reporter import (
    ProgressReporter,
    ProgressMetrics,
    CLIProgressHandler
)

from .error_recovery import (
    ErrorRecoveryManager,
    ErrorType,
    RetryConfig,
    ErrorClassifier,
    RecoveryStrategy,
    CircuitBreaker,
    get_error_recovery_manager
)

# GPT-5 Drive Processor
try:
    from .drive_processor import GPT5DriveProcessor, GPT5ProcessingResult, DriveDocument
    _has_drive_processor = True
except ImportError:
    _has_drive_processor = False

__all__ = [
    # Status Management
    'StatusManager',
    'ProcessingStage',
    'ProcessingStatus',
    'ProcessingError',
    'ErrorSeverity',
    'RetryStrategy',
    'APIRateLimiter',
    'with_status_tracking',
    'get_status_manager',

    # Progress Reporting
    'ProgressReporter',
    'ProgressMetrics',
    'CLIProgressHandler',

    # Error Recovery
    'ErrorRecoveryManager',
    'ErrorType',
    'RetryConfig',
    'ErrorClassifier',
    'RecoveryStrategy',
    'CircuitBreaker',
    'get_error_recovery_manager'
]

# Add existing components if available
if _has_drive_processor:
    __all__.extend(['GPT5DriveProcessor', 'GPT5ProcessingResult', 'DriveDocument'])