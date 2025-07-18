"""
Tests for the ContentTagger analyzer.
"""
import pytest
from unittest.mock import Mock, MagicMock, patch
from src.enrichment.content_tagger import ContentTagger
from src.core.config import PipelineConfig


class TestContentTagger:
    """Test cases for ContentTagger functionality."""
    
    @pytest.fixture
    def mock_config(self):
        """Create mock pipeline configuration."""
        config = Mock(spec=PipelineConfig)
        config.openai = Mock()
        config.openai.api_key = "test-key"
        return config
    
    @pytest.fixture
    def mock_notion_client(self):
        """Create mock Notion client."""
        client = Mock()
        client.get_multi_select_options = Mock()
        return client
    
    @pytest.fixture
    def content_tagger(self, mock_config, mock_notion_client):
        """Create ContentTagger instance with mocks."""
        with patch('src.enrichment.content_tagger.OpenAI'):
            tagger = ContentTagger(mock_config, mock_notion_client)
            return tagger
    
    def test_initialization(self, content_tagger):
        """Test ContentTagger initialization."""
        assert content_tagger is not None
        assert content_tagger._tag_cache == {"topical_tags": [], "domain_tags": []}
        assert content_tagger._items_processed == 0
        assert content_tagger._cache_refresh_interval == 10
    
    def test_validate_tag(self, content_tagger):
        """Test tag validation and formatting."""
        # Test normal tag
        assert content_tagger._validate_tag("machine learning") == "Machine Learning"
        
        # Test tag with extra spaces
        assert content_tagger._validate_tag("  data   science  ") == "Data Science"
        
        # Test tag with too many words
        assert content_tagger._validate_tag("this is a very long tag name") == "This Is A Very"
        
        # Test acronym handling
        assert content_tagger._validate_tag("ai and ml applications") == "AI And ML Applications"
        
        # Test empty tag
        assert content_tagger._validate_tag("") == ""
        assert content_tagger._validate_tag("   ") == ""
    
    def test_refresh_tag_cache(self, content_tagger, mock_notion_client):
        """Test tag cache refresh functionality."""
        # Mock Notion response
        mock_notion_client.get_multi_select_options.side_effect = [
            ["AI Research", "Machine Learning", "Data Science"],  # topical tags
            ["Technology", "Healthcare", "Finance"]  # domain tags
        ]
        
        # Refresh cache
        cache = content_tagger._refresh_tag_cache(force=True)
        
        # Verify results
        assert cache["topical_tags"] == ["AI Research", "Data Science", "Machine Learning"]  # sorted
        assert cache["domain_tags"] == ["Finance", "Healthcare", "Technology"]  # sorted
        
        # Verify Notion client was called correctly
        assert mock_notion_client.get_multi_select_options.call_count == 2
        mock_notion_client.get_multi_select_options.assert_any_call("Topical Tags")
        mock_notion_client.get_multi_select_options.assert_any_call("Domain Tags")
    
    def test_analyze_with_existing_tags(self, content_tagger, mock_notion_client):
        """Test analysis when existing tags match content."""
        # Setup mock cache
        content_tagger._tag_cache = {
            "topical_tags": ["AI Research", "Machine Learning", "Natural Language Processing"],
            "domain_tags": ["Technology", "Healthcare", "Finance"]
        }
        
        # Mock structured output response
        mock_completion = Mock()
        mock_message = Mock()
        mock_parsed = Mock()
        mock_parsed.topical_tags = ["AI Research", "Machine Learning", "Deep Learning"]
        mock_parsed.domain_tags = ["Technology", "Healthcare"]
        mock_parsed.tag_selection_reasoning = {
            "existing_tags_used": ["AI Research", "Machine Learning", "Technology", "Healthcare"],
            "new_tags_created": ["Deep Learning"],
            "considered_but_rejected": []
        }
        mock_parsed.confidence_scores = {
            "AI Research": 0.95,
            "Machine Learning": 0.90,
            "Deep Learning": 0.85,
            "Technology": 0.92,
            "Healthcare": 0.88
        }
        
        mock_message.parsed = mock_parsed
        mock_completion.choices = [Mock(message=mock_message)]
        
        with patch.object(content_tagger.structured_client.beta.chat.completions, 'parse', return_value=mock_completion):
            result = content_tagger.analyze(
                "This is content about AI and machine learning in healthcare.",
                "AI in Healthcare: A Review"
            )
        
        # Verify results
        assert result["success"] is True
        assert "AI Research" in result["topical_tags"]
        assert "Machine Learning" in result["topical_tags"]
        assert "Technology" in result["domain_tags"]
        assert "Healthcare" in result["domain_tags"]
        assert result["tag_selection_reasoning"]["existing_tags_used"] == [
            "AI Research", "Machine Learning", "Technology", "Healthcare"
        ]
        assert result["tag_selection_reasoning"]["new_tags_created"] == ["Deep Learning"]
    
    def test_fallback_on_error(self, content_tagger):
        """Test fallback behavior when analysis fails."""
        # Force an error in the analyze method
        with patch.object(content_tagger.structured_client.beta.chat.completions, 'parse', side_effect=Exception("API Error")):
            result = content_tagger.analyze("Test content", "Test title")
        
        # Verify fallback result
        assert result["success"] is False
        assert result["topical_tags"] == ["Content Analysis", "Knowledge Management"]
        assert result["domain_tags"] == ["General", "Technology"]
        assert "error" in result
        assert "API Error" in result["error"]
    
    def test_cache_refresh_interval(self, content_tagger, mock_notion_client):
        """Test that cache refreshes after processing interval."""
        # Setup initial cache
        content_tagger._tag_cache = {
            "topical_tags": ["Old Tag"],
            "domain_tags": ["Old Domain"]
        }
        content_tagger._items_processed = 9  # Just below refresh interval
        
        # Mock new tags from Notion
        mock_notion_client.get_multi_select_options.side_effect = [
            ["New Tag", "Updated Tag"],
            ["New Domain", "Updated Domain"]
        ]
        
        # Process one more item (should trigger refresh)
        content_tagger._items_processed += 1
        cache = content_tagger._refresh_tag_cache()
        
        # Verify cache was refreshed
        assert cache["topical_tags"] == ["New Tag", "Updated Tag"]
        assert cache["domain_tags"] == ["New Domain", "Updated Domain"]
        assert content_tagger._items_processed == 0  # Reset after refresh