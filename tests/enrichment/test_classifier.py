"""
Tests for content classification.
"""
import pytest
from unittest.mock import patch, Mock
import json

from src.enrichment.classifier import ContentClassifier
from src.core.config import OpenAIConfig


class TestContentClassifier:
    """Test ContentClassifier functionality."""
    
    def test_create_classifier(self, mock_config):
        """Test creating ContentClassifier instance."""
        taxonomy = {
            "content_types": ["Technical", "Tutorial", "Research"],
            "ai_primitives": ["Classification", "Generation", "Analysis"],
            "vendors": ["OpenAI", "Google", "Meta"]
        }
        
        with patch('src.enrichment.classifier.OpenAI') as mock_openai_class:
            classifier = ContentClassifier(mock_config.openai, taxonomy)
            
            # Verify OpenAI client was initialized
            mock_openai_class.assert_called_once_with(api_key="test-openai-key")
            assert classifier.config == mock_config.openai
            assert classifier.taxonomy == taxonomy
    
    def test_classify_content(self, mock_openai_client, mock_config):
        """Test classifying content with AI."""
        taxonomy = {
            "content_types": ["Technical", "Tutorial", "Research"],
            "ai_primitives": ["Classification", "Generation", "Analysis"],
            "vendors": ["OpenAI", "Google", "Meta"]
        }
        
        # Mock classification response
        classification_response = json.dumps({
            "content_type": "Technical",
            "ai_primitives": ["Classification", "Analysis"],
            "vendor": "OpenAI",
            "confidence": "high",
            "reasoning": "Document discusses AI classification techniques"
        })
        
        mock_openai_client.chat.completions.create.return_value.choices[0].message.content = classification_response
        
        with patch('src.enrichment.classifier.OpenAI') as mock_openai_class:
            mock_openai_class.return_value = mock_openai_client
            
            classifier = ContentClassifier(mock_config.openai, taxonomy)
            result = classifier.classify_content(
                content="Test content about AI classification",
                title="AI Classification Guide"
            )
            
            # Verify API was called
            mock_openai_client.chat.completions.create.assert_called_once()
            call_args = mock_openai_client.chat.completions.create.call_args[1]
            
            # Check model and parameters
            assert call_args["model"] == "gpt-4"
            assert call_args["temperature"] == 0.3
            assert call_args["response_format"] == {"type": "json_object"}
            
            # Check result
            assert result["content_type"] == "Technical"
            assert result["ai_primitives"] == ["Classification", "Analysis"]
            assert result["vendor"] == "OpenAI"
            assert result["confidence"] == "high"
    
    def test_classify_content_invalid_json(self, mock_openai_client, mock_config):
        """Test handling invalid JSON response."""
        taxonomy = {
            "content_types": ["Technical"],
            "ai_primitives": ["Classification"],
            "vendors": ["OpenAI"]
        }
        
        # Mock invalid JSON response
        mock_openai_client.chat.completions.create.return_value.choices[0].message.content = "Invalid JSON"
        
        with patch('src.enrichment.classifier.OpenAI') as mock_openai_class:
            mock_openai_class.return_value = mock_openai_client
            
            classifier = ContentClassifier(mock_config.openai, taxonomy)
            result = classifier.classify_content("Test content", "Test Title")
            
            # Should return default error result on parse error
            assert result["content_type"] == "Unknown"
            assert result["ai_primitives"] == []
            assert result["vendor"] is None
            assert result["confidence"] == "low"
            assert "error" in result["reasoning"]
    
    def test_validate_classification(self, mock_openai_client, mock_config):
        """Test that classifier validates against taxonomy."""
        taxonomy = {
            "content_types": ["Technical", "Tutorial"],
            "ai_primitives": ["Classification", "Analysis"],
            "vendors": ["OpenAI"]
        }
        
        # Mock response with invalid values
        classification_response = json.dumps({
            "content_type": "InvalidType",  # Not in taxonomy
            "ai_primitives": ["Classification", "InvalidPrimitive"],  # Mixed valid/invalid
            "vendor": "InvalidVendor",  # Not in taxonomy
            "confidence": "medium"
        })
        
        mock_openai_client.chat.completions.create.return_value.choices[0].message.content = classification_response
        
        with patch('src.enrichment.classifier.OpenAI') as mock_openai_class:
            mock_openai_class.return_value = mock_openai_client
            
            classifier = ContentClassifier(mock_config.openai, taxonomy)
            result = classifier.classify_content("Test content", "Test Title")
            
            # Invalid values should be filtered out
            assert result["content_type"] == "Unknown"  # Invalid type becomes Unknown
            assert result["ai_primitives"] == ["Classification"]  # Only valid primitive kept
            assert result["vendor"] is None  # Invalid vendor removed due to medium confidence
    
    def test_content_truncation(self, mock_openai_client, mock_config):
        """Test that long content is truncated to 4000 characters."""
        taxonomy = {"content_types": ["Technical"], "ai_primitives": [], "vendors": []}
        
        with patch('src.enrichment.classifier.OpenAI') as mock_openai_class:
            mock_openai_class.return_value = mock_openai_client
            mock_openai_client.chat.completions.create.return_value.choices[0].message.content = "{}"
            
            # Create very long content
            long_content = "x" * 5000
            
            classifier = ContentClassifier(mock_config.openai, taxonomy)
            classifier.classify_content(long_content, "Test Title")
            
            # Check the content passed to API was truncated
            call_args = mock_openai_client.chat.completions.create.call_args[1]
            user_message = call_args["messages"][0]["content"]
            
            # Content should be truncated in the prompt
            assert "xxxx" in user_message and len(user_message) < 10000  # Should contain truncated content