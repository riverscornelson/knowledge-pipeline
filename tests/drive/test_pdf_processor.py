"""
Tests for PDF processing functionality.
"""
import pytest
from unittest.mock import patch, Mock, mock_open

from src.drive.pdf_processor import PDFProcessor


class TestPDFProcessor:
    """Test PDFProcessor functionality."""
    
    def test_create_processor(self):
        """Test creating PDFProcessor instance."""
        processor = PDFProcessor()
        assert processor is not None
    
    def test_extract_text_from_pdf(self, sample_pdf_content):
        """Test extracting text from PDF content."""
        # Mock pdfminer components
        with patch('src.drive.pdf_processor.extract_text') as mock_extract_text:
            # Mock successful text extraction
            mock_extract_text.return_value = sample_pdf_content
            
            processor = PDFProcessor()
            # extract_text_from_pdf returns Optional[str], not tuple
            text = processor.extract_text_from_pdf(b"fake pdf content")
            
            # Verify extraction
            assert text is not None
            assert "Test PDF Document" in text
            assert "artificial intelligence" in text
    
    def test_extract_text_handles_errors(self):
        """Test PDF extraction handles errors gracefully."""
        with patch('src.drive.pdf_processor.extract_text') as mock_extract_text:
            mock_extract_text.side_effect = Exception("PDF parsing error")
            
            processor = PDFProcessor()
            # extract_text_from_pdf returns None on error
            text = processor.extract_text_from_pdf(b"invalid pdf")
            
            # Should return None on error
            assert text is None