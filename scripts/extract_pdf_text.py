import json
import os
import pypdf

# Config
COURSES_JSON = "courses.json"
OUTPUT_DIR = "extracted_data"
os.makedirs(OUTPUT_DIR, exist_ok=True)

def extract_text_from_pdf(pdf_path):
    text = ""
    try:
        reader = pypdf.PdfReader(pdf_path)
        for page in reader.pages:
            text += page.extract_text() + "\n"
    except Exception as e:
        print(f"Error reading {pdf_path}: {e}")
    return text

def main():
    if not os.path.exists(COURSES_JSON):
        print("courses.json not found")
        return

    with open(COURSES_JSON, 'r') as f:
        courses = json.load(f)

    # We will process a subset or all? 
    # Let's try to do all of them but report progress.
    
    summary_log = os.path.join(OUTPUT_DIR, "extraction_summary.json")
    extraction_results = {}

    print(f"Processing {len(courses)} courses...")

    for key, course in courses.items():
        if "pdf" in course and course["pdf"]:
            pdf_path = course["pdf"]
            if os.path.exists(pdf_path):
                print(f"Extracting: {course['title']}")
                raw_text = extract_text_from_pdf(pdf_path)
                
                # Save individual text file
                safe_name = key.replace("/", "_") + ".txt"
                out_path = os.path.join(OUTPUT_DIR, safe_name)
                
                with open(out_path, 'w', encoding='utf-8') as Out:
                    Out.write(raw_text)
                    
                extraction_results[key] = {
                    "title": course['title'],
                    "text_file": out_path,
                    "char_count": len(raw_text)
                }
            else:
                print(f"PDF Missing: {pdf_path}")
    
    with open(summary_log, 'w', encoding='utf-8') as f:
        json.dump(extraction_results, f, indent=4)
        
    print(f"Done. Extracted text for {len(extraction_results)} courses.")

if __name__ == "__main__":
    main()
