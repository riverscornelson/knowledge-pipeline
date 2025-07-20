# Notion Prompt Database Setup Guide

This guide walks you through setting up a Notion database for managing dynamic prompts in the Knowledge Pipeline.

## Prerequisites

- Notion account with API access
- Notion integration token (see [Notion API documentation](https://developers.notion.com/docs/getting-started))
- Database creation permissions in your Notion workspace

## Step 1: Create the Prompt Database

1. **Create a new database** in Notion:
   - Click "New Page" in your workspace
   - Select "Table" as the page type
   - Name it "Pipeline Prompts" (or your preferred name)

2. **Set up the required properties**:

### Required Database Schema

| Property Name | Type | Configuration | Description |
|--------------|------|---------------|-------------|
| **Name** | Title | Default | Prompt identifier (e.g., "summarizer/Research") |
| **Prompt** | Text | Long text | The actual prompt template |
| **Category** | Select | Options: summarizer, insights, tagger | Type of analysis |
| **ContentType** | Select | See below | Target content type |
| **Version** | Text | Default: "1.0" | Prompt version tracking |
| **Active** | Checkbox | Default: checked | Enable/disable prompts |
| **WebSearchEnabled** | Checkbox | Default: unchecked | Enable web search for this prompt |
| **LastModified** | Last edited time | Automatic | Auto-updated timestamp |
| **Notes** | Text | Optional | Additional documentation |

### ContentType Options

Configure the ContentType select property with these options:
- `Research`
- `Thought Leadership`
- `Market News`
- `Vendor Capability`
- `Technical Documentation`
- `Tutorial`
- `Analysis`
- `Opinion`
- `News Update`
- `Case Study`

## Step 2: Configure Database Permissions

1. **Share with integration**:
   - Click "Share" in the top-right corner
   - Select "Add connections"
   - Choose your Knowledge Pipeline integration
   - Grant "Read content" permission

2. **Get the database ID**:
   - Open the database as a full page
   - Copy the ID from the URL: `https://notion.so/workspace/{database-id}?v=...`
   - The database ID is the part before the `?`

## Step 3: Add Example Prompts

Here are starter prompts for each category:

### Summarizer Prompts

#### Research Content
```
Name: summarizer/Research
Category: summarizer
ContentType: Research
Prompt: |
  Analyze this research document and provide a comprehensive summary focusing on:
  1. Research objectives and methodology
  2. Key findings and data points
  3. Statistical significance and limitations
  4. Practical implications
  5. Future research directions
  
  Format the summary with clear sections and bullet points for easy scanning.
```

#### Thought Leadership
```
Name: summarizer/Thought Leadership
Category: summarizer
ContentType: Thought Leadership
Prompt: |
  Summarize this thought leadership piece, highlighting:
  1. Core thesis and unique perspective
  2. Key arguments and supporting evidence
  3. Industry implications
  4. Actionable insights for leaders
  5. Controversial or contrarian viewpoints
```

### Insights Generator Prompts

#### Market News
```
Name: insights/Market News
Category: insights
ContentType: Market News
Prompt: |
  Extract strategic insights from this market news, focusing on:
  1. Market movements and trends
  2. Competitive dynamics
  3. Investment implications
  4. Risk factors
  5. Opportunities for action
  
  Prioritize actionable intelligence over general observations.
```

### Tagger Prompts

#### All Content Types
```
Name: tagger/Universal
Category: tagger
ContentType: (leave empty for universal)
Prompt: |
  Generate relevant tags for this content:
  1. Identify 3-5 key topics
  2. Extract 2-3 domain areas
  3. Note any mentioned technologies
  4. Identify business functions impacted
  5. Tag content maturity level
```

## Step 4: Environment Configuration

Add these variables to your `.env` file:

```bash
# Notion API Configuration
NOTION_API_KEY=your_integration_token_here
NOTION_PROMPTS_DATABASE_ID=your_database_id_here

# Optional: Enable web search
ENABLE_WEB_SEARCH=true
```

## Step 5: Verify Setup

Run the verification script:

```bash
python scripts/verify_notion_setup.py
```

This will:
- Test connection to Notion
- Verify database schema
- List available prompts
- Check for any configuration issues

## Best Practices

1. **Version Management**:
   - Increment version numbers when modifying prompts
   - Keep previous versions inactive but available for rollback

2. **Testing Prompts**:
   - Test new prompts with sample content before activating
   - Monitor quality scores after prompt changes

3. **Performance**:
   - Prompts are cached for 5 minutes by default
   - Force refresh with `--refresh-prompts` flag if needed

4. **Organization**:
   - Use consistent naming: `category/ContentType`
   - Document prompt changes in the Notes field
   - Group related prompts using Notion's grouping features

## Troubleshooting

### Common Issues

1. **"Database not found" error**:
   - Verify the database ID is correct
   - Ensure integration has access to the database

2. **"Missing required properties" error**:
   - Check all required fields exist with correct types
   - Property names are case-sensitive

3. **Prompts not loading**:
   - Verify Active checkbox is checked
   - Check Category and ContentType match expected values
   - Look for typos in prompt names

### Debug Mode

Enable debug logging to troubleshoot:

```bash
export LOG_LEVEL=DEBUG
python scripts/run_pipeline.py
```

## Next Steps

- Review [Migration Guide](../guides/migration-to-enhanced-prompts.md) for upgrading existing setups
- See [Configuration Guide](../guides/configuration.md) for advanced options
- Explore [Formatting Guidelines](../formatting-guidelines.md) for content formatting rules