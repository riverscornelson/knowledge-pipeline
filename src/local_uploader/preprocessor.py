"""Main preprocessing logic for local PDF uploads."""

import os
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import logging

from ..core.config import PipelineConfig
from ..core.notion_client import NotionClient
from ..drive.deduplication import DeduplicationService
from ..drive.ingester import DriveIngester
from .filename_cleaner import clean_pdf_filename, sanitize_for_drive

logger = logging.getLogger(__name__)


def find_recent_pdfs(scan_days: int, download_path: Optional[Path] = None) -> List[Path]:
    """Find PDF files modified within the last N days.
    
    Args:
        scan_days: Number of days to look back
        download_path: Path to scan (defaults to ~/Downloads)
        
    Returns:
        List of Path objects for PDF files
    """
    if download_path is None:
        download_path = Path.home() / "Downloads"
    
    if not download_path.exists():
        logger.warning(f"Download path does not exist: {download_path}")
        return []
    
    # Calculate cutoff time
    cutoff_time = datetime.now() - timedelta(days=scan_days)
    
    pdf_files = []
    for file_path in download_path.glob("*.pdf"):
        if file_path.is_file():
            # Check modification time
            mod_time = datetime.fromtimestamp(file_path.stat().st_mtime)
            if mod_time >= cutoff_time:
                pdf_files.append(file_path)
    
    return sorted(pdf_files, key=lambda p: p.stat().st_mtime, reverse=True)


def process_local_pdfs(
    config: PipelineConfig, 
    notion_client: NotionClient,
    download_path: Optional[Path] = None
) -> Dict[str, int]:
    """Process local PDFs by uploading to Drive.
    
    This function:
    1. Scans the Downloads folder for recent PDFs
    2. Checks if each PDF has already been processed (via hash)
    3. Uploads new PDFs to Google Drive
    4. Optionally deletes local files after upload
    
    Args:
        config: Pipeline configuration
        notion_client: Notion client for checking existing hashes
        download_path: Optional custom path to scan
        
    Returns:
        Dictionary with statistics:
        - scanned: Total PDFs found
        - uploaded: PDFs successfully uploaded
        - skipped: PDFs already in the system
        - errors: PDFs that failed to upload
    """
    stats = {"scanned": 0, "uploaded": 0, "skipped": 0, "errors": 0}
    
    # Check if local uploader is enabled
    if not hasattr(config, 'local_uploader') or not config.local_uploader.enabled:
        logger.info("Local uploader is not enabled")
        return stats
    
    # Initialize services
    dedup_service = DeduplicationService()
    drive_ingester = DriveIngester(config, notion_client)
    
    # Find PDFs from last N days
    logger.info(f"Scanning for PDFs from last {config.local_uploader.scan_days} days...")
    pdf_files = find_recent_pdfs(config.local_uploader.scan_days, download_path)
    stats["scanned"] = len(pdf_files)
    logger.info(f"Found {len(pdf_files)} PDF files to process")
    
    for pdf_path in pdf_files:
        try:
            # Calculate hash
            logger.debug(f"Processing: {pdf_path.name}")
            with open(pdf_path, 'rb') as f:
                file_content = f.read()
                file_hash = dedup_service.calculate_hash(file_content)
            
            # Check if already processed
            if notion_client.check_hash_exists(file_hash):
                logger.debug(f"Skipping (already processed): {pdf_path.name}")
                stats["skipped"] += 1
                continue
            
            # Clean filename
            original_name = pdf_path.name
            clean_name = clean_pdf_filename(original_name)
            drive_safe_name = sanitize_for_drive(clean_name)
            
            logger.info(f"Uploading: {original_name} → {drive_safe_name}")
            
            # Upload to Drive
            file_id = drive_ingester.upload_local_file(str(pdf_path), drive_safe_name)
            
            if file_id:
                stats["uploaded"] += 1
                logger.info(f"Successfully uploaded: {drive_safe_name} (ID: {file_id})")
                
                # Optional: delete local file after successful upload
                if config.local_uploader.delete_after_upload:
                    pdf_path.unlink()
                    logger.debug(f"Deleted local file: {pdf_path}")
            else:
                stats["errors"] += 1
                logger.error(f"Failed to upload: {pdf_path.name}")
                
        except Exception as e:
            stats["errors"] += 1
            logger.error(f"Error processing {pdf_path.name}: {str(e)}")
    
    # Log summary
    logger.info(
        f"Local upload complete: "
        f"{stats['uploaded']} uploaded, "
        f"{stats['skipped']} skipped, "
        f"{stats['errors']} errors"
    )
    
    return stats