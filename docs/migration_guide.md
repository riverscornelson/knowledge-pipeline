# Migration Guide: Knowledge Pipeline v2.0

This guide helps you migrate from the flat structure to the new modular organization.

## Overview of Changes

### 1. Project Structure
- **Old**: All Python files in root directory
- **New**: Organized package structure under `src/` with clear separation of concerns

### 2. Configuration Management
- **Old**: Environment variables loaded directly in each script
- **New**: Centralized `PipelineConfig` class in `src/core/config.py`

### 3. Priority-Based Organization
- **Old**: All sources treated equally
- **New**: Drive as primary source, others in `secondary_sources/`

### 4. Newsletter Deprecation
- **Old**: Daily newsletter integrated into main pipeline
- **New**: Newsletter functionality moved to `src/deprecated/` for removal

## Migration Steps

### Step 1: Install New Structure
```bash
# Create new virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install in development mode
pip install -e .
```

### Step 2: Update Environment Variables
No changes needed! The new system uses the same environment variables.

### Step 3: Update Pipeline Scripts
Replace old shell scripts with new Python runner:

**Old way:**
```bash
./pipeline_consolidated.sh
```

**New way:**
```bash
# Run complete pipeline
python scripts/run_pipeline.py

# Run only Drive ingestion
python scripts/run_pipeline.py --source drive

# Dry run to test
python scripts/run_pipeline.py --dry-run
```

### Step 4: Update Imports (for custom scripts)
If you have custom scripts, update imports:

**Old:**
```python
from ingest_drive import main
from enrich_consolidated import enrich_content
```

**New:**
```python
from src.drive.ingester import DriveIngester
from src.enrichment.processor import EnrichmentProcessor
```

### Step 5: Archive Old Files
Once confirmed working:
```bash
# Create archive of old structure
mkdir archive_v1
mv *.py archive_v1/  # Move old Python files
mv pipeline*.sh archive_v1/  # Move old shell scripts
```

## API Changes

### Drive Ingestion
**Old:**
```python
# Direct script execution
python ingest_drive.py
```

**New:**
```python
from src.core.config import PipelineConfig
from src.core.notion_client import NotionClient
from src.drive.ingester import DriveIngester

config = PipelineConfig.from_env()
notion = NotionClient(config.notion)
ingester = DriveIngester(config, notion)
stats = ingester.ingest()
```

### Configuration Access
**Old:**
```python
NOTION_TOKEN = os.getenv("NOTION_TOKEN")
```

**New:**
```python
from src.core.config import PipelineConfig
config = PipelineConfig.from_env()
token = config.notion.token
```

## Testing the Migration

1. **Test Drive ingestion**:
   ```bash
   python scripts/run_pipeline.py --source drive --dry-run
   ```

2. **Check logs**:
   ```bash
   tail -f logs/pipeline.jsonl | jq .
   ```

3. **Verify in Notion**:
   - Check that new items appear with Status="Inbox"
   - Ensure no duplicates are created

## Rollback Plan

If issues arise:
1. Stop the new pipeline
2. Use files in `archive_v1/` directory
3. Run old `pipeline_consolidated.sh`

## Deprecation Timeline

- **Newsletter functionality**: Will be removed in 30 days
- **Old file structure**: Archive after successful migration
- **Secondary sources**: Maintained but lower priority

## Getting Help

- Check logs in `logs/pipeline.jsonl` for detailed error messages
- Review test output with `--dry-run` flag
- Ensure all environment variables are set correctly