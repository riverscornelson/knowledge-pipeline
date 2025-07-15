"""Tests for base analyzer with web search support."""
import pytest
from unittest.mock import Mock, patch, MagicMock
from src.enrichment.base_analyzer import BaseAnalyzer
from src.core.config import PipelineConfig
from src.core.prompt_config import PromptConfig


class ConcreteAnalyzer(BaseAnalyzer):
    """Concrete implementation for testing."""
    
    def _build_prompt(self, content: str, title: str, config: dict) -> str:
        return f"Analyze '{title}': {content[:100]}"
    
    def _get_default_system_prompt(self) -> str:
        return "You are a test analyzer."
    
    def _get_fallback_result(self, error_message: str) -> dict:
        return {
            "analysis": f"Test failed: {error_message}",
            "success": False,
            "web_search_used": False
        }


class TestBaseAnalyzer:
    """Test cases for BaseAnalyzer class."""
    
    @pytest.fixture
    def mock_config(self):
        """Create mock pipeline config."""
        config = Mock(spec=PipelineConfig)
        config.openai.api_key = "test-key"
        config.openai.model = "gpt-4"
        return config
    
    @pytest.fixture
    def mock_prompt_config(self):
        """Create mock prompt config."""
        prompt_config = Mock(spec=PromptConfig)
        prompt_config.web_search_enabled = True
        prompt_config.get_prompt.return_value = {
            "system": "Test system prompt",
            "temperature": 0.3,
            "web_search": True
        }
        return prompt_config
    
    def test_initialization(self, mock_config):
        """Test analyzer initialization."""
        analyzer = ConcreteAnalyzer(mock_config)
        assert analyzer.config == mock_config
        assert analyzer.prompt_config is not None
        assert hasattr(analyzer, 'client')
    
    @patch('src.enrichment.base_analyzer.OpenAI')
    def test_standard_analysis(self, mock_openai, mock_config, mock_prompt_config):
        """Test standard analysis without web search."""
        # Configure mocks
        mock_prompt_config.web_search_enabled = False
        mock_client = Mock()
        mock_openai.return_value = mock_client
        
        mock_completion = Mock()
        mock_completion.choices = [Mock(message=Mock(content="Test analysis result"))]
        mock_client.chat.completions.create.return_value = mock_completion
        
        # Create analyzer
        analyzer = ConcreteAnalyzer(mock_config, mock_prompt_config)
        
        # Perform analysis
        result = analyzer.analyze("Test content", "Test title")
        
        # Verify
        assert result["success"] is True
        assert result["analysis"] == "Test analysis result"
        assert result["web_search_used"] is False
        mock_client.chat.completions.create.assert_called_once()
    
    @patch('src.enrichment.base_analyzer.OpenAI')
    def test_web_search_analysis(self, mock_openai, mock_config, mock_prompt_config):
        """Test analysis with web search enabled."""
        # Configure mocks
        mock_client = Mock()
        mock_openai.return_value = mock_client
        
        # Mock Responses API
        mock_client.responses = Mock()
        mock_response = Mock()
        mock_response.output_text = "Web search analysis result"
        mock_client.responses.create.return_value = mock_response
        
        # Create analyzer
        analyzer = ConcreteAnalyzer(mock_config, mock_prompt_config)
        analyzer.has_responses_api = True
        
        # Perform analysis
        result = analyzer.analyze("Test content", "Test title", "research_paper")
        
        # Verify
        assert result["success"] is True
        assert result["analysis"] == "Web search analysis result"
        assert result["web_search_used"] is True
        mock_client.responses.create.assert_called_once()
    
    @patch('src.enrichment.base_analyzer.OpenAI')
    def test_web_search_fallback(self, mock_openai, mock_config, mock_prompt_config):
        """Test fallback to standard analysis when web search fails."""
        # Configure mocks
        mock_client = Mock()
        mock_openai.return_value = mock_client
        
        # Mock Responses API to fail
        mock_client.responses = Mock()
        mock_client.responses.create.side_effect = Exception("Web search failed")
        
        # Mock standard API
        mock_completion = Mock()
        mock_completion.choices = [Mock(message=Mock(content="Fallback analysis"))]
        mock_client.chat.completions.create.return_value = mock_completion
        
        # Create analyzer
        analyzer = ConcreteAnalyzer(mock_config, mock_prompt_config)
        analyzer.has_responses_api = True
        
        # Perform analysis
        result = analyzer.analyze("Test content", "Test title")
        
        # Verify fallback worked
        assert result["success"] is True
        assert result["analysis"] == "Fallback analysis"
        assert result["web_search_used"] is False
    
    def test_content_type_prompt_selection(self, mock_config, mock_prompt_config):
        """Test that content type affects prompt selection."""
        analyzer = ConcreteAnalyzer(mock_config, mock_prompt_config)
        
        # Analyze with content type
        analyzer.analyze("Content", "Title", "research_paper")
        
        # Verify prompt config was called with content type
        mock_prompt_config.get_prompt.assert_called_with(
            analyzer.analyzer_name, 
            "research_paper"
        )
    
    @patch('src.enrichment.base_analyzer.OpenAI')
    def test_error_handling(self, mock_openai, mock_config, mock_prompt_config):
        """Test error handling in analysis."""
        # Configure mocks to fail
        mock_client = Mock()
        mock_openai.return_value = mock_client
        mock_client.chat.completions.create.side_effect = Exception("API Error")
        
        # Disable web search to test standard error
        mock_prompt_config.web_search_enabled = False
        
        # Create analyzer
        analyzer = ConcreteAnalyzer(mock_config, mock_prompt_config)
        
        # Perform analysis
        result = analyzer.analyze("Test content", "Test title")
        
        # Verify error handling
        assert result["success"] is False
        assert "Test failed" in result["analysis"]
        assert result["web_search_used"] is False