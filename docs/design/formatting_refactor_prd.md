# Knowledge Pipeline Formatting Refactor PRD

## Problem Statement

The Knowledge Pipeline's current formatting system has accumulated significant technical debt that impacts maintainability and user experience:

### Current Issues

1. **Toggle Prison Architecture**: The `pipeline_processor.py` wraps all content in 5-8 nested toggles, creating a complex 800+ line formatting function that's difficult to maintain
2. **Formatter Sprawl**: Multiple overlapping formatter classes (`NotionFormatter`, `PromptAwareNotionFormatter`) with unclear responsibilities
3. **Prompt-Format Mismatch**: Dynamic prompts loaded from Notion produce varied output structures, but formatting logic assumes fixed structure
4. **Content Duplication**: Same information repeated across multiple sections due to rigid formatting templates
5. **Lost Formatting Capabilities**: Rich formatting features (callouts, tables, visual hierarchy) exist but are unused

### Impact

- **Developer Pain**: Any prompt change requires coordinating updates to formatting logic
- **User Frustration**: 5-8 clicks required to access key insights
- **Maintenance Burden**: 800+ lines of hard-coded formatting logic in a single function
- **Inflexibility**: New content types require extensive code changes

## Proposed Solution

### Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Content Model  │────▶│ Template System  │────▶│  Block Builder  │
│  (Normalized)   │     │ (Content-Aware)  │     │ (Platform-Aware)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                         │
         ▼                       ▼                         ▼
   Prompt-agnostic         Type-specific            Notion blocks
   data structure          presentation             with progressive
                           rules                    disclosure
```

### Core Components

#### 1. Content Model Layer
```python
@dataclass
class EnrichedContent:
    """Normalized content model independent of prompt structure"""
    content_type: str
    quality_score: float
    
    # Core sections (always present)
    executive_summary: List[str]  # Top 3-5 bullet points
    key_insights: List[Insight]
    action_items: List[ActionItem]
    
    # Optional sections (prompt-dependent)
    raw_sections: Dict[str, Any]  # Flexible storage for varied outputs
    
    # Metadata
    attribution: Attribution
    processing_metrics: ProcessingMetrics
```

#### 2. Template System
```python
class ContentTemplate(ABC):
    """Base template for content-type specific formatting"""
    
    @abstractmethod
    def should_show_section(self, section: str, quality: float) -> bool:
        """Determine section visibility based on quality/urgency"""
    
    @abstractmethod
    def format_section(self, section: str, content: Any) -> List[Block]:
        """Convert section content to Notion blocks"""
    
    @abstractmethod
    def get_section_order(self) -> List[str]:
        """Define section display order"""
```

#### 3. Progressive Disclosure Engine
```python
class VisibilityRules:
    """Intelligent section visibility based on content characteristics"""
    
    ALWAYS_VISIBLE = ["executive_summary", "action_items", "quality_indicator"]
    
    QUALITY_THRESHOLDS = {
        "detailed_analysis": 0.7,  # Only show for high-quality content
        "raw_content": 0.0,        # Always in toggle
        "processing_metadata": 0.0  # Always in toggle
    }
    
    URGENCY_OVERRIDES = {
        "critical": ["immediate_actions", "risk_assessment"],
        "high": ["key_insights", "timeline"]
    }
```

#### 4. Adaptive Block Builder
```python
class AdaptiveBlockBuilder:
    """Platform-aware block generation with formatting options"""
    
    def build_blocks(
        self,
        content: EnrichedContent,
        template: ContentTemplate,
        platform: Platform = Platform.DESKTOP
    ) -> List[Block]:
        """Generate formatted blocks based on content, template, and platform"""
