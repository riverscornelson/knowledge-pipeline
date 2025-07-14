"""
Tests for content summarization.
"""
import pytest
from unittest.mock import patch, Mock

from src.enrichment.summarizer import ContentSummarizer
from src.core.config import OpenAIConfig


class TestContentSummarizer:
    """Test ContentSummarizer functionality."""
    
    def test_create_summarizer(self, mock_config):
        """Test creating ContentSummarizer instance."""
        with patch('src.enrichment.summarizer.OpenAI') as mock_openai_class:
            summarizer = ContentSummarizer(mock_config.openai)
            
            # Verify OpenAI client was initialized
            mock_openai_class.assert_called_once_with(api_key="test-openai-key")
            assert summarizer.config == mock_config.openai
    
    def test_generate_summary(self, mock_openai_client, mock_config):
        """Test generating a summary for content."""
        # Mock the full summary response
        mock_response = """
# Document Summary

## Overview
This document discusses artificial intelligence and machine learning concepts.

## Detailed Summary
This is a comprehensive analysis of AI and ML technologies, covering neural networks,
deep learning applications, and natural language processing techniques. The document
provides practical examples and implementation details for modern AI systems.

## Key Takeaways
- Neural networks form the foundation of deep learning
- NLP has advanced significantly with transformer models
- Practical applications span multiple industries
"""
        
        mock_openai_client.chat.completions.create.return_value.choices[0].message.content = mock_response
        
        with patch('src.enrichment.summarizer.OpenAI') as mock_openai_class:
            mock_openai_class.return_value = mock_openai_client
            
            summarizer = ContentSummarizer(mock_config.openai)
            summary = summarizer.generate_summary(
                content="Test content about AI and machine learning",
                title="AI Research Paper"
            )
            
            # Verify API was called
            mock_openai_client.chat.completions.create.assert_called_once()
            call_args = mock_openai_client.chat.completions.create.call_args[1]
            
            # Check model and basic structure
            assert call_args["model"] == "gpt-4"
            assert len(call_args["messages"]) == 1  # Only user message, no system message
            
            # Check response
            assert "Document Summary" in summary
            assert "neural networks" in summary
    
    def test_generate_brief_summary(self, mock_openai_client, mock_config):
        """Test generating a brief summary from full summary."""
        # generate_brief_summary doesn't use API, remove mock
        
        with patch('src.enrichment.summarizer.OpenAI') as mock_openai_class:
            mock_openai_class.return_value = mock_openai_client
            
            full_summary = """
# Document Summary

## Overview
This document discusses AI and ML.

## Detailed Summary
Comprehensive analysis of AI technologies.
"""
            
            summarizer = ContentSummarizer(mock_config.openai)
            brief = summarizer.generate_brief_summary(full_summary)
            
            # generate_brief_summary doesn't call API, it extracts from full summary
            # It should extract first sentence from the summary section
            assert len(brief) <= 200
            assert "This document discusses AI and ML" in brief
    
    def test_content_truncation(self, mock_openai_client, mock_config):
        """Test that long content is truncated to 8000 characters."""
        with patch('src.enrichment.summarizer.OpenAI') as mock_openai_class:
            mock_openai_class.return_value = mock_openai_client
            
            # Create very long content
            long_content = "x" * 10000
            
            summarizer = ContentSummarizer(mock_config.openai)
            summarizer.generate_summary(long_content, "Test Title")
            
            # Check the content passed to API was truncated
            call_args = mock_openai_client.chat.completions.create.call_args[1]
            user_message = call_args["messages"][0]["content"]
            
            # Content should be truncated in the prompt
            assert "8000" in user_message or len(user_message) < 9000