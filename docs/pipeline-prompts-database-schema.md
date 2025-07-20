# Pipeline Prompts Database Schema

## Overview
The Pipeline Prompts database is a Notion-based system for managing AI prompts with built-in formatting instructions. This enables dynamic prompt updates, A/B testing, and consistent Notion-optimized output formatting.

## Database Properties

### Core Fields

| Property | Type | Description | Required |
|----------|------|-------------|----------|
| **Name** | Title | Unique identifier for the prompt (e.g., "Research_Summarizer_v2") | Yes |
| **Content Type** | Select | Links to Sources DB content types | Yes |
| **Analyzer Type** | Select | Type of analyzer using this prompt | Yes |
| **Active** | Checkbox | Whether this prompt is currently in use | Yes |
| **Version** | Number | Version number for tracking iterations | Yes |
| **Last Modified** | Date | When the prompt was last updated | Auto |
| **Created** | Date | When the prompt was created | Auto |

### Content Fields

| Property | Type | Description | Required |
|----------|------|-------------|----------|
| **System Prompt** | Text | The main system prompt with {variables} | Yes |
| **Formatting Instructions** | Text | Notion-specific formatting rules | Yes |
| **User Prompt Template** | Text | Template for user message (optional) | No |
| **Examples** | Text | Example input/output pairs | No |

### Configuration Fields

| Property | Type | Description | Default |
|----------|------|-------------|---------|
| **Temperature** | Number | LLM temperature (0.1-0.9) | 0.3 |
| **Max Tokens** | Number | Maximum response tokens | 4000 |
| **Web Search** | Checkbox | Enable web search for this prompt | False |
| **Model Override** | Select | Override default model | None |

### Performance Fields

| Property | Type | Description | Auto-Updated |
|----------|------|-------------|--------------|
| **Usage Count** | Number | Times this prompt has been used | Yes |
| **Quality Score** | Number | Average quality rating (1-5) | Yes |
| **Error Rate** | Number | Percentage of failed responses | Yes |
| **Avg Response Time** | Number | Average processing time (seconds) | Yes |

### Testing Fields

| Property | Type | Description | Required |
|----------|------|-------------|----------|
| **Test Status** | Select | Current testing phase | No |
| **A/B Test Group** | Select | Which test group (A, B, Control) | No |
| **Test Notes** | Text | Observations from testing | No |

## Select Options

### Content Type
- Research
- Vendor Capability
- Market News
- Thought Leadership
- Client Deliverable
- Personal Note
- Email
- Website
- PDF

### Analyzer Type
- summarizer
- classifier
- insights
- tagger
- technical_analyzer
- market_analyzer
- legal_analyzer

### Test Status
- Development
- Testing
- Staging
- Production
- Deprecated

### Model Override
- gpt-4o
- gpt-4o-mini
- claude-3-opus
- claude-3-sonnet
- None (use default)

## Formatting Instructions Template

Each prompt should include formatting instructions like:

```markdown
## Notion Formatting Requirements

### Structure
- Use H2 (##) for main sections, H3 (###) for subsections
- Keep paragraphs to 3 sentences maximum
- Use bullet points for lists with sub-bullets for details
- Add line breaks between sections for readability

### Visual Elements
- Start each main section with a relevant emoji
- Use **bold** for key metrics and important terms
- Use `inline code` for technical terms
- Add > blockquotes for important insights

### Lists and Data
- Use numbered lists for sequential items
- Keep bullet points concise (under 15 words)
- Present comparative data in tables
- Use checkboxes for action items

### Special Blocks
- Wrap key insights in callout blocks
- Use toggle blocks for detailed explanations
- Add dividers between major sections
- Use colored backgrounds for warnings/alerts

### Mobile Optimization
- Prefer single-column layouts
- Keep tables to 3-4 columns max
- Use toggles to hide lengthy content
- Ensure all text is scannable
```

## Relations

### To Other Databases
- **Sources** → Content Type (ensures consistency)
- **Enriched Documents** → Track which prompt version was used
- **Quality Metrics** → Link quality scores to specific prompts

## Views

### 1. Active Prompts
- Filter: Active = True
- Sort: Content Type, Analyzer Type
- Purpose: Current production prompts

### 2. Testing Dashboard
- Filter: Test Status ≠ "Production"
- Group: Test Status
- Purpose: Manage prompt experiments

### 3. Performance Analytics
- Sort: Quality Score (desc), Usage Count (desc)
- Show: Quality metrics and usage stats
- Purpose: Identify best/worst performing prompts

### 4. Version History
- Group: Name
- Sort: Version (desc)
- Purpose: Track prompt evolution

### 5. By Content Type
- Group: Content Type
- Filter: Active = True
- Purpose: See all prompts for each content type

## Implementation Notes

### Caching Strategy
- Cache active prompts locally with 5-minute TTL
- Invalidate cache on prompt updates
- Fall back to YAML if Notion is unavailable

### Version Control
- Increment version number on any change
- Keep last 3 versions of each prompt
- Archive old versions with performance metrics

### Quality Tracking
- Record prompt version used with each enrichment
- Allow user feedback on output quality
- Calculate rolling average quality score

### A/B Testing
- Support multiple active prompts per type
- Random assignment to test groups
- Track performance metrics by group
- Automatic promotion of winning variants

## Migration Plan

1. Create database with schema
2. Import existing YAML prompts as v1.0
3. Add formatting instructions to each
4. Test with sample documents
5. Deploy with fallback to YAML
6. Monitor performance metrics
7. Iterate based on quality scores

## Example Entry

**Name**: Research_Summarizer_v2  
**Content Type**: Research  
**Analyzer Type**: summarizer  
**Active**: ✓  
**Version**: 2.0  

**System Prompt**:
```
You are an expert research analyst creating scannable summaries for busy professionals.

Focus on:
- Methodology and key findings
- Practical applications
- Statistical significance
- Industry impact

{formatting_instructions}
```

**Formatting Instructions**:
```
Structure your response as follows:

## 📊 Executive Summary
3 bullet points with key findings (15 words each)

## 🔬 Methodology
- Brief description in toggle block
- Highlight sample size and approach

## 🎯 Key Findings
1. **Finding 1**: Brief description
   - Supporting detail
   - Impact metric
2. **Finding 2**: Brief description
   - Supporting detail
   - Impact metric

## 💡 Insights & Applications
Use callout blocks for each major insight

## 📈 Data Overview
Present key metrics in a table format
```

This schema provides a robust foundation for dynamic prompt management while ensuring consistent, high-quality Notion formatting.