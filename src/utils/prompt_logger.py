"""Dedicated logger for AI prompts and responses.

This module provides specialized logging for OpenAI API interactions,
capturing full prompts, responses, and metadata for analysis and refinement.
"""

import json
import logging
import os
import time
from datetime import datetime
from typing import Any, Dict, Optional, Union
from pathlib import Path

from src.utils.logging import setup_logger


class PromptLogger:
    """Specialized logger for AI prompt/response pairs."""
    
    def __init__(self, log_dir: str = "logs", log_file: str = "prompts.jsonl"):
        """Initialize the prompt logger.
        
        Args:
            log_dir: Directory for log files
            log_file: Name of the prompt log file
        """
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(exist_ok=True)
        self.log_file = self.log_dir / log_file
        
        # Setup dedicated logger
        self.logger = logging.getLogger("prompt_logger")
        self.logger.setLevel(logging.INFO)
        
        # Create file handler for prompt logs
        file_handler = logging.FileHandler(self.log_file, mode="a")
        file_handler.setFormatter(logging.Formatter(
            '%(message)s'  # Just log the JSON message directly
        ))
        self.logger.addHandler(file_handler)
        
        # Prevent propagation to avoid duplicate logs
        self.logger.propagate = False
        
        # Configuration from environment
        self.enabled = os.getenv("PROMPT_LOGGING_ENABLED", "true").lower() == "true"
        self.log_level = os.getenv("PROMPT_LOG_LEVEL", "full")  # full, summary, minimal
        self.redact_pii = os.getenv("PROMPT_LOG_REDACT_PII", "false").lower() == "true"
        
    def log_api_call(
        self,
        prompt: Union[str, list],
        response: Any,
        model: str,
        api_type: str,  # "chat" or "responses"
        analyzer_name: str,
        source_id: str,
        duration: float,
        error: Optional[str] = None,
        **kwargs
    ) -> None:
        """Log a complete API call with prompt and response.
        
        Args:
            prompt: The prompt sent to the API (str or messages list)
            response: The API response object
            model: Model name used
            api_type: Type of API used ("chat" or "responses")
            analyzer_name: Name of the analyzer making the call
            source_id: ID of the source being processed
            duration: Time taken for the API call
            error: Error message if the call failed
            **kwargs: Additional metadata to log
        """
        if not self.enabled:
            return
            
        # Prepare log entry
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "analyzer": analyzer_name,
            "source_id": source_id,
            "model": model,
            "api_type": api_type,
            "duration_ms": round(duration * 1000, 2),
            "error": error,
            **kwargs
        }
        
        # Add prompt based on log level
        if self.log_level == "full":
            log_entry["prompt"] = prompt
        elif self.log_level == "summary" and isinstance(prompt, str):
            log_entry["prompt_preview"] = prompt[:500] + "..." if len(prompt) > 500 else prompt
        
        # Add response based on log level and API type
        if response and not error:
            if self.log_level == "full":
                if api_type == "chat":
                    log_entry["response"] = response.choices[0].message.content if hasattr(response, 'choices') else str(response)
                else:  # responses API
                    log_entry["response"] = response.parsed.model_dump() if hasattr(response, 'parsed') else str(response)
            elif self.log_level == "summary":
                # Just log key details
                if api_type == "chat" and hasattr(response, 'usage'):
                    log_entry["token_usage"] = {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens
                    }
        
        # Log to file as JSON
        self.logger.info(json.dumps(log_entry))
        
        # Also log summary to console if verbose
        if os.getenv("VERBOSE_PROMPT_LOGGING", "false").lower() == "true":
            self._print_console_summary(log_entry)
    
    def _print_console_summary(self, log_entry: Dict[str, Any]) -> None:
        """Print a formatted summary to console for real-time monitoring."""
        print(f"\n{'='*80}")
        print(f"🤖 AI PROMPT: {log_entry['analyzer']} for {log_entry['source_id']}")
        content_type = log_entry.get('content_type', 'default')
        print(f"   Model: {log_entry['model']} | API: {log_entry['api_type']} | Type: {content_type} | Duration: {log_entry['duration_ms']}ms")
        
        if log_entry.get("error"):
            print(f"   ❌ ERROR: {log_entry['error']}")
        else:
            if "prompt" in log_entry:
                prompt_preview = log_entry["prompt"]
                if isinstance(prompt_preview, str) and len(prompt_preview) > 200:
                    prompt_preview = prompt_preview[:200] + "..."
                print(f"   📝 Prompt: {prompt_preview}")
            
            if "response" in log_entry and isinstance(log_entry["response"], str):
                response_preview = log_entry["response"][:200] + "..." if len(log_entry["response"]) > 200 else log_entry["response"]
                print(f"   💬 Response: {response_preview}")
            
            if "token_usage" in log_entry:
                usage = log_entry["token_usage"]
                print(f"   📊 Tokens: {usage['total_tokens']} (prompt: {usage['prompt_tokens']}, completion: {usage['completion_tokens']})")
        
        print(f"{'='*80}\n")
    
    def get_prompts_for_analysis(
        self,
        analyzer_name: Optional[str] = None,
        model: Optional[str] = None,
        limit: int = 100
    ) -> list:
        """Read logged prompts for analysis and refinement.
        
        Args:
            analyzer_name: Filter by analyzer name
            model: Filter by model
            limit: Maximum number of entries to return
            
        Returns:
            List of prompt/response entries
        """
        if not self.log_file.exists():
            return []
        
        entries = []
        with open(self.log_file, 'r') as f:
            for line in f:
                try:
                    entry = json.loads(line.strip())
                    
                    # Apply filters
                    if analyzer_name and entry.get("analyzer") != analyzer_name:
                        continue
                    if model and entry.get("model") != model:
                        continue
                    
                    entries.append(entry)
                    
                    if len(entries) >= limit:
                        break
                        
                except json.JSONDecodeError:
                    continue
        
        return entries


# Singleton instance
prompt_logger = PromptLogger()