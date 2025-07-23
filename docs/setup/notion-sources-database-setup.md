# Notion Sources Database Setup Guide

This guide walks you through setting up the main Notion database that stores your enriched content from the Knowledge Pipeline.

## Overview

The Sources database is where all your processed content lives. It's the heart of your knowledge management system, containing PDFs enriched with AI-generated summaries, insights, classifications, and quality scores.

## Step 1: Create the Sources Database

### 1.1 Create a New Database

1. **In Notion, create a new page** and choose "Table" as the page type
2. **Name your database** something like "Knowledge Sources" or "Content Pipeline"
3. **Share the database** with your integration:
   - Click "Share" in the top right
   - Invite your integration by name
   - Ensure it has "Can edit" permissions

### 1.2 Configure Database Properties

Create the following properties with exact names and types:

| Property Name | Property Type | Configuration | Description |
|--------------|---------------|---------------|-------------|
| **Title** | Title | (default) | Document title |
| **Status** | Select | See options below | Processing status |
| **Content-Type** | Select | See options below | Type of content |
| **AI-Primitive** | Multi-select | See options below | AI capabilities mentioned |
| **Vendor** | Select | See options below | Company/vendor mentioned |
| **Topical-Tags** | Multi-select | User-defined | Subject matter tags |
| **Domain-Tags** | Multi-select | User-defined | Industry/domain tags |
| **Drive URL** | URL | Required | Link to source PDF |
| **Article URL** | URL | Optional | Original article link |
| **Hash** | Text | Required | Content hash for deduplication |
| **Created Date** | Created time | Automatic | When added to database |
| **Quality** | Select | See options below | Content quality assessment |
| **Quality Score** | Number | 0-100 | Automated quality score (v4.0) |

### 1.3 Configure Select Options

**For Status property, add these options:**
- `Inbox` - Newly ingested, awaiting enrichment
- `Enriched` - Successfully processed with AI
- `Failed` - Processing failed (check logs)
- `Archived` - Old content (optional)

**For Content-Type property, add these options:**
- `Case Study` - Customer success stories
- `Research` - Academic papers, studies
- `Product Update` - Product announcements
- `Tutorial` - How-to guides
- `Industry Analysis` - Market analysis
- `Technical Documentation` - Technical specs
- `Thought Leadership` - Opinion pieces
- `Market News` - Industry news
- `Vendor Capability` - Vendor features
- `Client Deliverable` - Reports
- `Personal Note` - Meeting notes

**For AI-Primitive property (multi-select), add these options:**
- `LLM/Chat` - Language models, chatbots
- `Computer Vision` - Image recognition
- `Speech/Audio` - Voice processing
- `Code Generation` - Code assistants
- `Data Analysis` - Analytics AI
- `Workflow Automation` - Process automation
- `RAG/Search` - Retrieval systems
- `Agents` - AI agents
- `Fine-tuning` - Model customization
- `Embeddings` - Vector embeddings
- `Multi-modal` - Text+image AI

**For Vendor property, add common vendors in your industry:**
- `OpenAI`
- `Anthropic`
- `Google`
- `Microsoft`
- `Amazon`
- `Meta`
- `Cohere`
- `Databricks`
- `Hugging Face`
- (Add others relevant to your field)

**For Quality property, add these options:**
- `High` - Exceptional content (⭐)
- `Medium` - Good content (✓)
- `Low` - Basic content (•)
- `Poor` - Low value (!)

### 1.4 Create Helpful Views

1. **Enrichment Queue** (Filter view):
   - Filter: Status = "Inbox"
   - Sort: Created Date (oldest first)
   - Use: Monitor items awaiting processing

2. **Recent Insights** (Gallery view):
   - Filter: Status = "Enriched" AND Quality != "Poor"
   - Sort: Created Date (newest first)
   - Use: Review latest processed content

3. **By Content Type** (Board view):
   - Group by: Content-Type
   - Sort: Quality Score (highest first)
   - Use: Browse by content category

