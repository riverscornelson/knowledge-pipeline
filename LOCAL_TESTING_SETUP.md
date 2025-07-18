# Local Testing Setup for File System Watcher Feature

## Prerequisites

1. **Python Environment**: Ensure you have Python 3.8+ installed
2. **Google Drive API**: Set up Google Drive API credentials
3. **Notion API**: Configure Notion database and API key
4. **Test PDFs**: Place some PDF files in your Downloads folder

## Setup Instructions

### 1. Environment Configuration

Create or update your `.env` file with the following:

```bash
# Google Drive Configuration
GOOGLE_DRIVE_FOLDER_ID=your_drive_folder_id_here
# Get credentials from: https://console.cloud.google.com/apis/credentials

# Notion Configuration
NOTION_API_KEY=your_notion_api_key_here
NOTION_DATABASE_ID=your_notion_database_id_here

# OpenAI Configuration (for enrichment)
OPENAI_API_KEY=your_openai_api_key_here

# Local PDF Upload Configuration
LOCAL_UPLOADER_ENABLED=true
LOCAL_SCAN_DAYS=7  # Look for PDFs from last 7 days
LOCAL_DELETE_AFTER_UPLOAD=false  # Keep files after upload for testing
# LOCAL_UPLOAD_FOLDER_ID=specific_folder_id  # Optional: specific folder for uploads
```

### 2. Custom Downloads Location

If you want to test with a custom directory instead of ~/Downloads:

```python
# In your test script or when calling the function directly:
from pathlib import Path
from src.local_uploader.preprocessor import process_local_pdfs
from src.core.config import PipelineConfig
from src.core.notion_client import NotionClient

# Use a custom test directory
test_downloads = Path("/path/to/your/test/pdfs")
config = PipelineConfig.from_env()
notion_client = NotionClient(config.notion)

# Process PDFs from custom location
stats = process_local_pdfs(config, notion_client, download_path=test_downloads)
```

### 3. Testing Workflow

#### A. Basic Test
```bash
# Dry run to see what would be uploaded
python scripts/run_pipeline.py --process-local --dry-run

# Actually upload local PDFs
python scripts/run_pipeline.py --process-local

# Upload without enrichment (faster for testing)
python scripts/run_pipeline.py --process-local --skip-enrichment
```

#### B. Unit Tests
```bash
# Run the test suite
python test_local_uploader.py
```

#### C. Test Different Filename Scenarios

Create test PDFs with these naming patterns to verify cleaning:
- `Gmail - Important Document.pdf` → `Important Document.pdf`
- `document%20with%20spaces.pdf` → `document with spaces.pdf`
- `report_v2_final_FINAL.pdf` → `report.pdf`
- `presentation (1).pdf` → `presentation.pdf`

### 4. IDE Testing Setup

For VS Code or other IDEs:

1. **Launch Configuration** (`.vscode/launch.json`):
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Test Local Upload",
            "type": "python",
            "request": "launch",
            "program": "${workspaceFolder}/scripts/run_pipeline.py",
            "args": ["--process-local", "--dry-run"],
            "console": "integratedTerminal",
            "env": {
                "PYTHONPATH": "${workspaceFolder}"
            }
        },
        {
            "name": "Test Filename Cleaner",
            "type": "python",
            "request": "launch",
            "program": "${workspaceFolder}/test_local_uploader.py",
            "console": "integratedTerminal",
            "env": {
                "PYTHONPATH": "${workspaceFolder}"
            }
        }
    ]
}
```

2. **Testing with Custom Directory**:
```python
# Create a test script: test_custom_location.py
from pathlib import Path
from src.local_uploader.preprocessor import process_local_pdfs
from src.core.config import PipelineConfig
from src.core.notion_client import NotionClient

# Set up test directory
test_dir = Path("./test_pdfs")
test_dir.mkdir(exist_ok=True)

# Copy some PDFs to test_dir for testing
# ...

# Run the processor
config = PipelineConfig.from_env()
notion_client = NotionClient(config.notion)
stats = process_local_pdfs(config, notion_client, download_path=test_dir)
print(f"Results: {stats}")
```

### 5. Monitoring & Debugging

Enable detailed logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

Watch the logs for:
- Which PDFs are found
- Hash calculations
- Duplicate detection
- Upload progress
- Any errors

### 6. Common Issues & Solutions

1. **"Download path does not exist"**
   - Ensure the Downloads folder exists or specify a custom path
   - Check permissions on the directory

2. **"Google Drive API not initialized"**
   - Ensure you have valid Google credentials
   - Check that `GOOGLE_DRIVE_FOLDER_ID` is set

3. **"Failed to upload"**
   - Check Google Drive API quotas
   - Verify folder permissions
   - Check file size limits

4. **Duplicates not detected**
   - Verify Notion database has the required `sha256_hash` property
   - Check that the hash is being calculated correctly

### 7. Performance Testing

For bulk testing:
```bash
# Process many files
LOCAL_SCAN_DAYS=30 python scripts/run_pipeline.py --process-local

# Time the operation
time python scripts/run_pipeline.py --process-local --skip-enrichment
```

## Next Steps

1. Test with various PDF filenames to ensure cleaning works correctly
2. Verify deduplication by running the same command twice
3. Check that files appear in Google Drive with cleaned names
4. Confirm Notion database entries are created properly
5. Test error scenarios (no internet, invalid credentials, etc.)