import os
import json
import re

EXTRACTED_DATA_DIR = "extracted_data"
PROCESSED_COURSES_DIR = "processed_courses"
INDEX_FILE = os.path.join(PROCESSED_COURSES_DIR, "index.json")

def load_index():
    if os.path.exists(INDEX_FILE):
        with open(INDEX_FILE, "r") as f:
            return json.load(f)
    return {}

def save_index(index):
    try:
        with open(INDEX_FILE, "w") as f:
            json.dump(index, f, indent=4)
        print(f"Index saved to {INDEX_FILE}")
    except Exception as e:
        print(f"Error saving index: {e}")

def normalize_filename(filename):
    # Remove extension
    name = os.path.splitext(filename)[0]
    # Remove common prefixes/suffixes
    name = re.sub(r'^\d+[-_]', '', name) # Remove leading numbers like "01-"
    name = re.sub(r'[-_]\d{4}$', '', name) # Remove trailing years like "-2021"
    name = name.replace("affiches-pedagogiques-a3_", "")
    name = name.replace("-", " ").replace("_", " ")
    return name.strip().title()

def scan_files():
    if not os.path.exists(EXTRACTED_DATA_DIR):
        print(f"Directory {EXTRACTED_DATA_DIR} not found.")
        return []
    
    files = [f for f in os.listdir(EXTRACTED_DATA_DIR) if f.endswith(".txt")]
    return sorted(files)

def main():
    if not os.path.exists(PROCESSED_COURSES_DIR):
        os.makedirs(PROCESSED_COURSES_DIR)
        os.makedirs(os.path.join(PROCESSED_COURSES_DIR, "cours"))
        os.makedirs(os.path.join(PROCESSED_COURSES_DIR, "quiz"))

    index = load_index()
    files = scan_files()
    
    print(f"Found {len(files)} files in {EXTRACTED_DATA_DIR}")
    
    unprocessed = []
    for f in files:
        if f not in index:
            suggested_name = normalize_filename(f)
            unprocessed.append({"file": f, "suggested": suggested_name})
    
    print(f"Unprocessed: {len(unprocessed)}")
    for item in unprocessed[:10]:
        print(f" - {item['file']} -> {item['suggested']}")

if __name__ == "__main__":
    main()
