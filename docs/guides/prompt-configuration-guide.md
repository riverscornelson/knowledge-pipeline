# Prompt Configuration Guide

## Overview

The Knowledge Pipeline uses a YAML-based prompt configuration system that enables content-type-specific AI analysis. This guide provides detailed examples and best practices for configuring prompts.

## Configuration File Structure

```yaml
# config/prompts.yaml

# 1. Global Framework - Inherited by all analyzers
global_framework:
  analysis_principles: |
    # Core principles that guide all analyses
  quality_standards: |
    # Quality checklist for all outputs

# 2. Default Prompts - Base configuration for each analyzer
defaults:
  summarizer:
    system: "..."
    analysis_framework: "..."
    output_template: "..."
    temperature: 0.3
    web_search: false
  classifier:
    # Similar structure
  insights:
    # Similar structure

# 3. Content Type Overrides - Specialized prompts per content type
content_types:
  research:
    summarizer:
      # Overrides for research content
  vendor_capability:
    summarizer:
      # Overrides for vendor content
  # ... more content types

# 4. Custom Analyzers - Additional specialized analyzers
analyzers:
  market:
    enabled: "${ENABLE_MARKET_ANALYSIS}"
    # Configuration
  legal:
    enabled: "${ENABLE_LEGAL_ANALYSIS}"
    # Configuration
```

## Content Type Configuration Examples

### Research Content

```yaml
content_types:
  research:
    summarizer:
      system: |
        You are a research intelligence analyst specializing in extracting actionable insights from academic and research content.
        
        RESEARCH EVALUATION FRAMEWORK:
        • Methodology Rigor - Is this research reliable?
        • Statistical Significance - Do the results matter?
        • Practical Application - How can we use this?
        • Competitive Impact - Does this change the game?
      
      validation_checklist: |
        CREDIBILITY ASSESSMENT:
        □ Peer-reviewed source? (Yes/No)
        □ Sample size adequate? (N=)
        □ Control group present? (Yes/No)
        □ Conflicts of interest? (Disclosed/None)
        □ Reproducibility addressed? (Yes/No)
      
      analysis_framework: |
        Step 1: RESEARCH VALIDITY CHECK (20 seconds)
        - Assess methodology strength (Strong/Moderate/Weak)
        - Check statistical significance (p-values, confidence intervals)
        - Evaluate sample representativeness
        - Note any limitations acknowledged
        
        Step 2: BREAKTHROUGH IDENTIFICATION (40 seconds)
        - What's genuinely new here?
        - How does this challenge existing knowledge?
        - What assumptions does it overturn?
        - Where does it advance the field?
      
      output_template: |
        # Research Intelligence: {title}
        
        ## ⚡ EXECUTIVE SUMMARY
        **Breakthrough**: {What's new}
        **Business Impact**: {How this affects us}
        **Action Required**: {What to do now}
        
        ## 🔬 RESEARCH VALIDITY
        - **Methodology Strength**: {Strong/Moderate/Weak}
        - **Sample Size**: {N=X, representative of Y}
        - **Statistical Significance**: {p-values, confidence}
        - **Limitations**: {Key constraints}
      
      temperature: 0.4
      web_search: true  # Check for citations and replications
```

### Vendor Capability Content

```yaml
content_types:
  vendor_capability:
    summarizer:
      system: |
        You are a competitive intelligence analyst specializing in vendor and product capability assessment.
        
        ANALYSIS PRIORITIES:
        1. Competitive Differentiation - What makes this unique?
        2. Integration Potential - How does it fit our stack?
        3. Total Cost of Ownership - Real costs beyond licensing
        4. Strategic Fit - Alignment with our direction
        5. Risk Assessment - Vendor stability and lock-in
      
      competitor_analysis_framework: |
        COMPETITIVE LANDSCAPE MAPPING:
        1. Direct Competitors:
           - Who offers similar capabilities?
           - How does pricing compare?
           - What's the market share?
           
        2. Unique Differentiators:
           - Technical advantages
           - Business model innovations
           - Ecosystem strengths
      
      output_template: |
        # Vendor Intelligence: {vendor} - {product}
        
        ## ⚡ EXECUTIVE DECISION BRIEF
        **Recommendation**: {Buy/Pilot/Pass/Monitor}
        **Key Differentiator**: {What sets this apart}
        **Strategic Fit**: {High/Medium/Low} - {reason}
        **Urgency**: {Act now/Can wait/Monitor} - {why}
        
        ## 💰 BUSINESS CASE
        | Metric | Value | Notes |
        |--------|-------|--------|
        | License Cost | ${X}/year | {pricing model} |
        | Implementation | ${Y} + {Z} weeks | {complexity} |
        | TCO (3-year) | ${total} | {breakdown} |
        | ROI Timeline | {X} months | {key drivers} |
      
      web_search: true  # Essential for competitive context
    
    insights:
      market_dynamics_focus: |
        MARKET ANALYSIS ANGLES:
        - Market share trajectory
        - Funding and M&A activity
        - Customer sentiment shifts
        - Technology disruption potential
```

