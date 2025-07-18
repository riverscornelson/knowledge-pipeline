# Build a Local PDF Upload Preprocessor for Knowledge Pipeline

## Feature Overview
Add a preprocessing step to the main pipeline that uploads local PDFs from Downloads to Google Drive before standard processing.

## Core Requirements

### 1. Module Structure
```
src/local_uploader/
├── __init__.py
├── preprocessor.py  # Main preprocessing logic
└── filename_cleaner.py  # Clean up PDF names
```

### 2. Integration with Pipeline

**Update `scripts/run_pipeline.py`:**
```python
# Add parameter
parser.add_argument('--process-local', action='store_true', 
                    help='Upload local PDFs to Drive before processing')

# Add preprocessing step before main pipeline
if args.process_local:
    local_stats = preprocessor.process_local_pdfs()
    print(f"Uploaded {local_stats['uploaded']} new PDFs to Drive")
```

### 3. Implementation

**Preprocessor** (`preprocessor.py`):
- Scan Downloads for PDFs from last 7 days
- Use `DeduplicationService.calculate_hash()` to get SHA-256
- Check if hash exists in Notion via `NotionClient.check_hash_exists()`
- Skip if already processed (any source)
- Clean filename and upload new files
- Return stats

**Filename Cleaner** (`filename_cleaner.py`):
```python
def clean_pdf_filename(filename: str) -> str:
    """Clean common PDF naming issues."""
    # Remove prefixes
    name = re.sub(r'^Gmail\s*-\s*', '', filename)
    
    # URL decode
    name = urllib.parse.unquote(name)
    
    # Remove download artifacts
    name = re.sub(r'\s*\(\d+\)\.pdf$', '.pdf', name, flags=re.I)
    
    # Remove redundant version markers
    name = re.sub(r'(_final|_FINAL|_v\d+|_edited)+\.pdf$', '.pdf', name, flags=re.I)
    
    # Normalize whitespace and separators
    name = re.sub(r'[\s_-]+', ' ', name).strip()
    
    return name
```

### 4. Configuration
Add to `PipelineConfig`:
```python
@dataclass
class LocalUploaderConfig:
    enabled: bool = False
    scan_days: int = 7
    upload_folder_id: Optional[str] = None  # Uses default Drive folder if None
    delete_after_upload: bool = False
    
    @classmethod
    def from_env(cls) -> "LocalUploaderConfig":
        return cls(
            enabled=os.getenv("LOCAL_UPLOADER_ENABLED", "false").lower() == "true",
            scan_days=int(os.getenv("LOCAL_SCAN_DAYS", "7")),
            upload_folder_id=os.getenv("LOCAL_UPLOAD_FOLDER_ID"),
            delete_after_upload=os.getenv("LOCAL_DELETE_AFTER_UPLOAD", "false").lower() == "true"
        )
```

### 5. Update Existing Files

**`src/core/config.py`:**
- Add `LocalUploaderConfig` class
- Add to `PipelineConfig`: `local_uploader: LocalUploaderConfig`

**`src/drive/ingester.py`:**
- Add method `upload_local_file(filepath: str, cleaned_name: str) -> str`
- Returns Drive file ID

**`docs/getting-started/quick-start.md`:**
Add new option:
```bash
# Full pipeline with local PDF upload
python scripts/run_pipeline.py --process-local

# Process only local files
python scripts/run_pipeline.py --process-local --skip-enrichment
```

**`README.md`:**
Add to features list:
- **Local PDF Upload**: Automatically upload PDFs from Downloads to Drive

**`.env.example`:**
```bash
# Local PDF Upload (optional)
LOCAL_UPLOADER_ENABLED=false
LOCAL_SCAN_DAYS=7
LOCAL_DELETE_AFTER_UPLOAD=false
```

### 6. Implementation Flow
```python
# In preprocessor.py
def process_local_pdfs(config: PipelineConfig, notion_client: NotionClient) -> Dict[str, int]:
    """Process local PDFs by uploading to Drive."""
    stats = {"scanned": 0, "uploaded": 0, "skipped": 0}
    
    # Find PDFs from last N days
    pdf_files = find_recent_pdfs(config.local_uploader.scan_days)
    stats["scanned"] = len(pdf_files)
    
    for pdf_path in pdf_files:
        # Calculate hash
        with open(pdf_path, 'rb') as f:
            file_hash = DeduplicationService().calculate_hash(f.read())
        
        # Check if already processed
        if notion_client.check_hash_exists(file_hash):
            stats["skipped"] += 1
            continue
        
        # Clean filename
        clean_name = clean_pdf_filename(pdf_path.name)
        
        # Upload to Drive
        drive_ingester = DriveIngester(config, notion_client)
        file_id = drive_ingester.upload_local_file(pdf_path, clean_name)
        
        stats["uploaded"] += 1
        logger.info(f"Uploaded: {pdf_path.name} → {clean_name}")
        
        # Optional: delete local file
        if config.local_uploader.delete_after_upload:
            pdf_path.unlink()
    
    return stats
```

### 7. Usage Examples
```bash
# Standard pipeline
python scripts/run_pipeline.py

# Pipeline with local upload
python scripts/run_pipeline.py --process-local

# Just upload local files (no enrichment)
python scripts/run_pipeline.py --process-local --skip-enrichment

# Dry run to see what would be uploaded
python scripts/run_pipeline.py --process-local --dry-run
```

## Key Benefits
- Uses existing SHA deduplication - no duplicate processing
- Seamless pipeline integration via `--process-local` flag
- All files get Drive URLs for consistency
- Smart filename cleaning improves organization
- Zero changes to existing enrichment flow