4. **High Quality** (Table view):
   - Filter: Quality Score > 80
   - Sort: Quality Score (highest first)
   - Use: Focus on best content

## Step 2: Get the Database ID

1. **Open the database page** in your browser
2. **Copy the URL** which looks like:
   ```
   https://www.notion.so/workspace/Knowledge-Sources-1234567890abcdef1234567890abcdef
   ```
3. **Extract the database ID** - it's the 32-character string at the end:
   ```
   1234567890abcdef1234567890abcdef
   ```

## Step 3: Configure Environment

Add the database ID to your `.env` file:

```bash
# Main content database (required)
NOTION_DATABASE_ID=your_sources_database_id_here  # From Step 2

# Other required configuration
NOTION_TOKEN=your_integration_token
OPENAI_API_KEY=your_openai_key
```

## Step 4: Example Database Entries

Here are examples of what your enriched content will look like:

### Example 1: Research Paper
```
Title: "Attention Is All You Need - Transformer Architecture"
Status: Enriched
Content-Type: Research
AI-Primitive: LLM/Chat, Multi-modal
Vendor: Google
Quality: High
Quality Score: 92
Topical-Tags: transformers, attention-mechanism, neural-networks
Domain-Tags: deep-learning, nlp, ai-research
```

### Example 2: Market News
```
Title: "OpenAI Announces GPT-5 with Enhanced Reasoning"
Status: Enriched
Content-Type: Market News
AI-Primitive: LLM/Chat, Agents, Code Generation
Vendor: OpenAI
Quality: Medium
Quality Score: 78
Topical-Tags: gpt-5, product-launch, ai-models
Domain-Tags: generative-ai, commercial-ai
```

### Example 3: Technical Documentation
```
Title: "LangChain RAG Implementation Guide"
Status: Enriched
Content-Type: Technical Documentation
AI-Primitive: RAG/Search, Embeddings
Vendor: (none)
Quality: High
Quality Score: 85
Topical-Tags: retrieval-augmented-generation, implementation, langchain
Domain-Tags: ai-engineering, rag-systems
```

## Understanding the Enrichment Process

When the pipeline processes a PDF:

1. **Ingestion**: Creates entry with Status="Inbox"
2. **AI Analysis**: 
   - Generates comprehensive summary
   - Extracts key insights
   - Classifies content type
   - Identifies AI primitives
   - Detects vendor mentions
   - Generates relevant tags
   - Calculates quality score
3. **Storage**: Updates entry with all enrichments
4. **Status Update**: Changes to Status="Enriched"

## Best Practices

1. **Regular Maintenance**:
   - Archive old content quarterly
   - Review and merge duplicate tags
   - Update vendor list as needed

2. **Tag Management**:
   - Keep topical tags specific (e.g., "transformer-architecture" not just "ai")
   - Use domain tags for broad categories (e.g., "machine-learning", "enterprise-ai")
   - Regularly consolidate similar tags

3. **Quality Control**:
   - Review items with Quality="Poor" for deletion
   - Use Quality Score > 80 for important research
   - Check Failed items and retry if needed

## Troubleshooting

### Common Issues

1. **"Database not found" error**:
   - Verify database ID in `.env`
   - Check integration has access
   - Ensure database isn't in trash

2. **Properties missing**:
   - Property names are case-sensitive
   - Don't rename default properties
   - Ensure all required properties exist

3. **No enrichment happening**:
   - Check Status="Inbox" items exist
   - Verify OpenAI API key is valid
   - Check logs for errors

## Next Steps

1. **Run your first ingestion**:
   ```bash
   python scripts/run_pipeline.py --limit 1
   ```

2. **Monitor the database** to see enrichment in action

3. **Set up the prompts database** for advanced control:
   - See [Notion Prompt Database Setup](notion-prompt-database-setup.md)

4. **Configure automated runs** with cron or task scheduler

---

With this database configured, you're ready to start building your AI-enhanced knowledge base!