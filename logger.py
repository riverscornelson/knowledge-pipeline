"""
Enhanced logging module for knowledge pipeline
Provides structured JSON logging with performance metrics and API call tracking
"""
import logging
import json
import time
import os
from datetime import datetime
from typing import Dict, Any, Optional
from functools import wraps

# Configure structured logging
class StructuredFormatter(logging.Formatter):
    """JSON formatter for structured logging"""
    
    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        # Add extra fields if present
        if hasattr(record, 'extra_fields'):
            log_entry.update(record.extra_fields)
            
        return json.dumps(log_entry)

def setup_logger(name: str, level: str = "INFO") -> logging.Logger:
    """Setup structured logger for the pipeline"""
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper()))
    
    # Remove existing handlers to avoid duplicates
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
    
    # Console handler with structured formatting
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(StructuredFormatter())
    logger.addHandler(console_handler)
    
    # File handler for persistent logging
    log_dir = os.getenv("LOG_DIR", "logs")
    os.makedirs(log_dir, exist_ok=True)
    
    file_handler = logging.FileHandler(f"{log_dir}/pipeline.jsonl")
    file_handler.setFormatter(StructuredFormatter())
    logger.addHandler(file_handler)
    
    return logger

class PipelineMetrics:
    """Track pipeline performance metrics"""
    
    def __init__(self, logger: logging.Logger):
        self.logger = logger
        self.metrics = {
            "items_processed": 0,
            "items_failed": 0,
            "items_skipped": 0,
            "total_processing_time": 0,
            "api_calls": {
                "openai": {"count": 0, "total_time": 0, "total_tokens": 0},
                "notion": {"count": 0, "total_time": 0},
                "gmail": {"count": 0, "total_time": 0},
                "drive": {"count": 0, "total_time": 0}
            }
        }
        self.start_time = time.time()
    
    def increment_processed(self):
        self.metrics["items_processed"] += 1
        
    def increment_failed(self):
        self.metrics["items_failed"] += 1
        
    def increment_skipped(self):
        self.metrics["items_skipped"] += 1
    
    def add_processing_time(self, duration: float):
        self.metrics["total_processing_time"] += duration
    
    def track_api_call(self, service: str, duration: float, tokens: int = 0):
        """Track API call metrics"""
        if service in self.metrics["api_calls"]:
            self.metrics["api_calls"][service]["count"] += 1
            self.metrics["api_calls"][service]["total_time"] += duration
            if tokens > 0:
                self.metrics["api_calls"][service]["total_tokens"] += tokens
    
    def log_summary(self):
        """Log final metrics summary"""
        total_time = time.time() - self.start_time
        self.metrics["pipeline_duration"] = total_time
        
        self.logger.info("Pipeline execution completed", extra={
            "extra_fields": {
                "event_type": "pipeline_summary",
                "metrics": self.metrics
            }
        })

def track_performance(metrics: PipelineMetrics, item_type: str = "item"):
    """Decorator to track function performance"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            logger = logging.getLogger(func.__module__)
            
            try:
                logger.info(f"Starting {func.__name__}", extra={
                    "extra_fields": {
                        "event_type": "function_start",
                        "function": func.__name__,
                        "item_type": item_type
                    }
                })
                
                result = func(*args, **kwargs)
                
                duration = time.time() - start_time
                metrics.add_processing_time(duration)
                metrics.increment_processed()
                
                logger.info(f"Completed {func.__name__}", extra={
                    "extra_fields": {
                        "event_type": "function_complete",
                        "function": func.__name__,
                        "duration": duration,
                        "item_type": item_type,
                        "success": True
                    }
                })
                
                return result
                
            except Exception as e:
                duration = time.time() - start_time
                metrics.increment_failed()
                
                logger.error(f"Failed {func.__name__}: {str(e)}", extra={
                    "extra_fields": {
                        "event_type": "function_error",
                        "function": func.__name__,
                        "duration": duration,
                        "item_type": item_type,
                        "error": str(e),
                        "success": False
                    }
                })
                raise
                
        return wrapper
    return decorator

def track_api_call(metrics: PipelineMetrics, service: str):
    """Decorator to track API call performance"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            logger = logging.getLogger(func.__module__)
            
            try:
                logger.debug(f"API call to {service}", extra={
                    "extra_fields": {
                        "event_type": "api_call_start",
                        "service": service,
                        "function": func.__name__
                    }
                })
                
                result = func(*args, **kwargs)
                
                duration = time.time() - start_time
                tokens = 0
                
                # Extract token count for OpenAI calls
                if service == "openai" and hasattr(result, 'usage'):
                    tokens = result.usage.total_tokens
                
                metrics.track_api_call(service, duration, tokens)
                
                logger.debug(f"API call to {service} completed", extra={
                    "extra_fields": {
                        "event_type": "api_call_complete",
                        "service": service,
                        "function": func.__name__,
                        "duration": duration,
                        "tokens": tokens
                    }
                })
                
                return result
                
            except Exception as e:
                duration = time.time() - start_time
                
                logger.error(f"API call to {service} failed: {str(e)}", extra={
                    "extra_fields": {
                        "event_type": "api_call_error",
                        "service": service,
                        "function": func.__name__,
                        "duration": duration,
                        "error": str(e)
                    }
                })
                raise
                
        return wrapper
    return decorator