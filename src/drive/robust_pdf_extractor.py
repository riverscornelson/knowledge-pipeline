"""
Robust PDF Content Extractor

Handles PDF extraction with multiple fallback methods to handle problematic PDFs.
Uses pdfplumber, pymupdf, and pdfminer as fallbacks for PyPDF2 failures.
"""

import io
import logging
from typing import Optional, Tuple
from pathlib import Path

# Import libraries with graceful degradation
try:
    import PyPDF2
    HAS_PYPDF2 = True
except ImportError:
    PyPDF2 = None
    HAS_PYPDF2 = False

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    pdfplumber = None
    HAS_PDFPLUMBER = False

try:
    import pymupdf4llm
    import fitz  # PyMuPDF
    HAS_PYMUPDF = True
except ImportError:
    pymupdf4llm = None
    fitz = None
    HAS_PYMUPDF = False

try:
    from pdfminer.high_level import extract_text as pdfminer_extract_text
    from pdfminer.pdfparser import PDFSyntaxError
    HAS_PDFMINER = True
except ImportError:
    pdfminer_extract_text = None
    PDFSyntaxError = Exception
    HAS_PDFMINER = False


class RobustPDFExtractor:
    """Robust PDF content extractor with multiple fallback methods."""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.extraction_methods = []

        # Register available extraction methods in order of preference
        if HAS_PDFPLUMBER:
            self.extraction_methods.append(("pdfplumber", self._extract_with_pdfplumber))
        if HAS_PYMUPDF:
            self.extraction_methods.append(("pymupdf4llm", self._extract_with_pymupdf4llm))
            self.extraction_methods.append(("pymupdf", self._extract_with_pymupdf))
        if HAS_PDFMINER:
            self.extraction_methods.append(("pdfminer", self._extract_with_pdfminer))
        if HAS_PYPDF2:
            self.extraction_methods.append(("pypdf2", self._extract_with_pypdf2))

        self.logger.info(f"Initialized PDF extractor with {len(self.extraction_methods)} methods: {[m[0] for m in self.extraction_methods]}")

    def extract_text(self, pdf_data: io.BytesIO) -> Tuple[Optional[str], str]:
        """
        Extract text from PDF data using the best available method.

        Args:
            pdf_data: BytesIO object containing PDF data

        Returns:
            Tuple of (extracted_text, method_used) or (None, error_message)
        """
        if not self.extraction_methods:
            return None, "No PDF extraction libraries available"

        # Try each method in order until one succeeds
        for method_name, method_func in self.extraction_methods:
            try:
                # Reset stream position for each attempt
                pdf_data.seek(0)
                text = method_func(pdf_data)
                if text and text.strip():
                    self.logger.info(f"Successfully extracted {len(text)} characters using {method_name}")
                    return text, method_name
                else:
                    self.logger.warning(f"{method_name} returned empty text")
            except Exception as e:
                self.logger.warning(f"{method_name} failed: {str(e)}")
                continue

        return None, "All extraction methods failed"

    def _extract_with_pdfplumber(self, pdf_data: io.BytesIO) -> Optional[str]:
        """Extract text using pdfplumber (most reliable for complex layouts)."""
        with pdfplumber.open(pdf_data) as pdf:
            text_parts = []
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
            return "\n".join(text_parts)

    def _extract_with_pymupdf4llm(self, pdf_data: io.BytesIO) -> Optional[str]:
        """Extract text using pymupdf4llm (optimized for LLM processing)."""
        # Save to temporary file since pymupdf4llm expects file path
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
            tmp_file.write(pdf_data.read())
            tmp_file.flush()

            try:
                # Extract with markdown formatting for better structure
                md_text = pymupdf4llm.to_markdown(tmp_file.name)
                return md_text
            finally:
                Path(tmp_file.name).unlink(missing_ok=True)

    def _extract_with_pymupdf(self, pdf_data: io.BytesIO) -> Optional[str]:
        """Extract text using PyMuPDF/fitz (fast and reliable)."""
        doc = fitz.open(stream=pdf_data.read(), filetype="pdf")
        text_parts = []

        for page_num in range(doc.page_count):
            page = doc[page_num]
            text = page.get_text()
            if text:
                text_parts.append(text)

        doc.close()
        return "\n".join(text_parts)

    def _extract_with_pdfminer(self, pdf_data: io.BytesIO) -> Optional[str]:
        """Extract text using pdfminer (good for text-heavy documents)."""
        try:
            text = pdfminer_extract_text(pdf_data)
            return text
        except PDFSyntaxError as e:
            raise Exception(f"PDF syntax error: {e}")

    def _extract_with_pypdf2(self, pdf_data: io.BytesIO) -> Optional[str]:
        """Extract text using PyPDF2 (fallback method)."""
        pdf_reader = PyPDF2.PdfReader(pdf_data)
        text_parts = []

        for page in pdf_reader.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)

        return "\n".join(text_parts)

    def get_available_methods(self) -> list:
        """Get list of available extraction methods."""
        return [method[0] for method in self.extraction_methods]

    def extract_from_file(self, file_path: str) -> Tuple[Optional[str], str]:
        """Extract text from a PDF file path."""
        try:
            with open(file_path, 'rb') as f:
                pdf_data = io.BytesIO(f.read())
            return self.extract_text(pdf_data)
        except Exception as e:
            return None, f"Failed to read file {file_path}: {e}"


def test_pdf_extractor():
    """Test the PDF extractor with a simple example."""
    extractor = RobustPDFExtractor()
    print(f"Available methods: {extractor.get_available_methods()}")

    # You could test with a sample PDF file here
    # text, method = extractor.extract_from_file("sample.pdf")
    # print(f"Extracted using {method}: {text[:200] if text else 'Failed'}")


if __name__ == "__main__":
    test_pdf_extractor()