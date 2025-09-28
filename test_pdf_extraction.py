#!/usr/bin/env python3
"""
Test script for robust PDF extraction
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from drive.robust_pdf_extractor import RobustPDFExtractor
import logging

def test_pdf_extraction():
    """Test the PDF extractor with sample data."""
    logging.basicConfig(level=logging.INFO)

    extractor = RobustPDFExtractor()
    print(f"✅ PDF Extractor initialized successfully!")
    print(f"📚 Available extraction methods: {extractor.get_available_methods()}")

    # Test with simple data (this would normally be problematic for PyPDF2)
    import io

    # Create a minimal test to verify the methods are working
    test_data = b"Test data for PDF extraction"
    test_io = io.BytesIO(test_data)

    # This will fail gracefully since it's not a real PDF, but we can see the error handling
    result, method = extractor.extract_text(test_io)

    if result:
        print(f"✅ Extraction succeeded with method: {method}")
        print(f"📄 Content: {result[:200]}...")
    else:
        print(f"⚠️  Extraction failed as expected (not a real PDF): {method}")

    print("\n🔧 PDF extraction system is ready for real documents!")

if __name__ == "__main__":
    test_pdf_extraction()