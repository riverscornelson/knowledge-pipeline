# Content Tag Field - Design Specification

## Field Overview
**Field Name**: Content Tag  
**Field Type**: Multi-select (Notion)  
**Purpose**: Extract and store 1-7 key phrases from PDF content for enhanced searchability

## Technical Specifications

### Field Characteristics
- **Data Type**: List[str] in Python, Multi-select in Notion
- **Constraints**:
  - Minimum tags: 1
  - Maximum tags: 7
  - Max words per tag: 4
  - Character limit per tag: 50
  - Total unique tags in database: Unlimited (dynamic)

### Tag Format Rules
1. **Capitalization**: Title Case (e.g., "Machine Learning Models")
2. **Character Set**: Alphanumeric + spaces only
3. **No Special Characters**: Except hyphens in compound terms
4. **No Redundancy**: Tags should be distinct concepts
5. **Language**: English only

### Tag Categories (Examples)
- **Technology Terms**: "Cloud Native Architecture", "API Gateway Pattern"
- **Business Concepts**: "Digital Transformation", "Customer Success Metrics"
- **Product Names**: "AWS Lambda", "Google Vertex AI"
- **Methodologies**: "Agile Development", "Six Sigma Process"
- **Industry Terms**: "Financial Services", "Healthcare Analytics"

## Extraction Logic

### AI Model Configuration
```python
MODEL_TAG_EXTRACTOR = os.getenv("MODEL_TAG_EXTRACTOR", "gpt-4-turbo-preview")
MAX_TOKENS_TAGS = 500
TEMPERATURE_TAGS = 0.3  # Lower for consistency
```

### Extraction Algorithm
1. **Content Analysis**: Full document text analysis
2. **Concept Identification**: Extract key themes and topics
3. **Phrase Generation**: Create 4-word-max descriptive phrases
4. **Deduplication**: Remove similar/redundant tags
5. **Ranking**: Order by relevance and coverage
6. **Selection**: Choose top 1-7 tags

### Quality Criteria
- **Relevance**: Tags must directly relate to content
- **Specificity**: Prefer specific over generic terms
- **Coverage**: Tags should represent main themes
- **Searchability**: Tags should be terms users would search

## Integration Points

### Notion Database
- Add new Multi-select property "Content Tag"
- No preset options (dynamic population)
- Searchable and filterable

### Pipeline Integration
- New module: `src/enrichment/tag_extractor.py`
- Called during enrichment phase after classification
- Results stored alongside other enrichment data

### API Response Format
```json
{
  "content_tags": [
    "Machine Learning Models",
    "Cloud Architecture",
    "Data Pipeline Design",
    "Real Time Analytics"
  ],
  "confidence_scores": [0.95, 0.92, 0.88, 0.85]
}
```

## Performance Considerations
- Tag extraction adds ~2-3 seconds per document
- Caching strategy for repeated content
- Batch processing optimization for multiple documents

## Success Metrics
- Average tags per document: 3-5
- Tag reuse rate: >30% (indicates consistency)
- Search improvement: 40% better discovery
- User satisfaction: Measured via search success rate