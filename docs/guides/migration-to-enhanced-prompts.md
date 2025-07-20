# Migration Guide: Enhanced Prompt System

This guide helps existing Knowledge Pipeline users migrate to the enhanced prompt system with Notion integration and advanced formatting capabilities.

## What's New

### 🚀 Major Enhancements

1. **Dynamic Prompt Management**
   - Edit prompts in Notion without code changes
   - Version control and A/B testing capabilities
   - Live updates (5-minute cache)

2. **Enhanced Notion Formatting**
   - Rich text formatting with headers, bullets, and tables
   - Callout boxes for important information
   - Toggle sections for detailed content
   - Improved visual hierarchy

3. **Advanced Content Analysis**
   - Semantic content classification
   - Quality scoring (0-100%)
   - AI vendor detection
   - Intelligent tagging system

4. **Web Search Integration**
   - Per-prompt web search configuration
   - Context-aware search activation
   - Research validation capabilities

## Migration Path

### Phase 1: Basic Setup (Required)

#### 1. Update Dependencies

```bash
# Update to latest version
git pull origin main

# Install new dependencies
pip install -r requirements.txt
```

#### 2. Environment Configuration

Add to your `.env` file:

```bash
# Enable enhanced features (optional during transition)
USE_ENHANCED_PROMPTS=false  # Start with false, enable when ready

# Prepare for Notion integration (optional)
NOTION_API_KEY=  # Leave empty initially
NOTION_PROMPTS_DATABASE_ID=  # Leave empty initially
```

#### 3. Test Existing Functionality

```bash
# Run pipeline with existing configuration
python scripts/run_pipeline.py

# Verify outputs match expected format
```

### Phase 2: Notion Integration (Optional but Recommended)

#### 1. Create Notion Database

Follow the [Notion Database Setup Guide](../setup/notion-prompt-database-setup.md) to:
- Create the prompts database
- Configure required properties
- Set up integration access

#### 2. Migrate YAML Prompts to Notion

```python
# Use migration script
python scripts/migrate_prompts_to_notion.py

# This will:
# - Read existing YAML prompts
# - Create Notion database entries
# - Preserve all configurations
```

#### 3. Enable Enhanced System

Update `.env`:

```bash
USE_ENHANCED_PROMPTS=true
NOTION_API_KEY=secret_your_actual_key_here
NOTION_PROMPTS_DATABASE_ID=your_database_id_here
```

### Phase 3: Enhanced Features Adoption

#### 1. Test Enhanced Formatting

```bash
# Process a test document
python scripts/run_pipeline.py --test-doc

# Review Notion output for:
# - Proper formatting (headers, bullets)
# - Callout boxes
# - Toggle sections
# - Quality scores
```

#### 2. Customize Prompts

In Notion, experiment with:
- Different prompt templates
- Web search enablement
- Content-type specific instructions

#### 3. Monitor Quality Metrics

```bash
# Enable quality tracking
export LOG_LEVEL=INFO

# Run pipeline and observe:
# - Classification confidence
# - Quality scores
# - Processing times
```

## Backward Compatibility

### What's Preserved

✅ **Full backward compatibility** when `USE_ENHANCED_PROMPTS=false`:
- Original YAML-based configuration
- Same output format
- Identical processing logic
- No breaking changes

### Gradual Migration Options

1. **Hybrid Mode** - Use YAML with selective Notion overrides
2. **Testing Mode** - Run both systems in parallel
3. **Rollback Support** - Easy reversion to YAML-only

## Common Migration Scenarios

### Scenario 1: Conservative Migration

For production systems requiring stability:

```bash
# 1. Keep using YAML prompts
USE_ENHANCED_PROMPTS=false

# 2. Test enhanced features in staging
# 3. Migrate one content type at a time
# 4. Monitor for 1 week before full migration
```

### Scenario 2: Feature-First Migration

For teams wanting immediate benefits:

```bash
# 1. Enable all enhanced features
USE_ENHANCED_PROMPTS=true

# 2. Set up Notion database
# 3. Import all prompts
# 4. Start customizing immediately
```

### Scenario 3: Selective Enhancement

For specific use cases:

```bash
# 1. Enable enhanced prompts
USE_ENHANCED_PROMPTS=true

# 2. Create Notion prompts only for:
#    - Research content (better analysis)
#    - Market news (web search benefits)
# 3. Keep others in YAML
```

## Troubleshooting

### Issue: Pipeline Still Using YAML Prompts

**Solution:**
1. Verify `USE_ENHANCED_PROMPTS=true`
2. Check Notion connection:
   ```python
   python scripts/verify_notion_setup.py
   ```
3. Ensure prompts are marked Active in Notion

### Issue: Formatting Not Applied

**Solution:**
1. Check logs for `Applied enhanced formatting` messages
2. Verify Notion page has edit permissions
3. Review [Formatting Guidelines](../formatting-guidelines.md)

### Issue: Performance Degradation

**Solution:**
1. Check cache is working (5-minute refresh)
2. Monitor API rate limits
3. Consider batching operations

### Issue: Quality Scores Lower Than Expected

**Solution:**
1. Review prompt templates
2. Ensure content type classification is correct
3. Check for proper text extraction from PDFs

## Performance Considerations

### Expected Changes

- **Initial Load**: +2-3 seconds for Notion connection
- **Per Document**: +1-2 seconds for enhanced formatting
- **Cache Hit**: No performance impact
- **Quality Improvement**: 15-20% better content analysis

### Optimization Tips

1. **Batch Processing**: Process multiple documents together
2. **Cache Warming**: Pre-load prompts before batch runs
3. **Selective Enhancement**: Enable features only where needed

## Rollback Procedure

If issues arise, rollback is simple:

```bash
# 1. Disable enhanced features
USE_ENHANCED_PROMPTS=false

# 2. Clear any cached data
rm -rf .cache/

# 3. Restart pipeline
python scripts/run_pipeline.py
```

## Support Resources

- **Documentation**: Review updated guides in `/docs`
- **Examples**: See `/tests/formatting-scenarios/`
- **Issues**: Report at [GitHub Issues](https://github.com/your-repo/issues)
- **Community**: Join discussions in Slack/Discord

## Next Steps

1. ✅ Complete Phase 1 (Basic Setup)
2. 📋 Plan Phase 2 timing (Notion Integration)
3. 🚀 Test Phase 3 features (Enhancement Adoption)
4. 📊 Monitor metrics for 1 week
5. 🎯 Full production deployment

## Migration Checklist

- [ ] Updated dependencies
- [ ] Configured environment variables
- [ ] Tested existing functionality
- [ ] Created Notion database (optional)
- [ ] Migrated prompts (optional)
- [ ] Enabled enhanced features
- [ ] Tested formatting output
- [ ] Monitored quality metrics
- [ ] Documented custom configurations
- [ ] Trained team on new features

Remember: Migration can be gradual. Start with what makes sense for your use case and expand as confidence grows.