### Market News Content

```yaml
content_types:
  market_news:
    summarizer:
      system: |
        You are a market intelligence analyst providing real-time strategic insights on industry developments.
        
        NEWS ANALYSIS FRAMEWORK:
        • Signal vs Noise - What actually matters?
        • First/Second Order Effects - Immediate and downstream impacts
        • Winners and Losers - Who benefits, who suffers?
        • Action Timing - When to move on this information
      
      time_sensitivity_matrix: |
        URGENCY ASSESSMENT:
        🔴 CRITICAL (Act within 24 hours)
        - Major competitor moves
        - Regulatory changes
        - Market disruptions
        - M&A affecting us
        
        🟡 HIGH (Act this week)
        - Technology shifts
        - Funding rounds
        - Partnership announcements
        - Industry trends
      
      analysis_framework: |
        Step 1: NEWS TRIAGE (15 seconds)
        - Information freshness check
        - Source credibility rating
        - Direct impact assessment
        - Urgency classification
        
        Step 2: IMPACT CASCADE (45 seconds)
        - Immediate effects on our business
        - Ripple effects on ecosystem
        - Opportunity windows opening/closing
        - Competitive landscape shifts
      
      temperature: 0.4
      web_search: true  # Critical for context
```

## Custom Analyzer Examples

### Market Analyzer

```yaml
analyzers:
  market:
    enabled: "${ENABLE_MARKET_ANALYSIS}"
    web_search: "${MARKET_ANALYZER_WEB_SEARCH}"
    system_prompt: |
      You are a market intelligence expert and business strategist.
      
      MARKET ANALYSIS EXPERTISE:
      • Competitive Dynamics - Who's winning and why?
      • Market Timing - When to enter/exit?
      • Business Models - What makes money?
      • Strategic Positioning - How to win?
    
    analysis_prompt: |
      Conduct strategic market analysis:
      
      Title: {title}
      Content: {content}
      
      ## 📊 MARKET LANDSCAPE
      ### Competitive Position
      | Player | Strength | Weakness | Strategy | Threat Level |
      |--------|----------|----------|----------|--------------|
      | {company} | {advantage} | {gap} | {approach} | {1-10} |
      
      ### Market Dynamics
      - Market Size: ${current} → ${projected}
      - Growth Rate: {percent}% CAGR
      - Key Drivers: {list}
      - Disruption Risk: {assessment}
      
      ## 💰 BUSINESS MODEL ANALYSIS
      ### Revenue Streams
      1. {Stream}: ${size} ({percent}% margin)
      
      ### Unit Economics
      - CAC: ${customer acquisition cost}
      - LTV: ${lifetime value}
      - Payback: {months}
      - Burn Rate: ${monthly}
```

### Legal Analyzer

```yaml
analyzers:
  legal:
    enabled: "${ENABLE_LEGAL_ANALYSIS}"
    web_search: "${LEGAL_ANALYZER_WEB_SEARCH}"
    system_prompt: |
      You are a legal risk analyst and compliance expert.
      
      LEGAL ANALYSIS FRAMEWORK:
      • Regulatory Compliance - Are we exposed?
      • Contract Intelligence - What are we agreeing to?
      • IP Protection - What's at risk?
      • Liability Assessment - What could go wrong?
    
    analysis_prompt: |
      Perform legal and compliance analysis:
      
      ## ⚖️ LEGAL RISK ASSESSMENT
      ### Compliance Requirements
      | Regulation | Applies? | Status | Action Required |
      |------------|----------|---------|-----------------|
      | GDPR | {Y/N} | {Compliant/Gap} | {steps} |
      | CCPA | {Y/N} | {status} | {action} |
      
      ### Risk Matrix
      | Risk Type | Likelihood | Impact | Mitigation |
      |-----------|------------|---------|------------|
      | {category} | {H/M/L} | ${amount} | {strategy} |
```

