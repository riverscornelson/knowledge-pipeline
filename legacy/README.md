# Legacy Files Directory

This directory contains files that were moved during the v4.0.0 cleanup on 2025-07-21.

## Files in this directory:

### cross_prompt_intelligence.py
- **Original location**: `/src/utils/cross_prompt_intelligence.py`
- **Size**: 33,970 bytes
- **Purpose**: Cross-Prompt Intelligence Engine for detecting relationships across multiple prompt outputs
- **Reason for removal**: No imports found in any Python code
- **Date moved**: 2025-07-21

### prompt_aware_blocks.py
- **Original location**: `/src/enrichment/prompt_aware_blocks.py`
- **Size**: 21,539 bytes
- **Purpose**: Notion Block Generator 2.0 with prompt attribution
- **Reason for removal**: No imports found in any Python code
- **Date moved**: 2025-07-21

## Why these files were preserved:

Rather than deleting potentially useful code, these files were moved to legacy storage because:
1. They contain substantial implementation (10k+ lines combined)
2. They may contain useful patterns or code for future reference
3. They appear to be complete implementations that were never integrated
4. Conservative approach: preserve code that might have historical or reference value

## To restore these files:

If you need to restore any of these files to their original locations:
```bash
# Example: Restore cross_prompt_intelligence.py
mv legacy/cross_prompt_intelligence.py src/utils/

# Example: Restore prompt_aware_blocks.py  
mv legacy/prompt_aware_blocks.py src/enrichment/
```

## Note on other candidates:

The following files were considered but NOT moved:
- `pipeline_processor_enhanced.py` - Kept for potential backward compatibility
- `pipeline_processor_enhanced_formatting.py` - Actively referenced in documentation and migration scripts
- `streamlined_prompt_attribution.py` - File doesn't exist (only .pyc found)