"""Tests for prompt configuration management."""
import os
import pytest
from pathlib import Path
import tempfile
import yaml
from src.core.prompt_config import PromptConfig


class TestPromptConfig:
    """Test cases for PromptConfig class."""
    
    def test_default_initialization(self):
        """Test initialization with default settings."""
        config = PromptConfig()
        assert isinstance(config.prompts, dict)
        assert "defaults" in config.prompts
    
    def test_get_default_prompt(self):
        """Test retrieving default prompts."""
        config = PromptConfig()
        
        # Test summarizer prompt
        summarizer_config = config.get_prompt("summarizer")
        assert "system" in summarizer_config
        assert "temperature" in summarizer_config
        assert "web_search" in summarizer_config
        assert summarizer_config["temperature"] == 0.3
        
        # web_search depends on global ENABLE_WEB_SEARCH env var
        # If ENABLE_WEB_SEARCH is true, all web_search will be forced to match it
        expected_web_search = os.getenv("ENABLE_WEB_SEARCH", "false").lower() == "true"
        assert summarizer_config["web_search"] == expected_web_search
    
    def test_content_type_override(self):
        """Test content-type specific prompt overrides."""
        # Save current ENABLE_WEB_SEARCH value
        original_web_search = os.environ.get("ENABLE_WEB_SEARCH")
        
        # Create a test config file
        test_config = {
            "defaults": {
                "summarizer": {
                    "system": "Default summarizer prompt",
                    "temperature": 0.3,
                    "web_search": False
                }
            },
            "content_types": {
                "research_paper": {
                    "summarizer": {
                        "system": "Research paper prompt",
                        "temperature": 0.2,
                        "web_search": True
                    }
                }
            }
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            yaml.dump(test_config, f)
            temp_path = Path(f.name)
        
        try:
            # Test with web search disabled
            os.environ["ENABLE_WEB_SEARCH"] = "false"
            config = PromptConfig(temp_path)
            
            # Default prompt - web_search should be False (both from config and global)
            default_prompt = config.get_prompt("summarizer")
            assert default_prompt["system"] == "Default summarizer prompt"
            assert default_prompt["web_search"] is False
            
            # Research paper override - web_search should still be False due to global setting
            research_prompt = config.get_prompt("summarizer", "research_paper")
            assert research_prompt["system"] == "Research paper prompt"
            assert research_prompt["temperature"] == 0.2
            assert research_prompt["web_search"] is False  # Global setting overrides
            
            # Test with web search enabled
            os.environ["ENABLE_WEB_SEARCH"] = "true"
            config = PromptConfig(temp_path)
            
            # Default prompt - web_search should now be True (global overrides config False)
            default_prompt = config.get_prompt("summarizer")
            assert default_prompt["web_search"] is True
            
            # Research paper override - web_search should be True (both config and global)
            research_prompt = config.get_prompt("summarizer", "research_paper")
            assert research_prompt["web_search"] is True
            
        finally:
            temp_path.unlink()
            # Restore original value
            if original_web_search is not None:
                os.environ["ENABLE_WEB_SEARCH"] = original_web_search
            elif "ENABLE_WEB_SEARCH" in os.environ:
                del os.environ["ENABLE_WEB_SEARCH"]
    
    def test_environment_variable_override(self):
        """Test environment variable overrides for web search."""
        config = PromptConfig()
        
        # Set environment variable
        os.environ["SUMMARIZER_WEB_SEARCH"] = "true"
        
        try:
            prompt_config = config.get_prompt("summarizer")
            assert prompt_config["web_search"] is True
            
            # Test with global web search disabled
            config.web_search_enabled = False
            prompt_config = config.get_prompt("summarizer")
            assert prompt_config["web_search"] is False
            
        finally:
            del os.environ["SUMMARIZER_WEB_SEARCH"]
    
    def test_analyzer_enabled_check(self):
        """Test checking if analyzers are enabled."""
        config = PromptConfig()
        
        # Test with environment variable
        os.environ["ENABLE_TECHNICAL_ANALYSIS"] = "true"
        try:
            assert config.is_analyzer_enabled("technical") is True
        finally:
            del os.environ["ENABLE_TECHNICAL_ANALYSIS"]
        
        # Test with false
        os.environ["ENABLE_TECHNICAL_ANALYSIS"] = "false"
        try:
            assert config.is_analyzer_enabled("technical") is False
        finally:
            del os.environ["ENABLE_TECHNICAL_ANALYSIS"]
    
    def test_custom_analyzer_prompt(self):
        """Test retrieving custom analyzer prompts."""
        test_config = {
            "analyzers": {
                "technical": {
                    "default_prompt": "Custom technical prompt template"
                }
            }
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            yaml.dump(test_config, f)
            temp_path = Path(f.name)
        
        try:
            config = PromptConfig(temp_path)
            prompt = config.get_custom_analyzer_prompt("technical")
            assert prompt == "Custom technical prompt template"
            
            # Non-existent analyzer
            assert config.get_custom_analyzer_prompt("nonexistent") is None
            
        finally:
            temp_path.unlink()
    
    def test_normalize_analyzer_names(self):
        """Test that analyzer names are normalized correctly."""
        config = PromptConfig()
        
        # Test various name formats that should normalize to "summarizer"
        test_cases = [
            ("summarizer", "summarizer"),  # already normalized
            ("Summarizer", "summarizer"),  # case normalization
            ("SummarizerAnalyzer", "summarizer"),  # strip "analyzer"
            ("AdvancedSummarizer", "summarizer"),  # strip "advanced"
            ("ContentSummarizer", "summarizer"),  # strip "content"
            ("summarizer_analyzer", "summarizer"),  # strip "analyzer" with underscore
        ]
        
        for input_name, expected_normalized in test_cases:
            prompt_config = config.get_prompt(input_name)
            # Should get valid config with expected keys
            assert "system" in prompt_config, f"Failed for input: {input_name}"
            assert "temperature" in prompt_config, f"Failed for input: {input_name}"
            assert "web_search" in prompt_config, f"Failed for input: {input_name}"
            
        # Test a completely invalid analyzer name
        invalid_config = config.get_prompt("nonexistent_analyzer")
        # Should return empty dict for unknown analyzer
        assert invalid_config == {}