## Enhanced Prompt System with Notion Integration

### Overview

The Knowledge Pipeline now supports dynamic prompt management through Notion, allowing you to update prompts without code changes. The system uses a hierarchical approach:

1. **YAML Base Prompts** - Default prompts stored in `config/prompts.yaml`
2. **Notion Dynamic Prompts** - Override YAML prompts when available
3. **Automatic Caching** - 5-minute cache for performance

### Notion Integration Setup

To enable Notion-based prompt management:

1. **Create Notion Database** - See [Notion Database Setup Guide](../setup/notion-prompt-database-setup.md)
2. **Configure Environment Variables**:

```bash
# Notion API Configuration
NOTION_API_KEY=your_integration_token_here
NOTION_PROMPTS_DATABASE_ID=your_database_id_here

# Optional: Force enhanced prompt system
USE_ENHANCED_PROMPTS=true
```

### Prompt Loading Hierarchy

```
1. Check Notion database for matching prompt
   └─> If found: Use Notion prompt
   └─> If not found: Fall back to YAML prompt
2. Apply content-type-specific overrides
3. Apply environment variable overrides
```

### Enhanced Features

- **Version Control** - Track prompt versions in Notion
- **A/B Testing** - Test different prompts by toggling Active field
- **Live Updates** - Changes reflect immediately (after cache expires)
- **Web Search Control** - Per-prompt web search configuration
- **Rich Formatting** - Use Notion's text editor for complex prompts

## Environment Variable Configuration

### Basic Setup

```bash
# .env file

# Enable web search globally
ENABLE_WEB_SEARCH=true

# Configure specific analyzers
ENABLE_MARKET_ANALYSIS=true
ENABLE_LEGAL_ANALYSIS=false

# Web search per analyzer
SUMMARIZER_WEB_SEARCH=true
INSIGHTS_WEB_SEARCH=true
MARKET_ANALYZER_WEB_SEARCH=true

# Model selection
MODEL_SUMMARY=gpt-4o
MODEL_CLASSIFIER=gpt-4o
MODEL_INSIGHTS=gpt-4o

# Notion Integration (Optional)
NOTION_API_KEY=secret_xxxxxxxxxxxxx
NOTION_PROMPTS_DATABASE_ID=abc123def456
USE_ENHANCED_PROMPTS=true
```

### Advanced Configuration

```bash
# Content-specific model selection
MODEL_RESEARCH_SUMMARY=gpt-4o
MODEL_VENDOR_SUMMARY=gpt-4o-mini
MODEL_MARKET_INSIGHTS=gpt-4o

# Processing windows
GMAIL_WINDOW_DAYS=7
WEBSITE_WINDOW_DAYS=30

# Quality thresholds
MIN_QUALITY_SCORE=0.7
MAX_RETRIES=3
```

## Content Processing & Prompt Assembly

### Current Implementation

The system currently uses:

1. **Intelligent Content Preprocessing**
   - Content over 200,000 characters is automatically preprocessed
   - Prioritizes high-value content (headings, bullet points, key terms)
   - Allocates 60% space to priority content, 40% to regular content

2. **Fixed Prompt Templates**
   - Same prompt structure used regardless of content length
   - Prompts vary by content type (Research, Vendor, etc.) not by length
   - Fixed output token limits: 1500 (summaries), 1200 (insights), 800 (classification)

### How Prompts Are Selected

The system selects prompts based on:

1. **Content Type** - The semantic content type (Research, Vendor, Market News, etc.) determines which prompt template is used
2. **Analyzer Type** - Each analyzer (summarizer, classifier, insights) has its own prompt structure
3. **Configuration** - Prompts are loaded from `config/prompts.yaml` and can be customized per content type

