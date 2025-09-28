"""
PDF processing utilities for Drive content.
Enhanced with robust PDF extraction supporting multiple libraries.
"""
import io
import logging
import warnings
from typing import Optional, Dict, Any
from googleapiclient.http import MediaIoBaseDownload
from pdfminer.layout import LAParams
from .robust_pdf_extractor import RobustPDFExtractor

# Suppress specific pdfminer warnings about font descriptors
logging.getLogger('pdfminer').setLevel(logging.ERROR)
warnings.filterwarnings('ignore', message='.*FontBBox.*')


class PDFProcessor:
    """Handles PDF extraction and processing."""
    
    def __init__(self):
        """Initialize PDF processor with robust extraction."""
        self.robust_extractor = RobustPDFExtractor()
        self.logger = logging.getLogger(__name__)

        # Keep LAParams for legacy compatibility if needed
        self.laparams = LAParams(
            line_overlap=0.5,
            char_margin=2.0,
            line_margin=0.5,
            word_margin=0.1,
            boxes_flow=0.5,
            detect_vertical=False,
            all_texts=True
        )
    
    def download_file(self, drive_service, file_id: str) -> bytes:
        """Download a file from Google Drive."""
        request = drive_service.files().get_media(fileId=file_id)
        buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(buffer, request)
        
        done = False
        while not done:
            status, done = downloader.next_chunk()
        
        return buffer.getvalue()
    
    def extract_text_from_pdf(self, pdf_content: bytes) -> Optional[str]:
        """Extract text from PDF content using robust multi-library approach."""
        try:
            # Use robust extractor with multiple fallback methods
            pdf_io = io.BytesIO(pdf_content)
            text, method_used = self.robust_extractor.extract_text(pdf_io)

            if text:
                self.logger.info(f"PDF extraction successful using {method_used}")
                # Clean up the text
                text = self._clean_text(text)
                return text if text.strip() else None
            else:
                self.logger.error(f"PDF extraction failed: {method_used}")
                return None

        except Exception as e:
            self.logger.error(f"Error extracting PDF text: {str(e)}")
            return None
    
    def _clean_text(self, text: str) -> str:
        """Clean and normalize extracted text."""
        # Remove excessive whitespace
        lines = text.split('\n')
        lines = [line.strip() for line in lines if line.strip()]
        
        # Rejoin with single newlines
        text = '\n'.join(lines)
        
        # Remove common PDF artifacts
        text = text.replace('\x0c', '')  # Form feed
        text = text.replace('\xa0', ' ')  # Non-breaking space
        
        return text
    
    def extract_metadata(self, drive_service, file_id: str) -> Dict[str, Any]:
        """Extract metadata from a PDF file."""
        # Get file metadata from Drive
        file_info = drive_service.files().get(
            fileId=file_id,
            fields="name,size,createdTime,modifiedTime,properties"
        ).execute()
        
        return {
            "name": file_info.get("name"),
            "size": file_info.get("size"),
            "created": file_info.get("createdTime"),
            "modified": file_info.get("modifiedTime"),
            "properties": file_info.get("properties", {})
        }