```

### Implementation Plan

#### Week 1: Content Model Introduction
- [ ] Create `EnrichedContent` dataclass
- [ ] Build content normalizer to convert prompt outputs
- [ ] Add validation for required fields
- [ ] Update enrichment module to return normalized content

#### Week 2: Template System Implementation
- [ ] Create base `ContentTemplate` class
- [ ] Implement templates for existing content types:
  - `ResearchPaperTemplate`
  - `MarketNewsTemplate`
  - `VendorAnalysisTemplate`
  - `GeneralContentTemplate` (fallback)
- [ ] Build template registry with auto-discovery
- [ ] Add template selection logic based on content type

#### Week 3: Progressive Disclosure Logic
- [ ] Implement `VisibilityRules` engine
- [ ] Add quality-based section filtering
- [ ] Create urgency detection from action items
- [ ] Build section ordering logic

#### Week 4: Adaptive Block Builder
- [ ] Create `AdaptiveBlockBuilder` class
- [ ] Implement platform detection
- [ ] Add mobile-optimized formatting
- [ ] Build smart toggle generation (only for appropriate content)

#### Week 5: Integration and Migration
- [ ] Replace `pipeline_processor.py` formatting logic
- [ ] Update tests for new architecture
- [ ] Create migration script for existing entries
- [ ] Add monitoring for formatting quality

### API Design

```python
# Simple usage example
content = enrichment_service.process(source)
normalized = ContentNormalizer.normalize(content)
template = TemplateRegistry.get_template(normalized.content_type)
blocks = AdaptiveBlockBuilder().build_blocks(
    content=normalized,
    template=template,
    platform=detect_platform()
)
notion_client.append_blocks(page_id, blocks)
```

### Testing Strategy

#### Unit Tests
- Content model validation
- Template selection logic
- Visibility rules for different quality scores
- Block builder output for each platform

#### Integration Tests
- End-to-end formatting for each content type
- Prompt variation handling
- Quality score impact on output
- Mobile vs desktop formatting differences

#### Content Type Coverage
```python
test_fixtures = {
    "research_paper": {
        "high_quality": "fixtures/research_high.json",
        "low_quality": "fixtures/research_low.json",
        "missing_sections": "fixtures/research_partial.json"
    },
    "market_news": {...},
    "vendor_analysis": {...}
}
```

#### Prompt Variation Tests
- Test with current production prompts
- Test with modified prompts (different output structure)
- Test with missing expected sections
- Test with additional unexpected sections

### Migration Strategy

#### Phase 1: Parallel Implementation
1. Implement new formatting system alongside existing
2. Use feature flag to control rollout percentage
3. Compare outputs for quality assurance
4. Collect metrics on formatting time and quality

#### Phase 2: Gradual Rollout
1. Start with 10% of new content
2. Monitor for formatting issues
3. Increase to 50%, then 100% over 2 weeks
4. Keep old system available for rollback

#### Phase 3: Historical Migration
1. Create migration script for existing entries
2. Process in batches during off-peak hours
3. Maintain mapping of old to new format
4. Provide rollback capability per entry

### Success Metrics

#### Technical Metrics
- **Code Reduction**: 800+ lines → ~300 lines (60% reduction)
- **Test Coverage**: >90% for formatting logic
- **Prompt Flexibility**: Handle 95% of prompt variations without code changes
- **Performance**: <100ms formatting time per entry

#### Quality Metrics
- **Formatting Consistency**: 95% across content types
- **Section Discovery**: 100% of prompt sections captured
- **Mobile Compatibility**: 100% readable without horizontal scroll
- **Toggle Reduction**: Maximum 3 toggles per entry (from 8)

#### Developer Experience
- **Time to Add Content Type**: <2 hours (from 2 days)
- **Prompt Change Impact**: 0 code changes required
- **Debugging Time**: 50% reduction
- **Documentation Coverage**: 100% of public APIs

### Risk Mitigation

#### Technical Risks
1. **Notion API Changes**: Abstract block creation behind interface
2. **Performance Regression**: Implement caching for templates
3. **Data Loss**: Maintain raw content in all formats
4. **Format Corruption**: Validate all blocks before sending

#### Migration Risks
1. **User Disruption**: Use feature flags for gradual rollout
2. **Data Integrity**: Run parallel validation during migration
3. **Rollback Needs**: Keep old formatter available for 30 days
4. **Performance Impact**: Process migrations during off-hours

### Future Enhancements

1. **ML-Powered Templates**: Auto-generate templates from content patterns
2. **User Preferences**: Allow format customization per user
3. **Export Options**: Generate PDF/Markdown from templates
4. **A/B Testing**: Built-in format experimentation framework
5. **Analytics Integration**: Track which sections users actually read

## Conclusion

This refactor transforms the formatting system from a rigid, hard-coded approach to a flexible, maintainable architecture. By separating content modeling, presentation logic, and platform-specific rendering, we enable:

- Faster development of new content types
- Resilience to prompt changes
- Better user experience with progressive disclosure
- Significant reduction in code complexity

The phased implementation ensures minimal disruption while delivering immediate value through cleaner code and better formatting outputs.