The preprocessing step ensures that even very large documents (up to 200k characters) can be processed effectively by intelligently selecting the most important content.
  strategic:
    - "competitive"
    - "market share"
    - "disruption"
    - "transformation"
```

## Quality Assurance Configuration

### Test Scenarios

```yaml
quality_assurance:
  test_scenarios:
    - name: "Technical Deep Dive"
      content_type: "research"
      expected_sections: ["methodology", "findings", "applications"]
      quality_threshold: 0.8
      
    - name: "Vendor Quick Take"
      content_type: "vendor_capability"
      expected_sections: ["features", "pricing", "competition"]
      quality_threshold: 0.85
      
    - name: "Market Flash"
      content_type: "market_news"
      expected_sections: ["impact", "winners_losers", "actions"]
      quality_threshold: 0.9
```

### Feedback Metrics

```yaml
feedback_metrics:
  - metric: "completeness"
    measurement: "sections_populated / total_sections"
  - metric: "actionability"
    measurement: "action_items_count > 0"
  - metric: "evidence_quality"
    measurement: "claims_with_evidence / total_claims"
  - metric: "time_to_value"
    measurement: "reading_time < 2_minutes"
```

## Best Practices

### 1. Content Type Normalization

```python
# Content types must match exactly after normalization:
# Notion: "Research" → YAML: "research"
# Notion: "Thought Leadership" → YAML: "thought_leadership"
# Notion: "Client Deliverable" → YAML: "client_deliverable"
```

### 2. Prompt Template Variables

Available variables in templates:
- `{title}` - Document title
- `{content}` - Full content text
- `{vendor}` - Detected vendor name
- `{product}` - Product name
- `{date}` - Processing date

### 3. Temperature Guidelines

- **0.1-0.3**: Classification, extraction tasks
- **0.3-0.5**: Summarization, analysis
- **0.5-0.7**: Insights generation, creative analysis
- **0.7-0.9**: Ideation, scenario planning

### 4. Web Search Usage

Enable web search for:
- Market analysis (competitor information)
- Research validation (citations, follow-ups)
- Vendor assessment (recent updates)
- News context (related developments)

Disable web search for:
- Confidential content analysis
- Internal document processing
- Personal notes
- Email summaries

## Troubleshooting

### Common Issues

1. **YAML Parsing Errors**
   ```bash
   # Validate YAML syntax
   python -m yaml config/prompts.yaml
   ```

2. **Environment Variable Not Loading**
   ```bash
   # Check variable is set
   echo $ENABLE_WEB_SEARCH
   
   # Reload environment
   source .env
   ```

3. **Content Type Not Matching**
   ```python
   # Debug logging shows normalization
   # Original: "Thought Leadership"
   # Normalized: "thought_leadership"
   ```

4. **Web Search Not Working**
   - Check `ENABLE_WEB_SEARCH=true`
   - Verify analyzer has `web_search: true`
   - Confirm not disabled by content type

## Testing Your Configuration

### 1. Test Individual Prompts

```python
from src.core.prompt_config import PromptConfig

# Load configuration
config = PromptConfig()

# Test prompt retrieval
prompt = config.get_prompt("summarizer", "research")
print(f"Web search enabled: {prompt['web_search']}")
print(f"Temperature: {prompt['temperature']}")
```

### 2. Validate Content Type Matching

```python
# Test normalization
content_types = ["Research", "Vendor Capability", "Market News"]
for ct in content_types:
    normalized = ct.lower().replace(" ", "_").replace("-", "_")
    print(f"{ct} → {normalized}")
```

### 3. Monitor Quality Metrics

```python
# Check pipeline logs for quality scores
# Quality score components:
# - Summary length (0-0.3)
# - Insights count (0-0.3)
# - Classification confidence (0-0.3)
# - Processing efficiency (0-0.1)
```

## Advanced Customization

### Creating New Content Types

1. Add to Notion database Content-Type options
2. Add configuration in `prompts.yaml`:

```yaml
content_types:
  your_new_type:
    summarizer:
      system: "Specialized system prompt..."
      analysis_framework: "Custom framework..."
      output_template: "Custom template..."
      temperature: 0.4
      web_search: true
```

3. Test with sample content
4. Monitor quality metrics
5. Iterate based on results