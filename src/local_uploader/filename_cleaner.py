"""Filename cleaning utilities for PDF files."""

import re
import urllib.parse
from typing import Optional


def clean_pdf_filename(filename: str) -> str:
    """Clean common PDF naming issues.
    
    This function addresses common filename issues from various sources:
    - Gmail download prefixes
    - URL encoding artifacts
    - Duplicate version markers
    - Download counter suffixes (e.g., "file (1).pdf")
    - Excessive whitespace and separators
    
    Args:
        filename: The original PDF filename
        
    Returns:
        str: Cleaned filename with .pdf extension
    """
    if not filename:
        return "untitled.pdf"
    
    # Remove Gmail prefix (e.g., "Gmail - ")
    name = re.sub(r'^Gmail\s*-\s*', '', filename)
    
    # URL decode the filename
    name = urllib.parse.unquote(name)
    
    # Remove download counter artifacts (e.g., " (1).pdf", " (23).pdf")
    name = re.sub(r'\s*\(\d+\)\.pdf$', '.pdf', name, flags=re.I)
    
    # Remove redundant version markers (e.g., "_final", "_FINAL", "_v2", "_edited")
    name = re.sub(r'(_final|_FINAL|_v\d+|_edited)+\.pdf$', '.pdf', name, flags=re.I)
    
    # Remove any duplicate .pdf extensions
    name = re.sub(r'(\.pdf)+$', '.pdf', name, flags=re.I)
    
    # Normalize whitespace and separators (replace multiple spaces, underscores, hyphens)
    name = re.sub(r'[\s_-]+', ' ', name).strip()
    
    # Ensure the name ends with .pdf
    if not name.lower().endswith('.pdf'):
        name += '.pdf'
    
    # Final cleanup: remove any remaining special characters that might cause issues
    # Keep alphanumeric, spaces, dots, hyphens, and underscores
    name = re.sub(r'[^\w\s.-]', '', name)
    
    # One more normalization pass
    name = re.sub(r'\s+', ' ', name).strip()
    
    # Ensure we don't return an empty filename
    if not name or name == '.pdf':
        return "untitled.pdf"
    
    return name


def sanitize_for_drive(filename: str) -> str:
    """Additional sanitization for Google Drive compatibility.
    
    Google Drive has some specific restrictions on filenames.
    This function ensures the filename is safe for Drive upload.
    
    Args:
        filename: Cleaned filename from clean_pdf_filename
        
    Returns:
        str: Drive-safe filename
    """
    # Remove characters that might cause issues in Drive
    # Keep: alphanumeric, spaces, dots, hyphens, underscores, parentheses
    name = re.sub(r'[^\w\s.\-()]', '', filename)
    
    # Remove leading/trailing dots (Drive doesn't like these)
    name = name.strip('.')
    
    # Limit length to 255 characters (including extension)
    if len(name) > 255:
        # Keep the extension
        base_name = name[:-4] if name.lower().endswith('.pdf') else name
        extension = '.pdf' if name.lower().endswith('.pdf') else ''
        name = base_name[:251] + extension
    
    return name