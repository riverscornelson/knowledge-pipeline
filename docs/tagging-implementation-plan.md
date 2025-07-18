# Enhanced Tagging System Implementation Plan

## Implementation Checklist

### 🔧 Phase 1: Notion Client Extensions
**File**: `src/core/notion_client.py`

- [ ] Add `get_multi_select_options(property_name)` method
  - Query database schema
  - Extract options for specified property
  - Return list of option names
  
- [ ] Add `get_tag_options()` method
  - Call `get_multi_select_options("Topical-Tags")`
  - Call `get_multi_select_options("Domain-Tags")`
  - Return dictionary with both lists
  
- [ ] Add `update_page_tags(page_id, topical_tags, domain_tags)` method
  - Format tags as multi-select options
  - Update page properties
  - Handle API rate limiting

### 🔧 Phase 2: ContentTagger Implementation
**File**: `src/enrichment/content_tagger.py` (new)

- [ ] Create ContentTagger class extending BaseAnalyzer
- [ ] Implement tag cache management
  - Initialize cache structure
  - Add refresh logic (every 10 items)
  - Track items since refresh
  
- [ ] Override `_build_prompt` method
  - Include existing tags in prompt
  - Format tags by category
  - Add selection guidelines
  
- [ ] Override `_get_default_system_prompt`
- [ ] Override `_get_fallback_result`
- [ ] Implement `_validate_tags` method
  - Check 1-4 word limit
  - Enforce Title Case
  - Remove invalid characters

### 🔧 Phase 3: Prompt Configuration
**File**: `config/prompts.yaml`

- [ ] Add `tagger` section under `analyzers`
- [ ] Define system prompt with tagging guidelines
- [ ] Set model to `gpt-4.1-mini`
- [ ] Configure temperature to 0.3
- [ ] Add environment variable support

### 🔧 Phase 4: Model Extension
**File**: `src/core/models.py`

- [ ] Add fields to EnrichmentResult:
  - `topical_tags: Optional[List[str]]`
  - `domain_tags: Optional[List[str]]`
  - `tag_reasoning: Optional[Dict[str, List[str]]]`

### 🔧 Phase 5: Pipeline Integration
**File**: `src/enrichment/pipeline_processor.py`

- [ ] Import ContentTagger in imports section
- [ ] Initialize content_tagger in `__init__`
  - Check if tagger is enabled in config
  - Pass config and prompt_config
  
- [ ] Add tagging step in `enrich_content`
  - Call after classification
  - Pass semantic content type
  - Store results in EnrichmentResult
  
- [ ] Update `_store_results` method
  - Check for tag attributes
  - Call `update_page_tags` if present
  
- [ ] Update `_create_content_blocks`
  - Add tags to metadata section
  - Show tag reasoning in quality report

### 🔧 Phase 6: Testing Components
**File**: `tests/enrichment/test_content_tagger.py` (new)

- [ ] Test tag validation
- [ ] Test cache refresh logic
- [ ] Test prompt building
- [ ] Test API integration
- [ ] Test error handling

### 🔧 Phase 7: Backfill Script
**File**: `scripts/backfill_tags.py` (new)

- [ ] Query enriched content without tags
- [ ] Extract content from Drive URLs
- [ ] Run through ContentTagger
- [ ] Update Notion pages
- [ ] Track progress and errors

## Code Templates

### ContentTagger Constructor
```python
def __init__(self, config: PipelineConfig, prompt_config: PromptConfig, notion_client: NotionClient):
    super().__init__(config, prompt_config)
    self.notion_client = notion_client
    self._existing_tags_cache = {
        "topical": [],
        "domain": [],
        "last_refresh": None
    }
    self._cache_refresh_interval = 10
    self._items_since_refresh = 0
    self.logger.info("ContentTagger initialized with tag caching enabled")
```

### Structured Output Request
```python
response = self.client.chat.completions.create(
    model=config.get("model", "gpt-4.1-mini"),
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ],
    temperature=config.get("temperature", 0.3),
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "content_tags",
            "schema": tag_schema,
            "strict": True
        }
    }
)
```

### Tag Validation
```python
def _validate_tags(self, tags: List[str]) -> List[str]:
    validated = []
    for tag in tags:
        # Remove extra spaces
        tag = " ".join(tag.split())
        
        # Check word count
        words = tag.split()
        if 1 <= len(words) <= 4:
            # Convert to Title Case
            tag = tag.title()
            
            # Remove special characters except hyphens and apostrophes
            tag = re.sub(r'[^a-zA-Z0-9\s\-\']', '', tag)
            
            if tag and tag not in validated:
                validated.append(tag)
    
    return validated
```

## Dependencies
- Existing: openai, notion-client
- No new dependencies required

## Environment Variables
```bash
ENABLE_CONTENT_TAGGING=true
MODEL_TAGGER=gpt-4.1-mini
```

## Error Handling Strategy
1. **API Failures**: Return empty tags, log error
2. **Cache Failures**: Proceed without cache, log warning
3. **Validation Failures**: Skip invalid tags, log details
4. **Notion Update Failures**: Log error, continue processing

## Performance Considerations
- Cache reduces API calls by ~90%
- Parallel tag generation with other analyses
- Batch Notion updates where possible
- Monitor token usage for cost optimization

## Rollout Strategy
1. Deploy with feature flag disabled
2. Test on small batch (10 items)
3. Monitor tag quality and consistency
4. Enable for all new content
5. Run backfill for existing content

## Success Validation
- [ ] Tags appear in Notion interface
- [ ] Existing tags are reused appropriately
- [ ] New tags follow formatting rules
- [ ] Processing time remains under 2s overhead
- [ ] Error rate below 1%