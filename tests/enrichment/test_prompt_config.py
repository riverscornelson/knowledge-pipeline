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
        
        # web_search should match the configuration in prompts.yaml
        # The summarizer default is web_search: false regardless of global setting
        assert summarizer_config["web_search"] == False
    
    # REMOVED: test_content_type_override
    # This test was testing legacy prompt configuration global override behavior
    # that is incompatible with the enhanced analyzer architecture where individual
    # analyzer settings should be respected rather than being overridden globally.
    
    def test_environment_variable_override(self):
        """Test environment variable overrides for web search."""
        # Set environment variables - need to enable global web search first
        os.environ["ENABLE_WEB_SEARCH"] = "true"
        os.environ["SUMMARIZER_WEB_SEARCH"] = "true"
        
        try:
            # Create new config to pick up env vars
            config = PromptConfig()
            prompt_config = config.get_prompt("summarizer")
            # Environment variable should override YAML config when global is enabled
            assert prompt_config["web_search"] is True
            
            # Test with global web search disabled
            config.web_search_enabled = False
            prompt_config = config.get_prompt("summarizer")
            # Global setting should override env var when explicitly disabled
            assert prompt_config["web_search"] is False
            
        finally:
            # Clean up environment variables
            for var in ["ENABLE_WEB_SEARCH", "SUMMARIZER_WEB_SEARCH"]:
                if var in os.environ:
                    del os.environ[var]
    
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