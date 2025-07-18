# Enhanced Tagging System Architecture Design

## Overview
This document outlines the architectural design for integrating an intelligent content tagging system into the Knowledge Pipeline. The system will automatically generate topical and domain tags for content while maintaining consistency with existing tags in the Notion database.

## Core Components

### 1. ContentTagger Class (New)
**Location**: `src/enrichment/content_tagger.py`

```python
class ContentTagger(BaseAnalyzer):
    """
    Intelligent content tagging analyzer that generates topical and domain tags.
    Extends BaseAnalyzer to leverage existing infrastructure.
    """
    
    def __init__(self, config: PipelineConfig, prompt_config: PromptConfig):
        super().__init__(config, prompt_config)
        self._existing_tags_cache = {
            "topical": [],
            "domain": [],
            "last_refresh": None
        }
        self._cache_refresh_interval = 10  # Refresh every 10 items
        self._items_since_refresh = 0
    
    def analyze(self, content: str, title: str, content_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate tags for content using OpenAI with structured outputs.
        
        Returns:
            {
                "analysis": {
                    "topical_tags": ["Tag 1", "Tag 2", "Tag 3"],
                    "domain_tags": ["Domain 1", "Domain 2"],
                    "tag_selection_reasoning": {
                        "existing_tags_used": [...],
                        "new_tags_created": [...],
                        "considered_but_rejected": [...]
                    },
                    "confidence_scores": {"Tag 1": 0.95, ...}
                },
                "success": True,
                "web_search_used": False,
                "model": "gpt-4.1-mini"
            }
        """
        
    def _refresh_tag_cache(self, notion_client: NotionClient) -> None:
        """Refresh the cache of existing tags from Notion."""
        
    def _build_prompt(self, content: str, title: str, config: Dict[str, Any]) -> str:
        """Build prompt with existing tags included for context."""
        
    def _validate_tags(self, tags: List[str]) -> List[str]:
        """Ensure tags meet 1-4 word requirement and are Title Case."""
```

### 2. Notion Client Extensions
**Location**: `src/core/notion_client.py` (extend existing class)

```python
def get_multi_select_options(self, property_name: str) -> List[str]:
    """
    Retrieve existing options for a multi-select property.
    
    Args:
        property_name: Name of the multi-select property
        
    Returns:
        List of existing option names
    """
    
def get_tag_options(self) -> Dict[str, List[str]]:
    """
    Get both topical and domain tag options.
    
    Returns:
        {
            "topical": ["Tag 1", "Tag 2", ...],
            "domain": ["Domain 1", "Domain 2", ...]
        }
    """
    
def update_page_tags(self, page_id: str, topical_tags: List[str], domain_tags: List[str]):
    """
    Update page with new tags.
    
    Args:
        page_id: Notion page ID
        topical_tags: List of topical tags
        domain_tags: List of domain tags
    """
```

### 3. Pipeline Integration
**Location**: `src/enrichment/pipeline_processor.py` (modify existing)

```python
# In __init__:
from .content_tagger import ContentTagger
self.content_tagger = ContentTagger(config, self.prompt_config) if self.prompt_config.get_analyzer_config('tagger', {}).get('enabled', True) else None

# In enrich_content method, after classification:
if self.content_tagger:
    tag_result = self.content_tagger.analyze(content, title, semantic_content_type)
    if tag_result.get("success"):
        result.topical_tags = tag_result["analysis"]["topical_tags"]
        result.domain_tags = tag_result["analysis"]["domain_tags"]
        result.tag_reasoning = tag_result["analysis"]["tag_selection_reasoning"]
        
# In _store_results method:
if hasattr(result, 'topical_tags') and hasattr(result, 'domain_tags'):
    self.notion_client.update_page_tags(page_id, result.topical_tags, result.domain_tags)
```

### 4. EnrichmentResult Model Extension
**Location**: `src/core/models.py` (extend existing)

```python
@dataclass
class EnrichmentResult:
    # ... existing fields ...
    topical_tags: Optional[List[str]] = None
    domain_tags: Optional[List[str]] = None
    tag_reasoning: Optional[Dict[str, List[str]]] = None
```

### 5. Prompt Configuration
**Location**: `config/prompts.yaml` (add new section)

```yaml
analyzers:
  tagger:
    enabled: "${ENABLE_CONTENT_TAGGING:-true}"
    model: "${MODEL_TAGGER:-gpt-4.1-mini}"
    temperature: 0.3
    system: |
      You are an expert content tagger responsible for categorizing documents with precise, consistent tags.
      
      TAGGING GUIDELINES:
      1. STRONGLY PREFER EXISTING TAGS when they accurately describe the content
      2. Create new tags ONLY when no existing tag captures a significant concept
      3. Each tag must be 1-4 words, Title Case
      4. Tags should be specific but reusable across similar content
      
      TOPICAL TAGS (3-5): Subject matter, topics, themes
      DOMAIN TAGS (2-4): Industries, fields, application areas
```

## Integration Points

### 1. Cache Management Strategy
- Cache existing tags on first use
- Refresh cache every 10 items processed
- Store cache in memory with timestamp
- Provide manual refresh capability

### 2. Error Handling
- Fallback to empty tags on API failure
- Log new tag creation for monitoring
- Validate tag format before storage
- Handle missing multi-select properties gracefully

### 3. Structured Output Schema
```python
tag_schema = {
    "type": "object",
    "properties": {
        "topical_tags": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 3,
            "maxItems": 5
        },
        "domain_tags": {
            "type": "array", 
            "items": {"type": "string"},
            "minItems": 2,
            "maxItems": 4
        },
        "tag_selection_reasoning": {
            "type": "object",
            "properties": {
                "existing_tags_used": {"type": "array", "items": {"type": "string"}},
                "new_tags_created": {"type": "array", "items": {"type": "string"}},
                "considered_but_rejected": {"type": "array", "items": {"type": "string"}}
            }
        },
        "confidence_scores": {
            "type": "object",
            "additionalProperties": {"type": "number"}
        }
    },
    "required": ["topical_tags", "domain_tags", "tag_selection_reasoning"]
}
```

## Implementation Sequence

1. **Phase 1**: Extend Notion client with tag retrieval methods
2. **Phase 2**: Implement ContentTagger class with caching
3. **Phase 3**: Update prompts.yaml with tagger configuration
4. **Phase 4**: Integrate tagger into pipeline processor
5. **Phase 5**: Extend EnrichmentResult model
6. **Phase 6**: Add tag storage in _store_results
7. **Phase 7**: Create backfill script for existing content

## Quality Assurance

### Monitoring Points
1. New tag creation rate (should decrease over time)
2. Tag reuse percentage (should increase over time)
3. Processing time impact (minimal overhead expected)
4. Tag consistency across similar content

### Success Metrics
- 80%+ existing tag reuse after initial corpus
- <5% invalid tag format errors
- <2 second processing overhead per document
- Organic taxonomy growth <10 new tags per 100 documents

## Security Considerations
- No PII in tags
- Validate tag length and format
- Sanitize special characters
- Prevent tag injection attacks

## Future Enhancements
1. Tag hierarchy support
2. Tag synonyms and aliases
3. ML-based tag suggestions
4. Tag usage analytics dashboard
5. Automated tag consolidation