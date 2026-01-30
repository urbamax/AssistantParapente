import sys
import os

try:
    import pypdf
    print("pypdf is installed")
except ImportError:
    print("pypdf is NOT installed")

def extract_text(pdf_path):
    print(f"Attempting to extract text from {pdf_path}")
    try:
        # Fallback to simple string extraction if no lib (very crude)
        # Or check if we can use a system command like pdftotext
        pass
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Test with one known PDF
    test_pdf = "img/course/facteurs_humains/1-fh-check-list/1-fh-check-list.pdf"
    if os.path.exists(test_pdf):
        # Try simple read binary to see header
        with open(test_pdf, 'rb') as f:
            header = f.read(5)
            print(f"Header: {header}")
            
        # Check for pdftotext command availability
        res = os.system("pdftotext -v")
        print(f"pdftotext exit code: {res}")
        
    else:
        print("Test file not found")
