# Insights Formatting Fix

## Issue Description
Sections like "Immediate Actions" and "Strategic Opportunities" were appearing as bullet points with periods (`•. Immediate Actions`) instead of proper headers in Notion.

## Root Cause
1. The prompt in `enhanced_insights.py` was asking for both structured sections AND a bulleted list, creating confusion
2. The AI was responding with bullet points that included section headers
3. The regex parser in `pipeline_processor.py` was extracting these malformed bullet points

## Solution Implemented

### 1. Updated Prompt Structure (enhanced_insights.py)
- Changed from numbered list with embedded headers to explicit markdown sections
- Each section now uses `### Header` format
- Clear instructions to use markdown headers for sections
- Bullet points only for items within each section

### 2. Improved Parsing Logic (pipeline_processor.py)
- Enhanced regex parsing to skip section headers
- Filters out lines that end with colons or contain section header keywords
- Only extracts actual insight content from bullet points

### 3. Added Structured Insights Support
- Store full structured insights text in `result.structured_insights`
- Use NotionFormatter to properly format structured content
- Fallback to bullet list if structured format unavailable

### 4. Enhanced Notion Formatter
- Added emoji mappings for new section headers:
  - `immediate_actions`: "⚡"
  - `strategic_opportunities`: "🚀"
  - `risk_factors`: "⚠️"
  - `market_implications`: "📰"
  - `innovation_potential`: "🚀"

## Test Results
The test script confirms:
- Proper markdown headers (### format) are generated
- Section headers are correctly formatted as heading_3 blocks in Notion
- Insights are extracted as clean bullet points without header contamination
- Visual hierarchy is maintained with emojis and proper formatting

## Files Modified
1. `/src/enrichment/enhanced_insights.py` - Updated prompt structure
2. `/src/enrichment/pipeline_processor.py` - Improved parsing and added structured insights
3. `/src/utils/notion_formatter.py` - Added emoji mappings for new sections
4. `/tests/test_insights_formatting.py` - Created test to verify fix

## Impact
- Insights now display with proper visual hierarchy in Notion
- Clear section headers make content more scannable
- Maintains backward compatibility with existing data
- Improves overall readability of AI-generated insights