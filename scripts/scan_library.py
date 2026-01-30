import os
import json
import re
import unicodedata

COURSE_ROOT = "img/course"

# Map folder names to Levels
LEVEL_MAP = {
    "BREVET INITIAL": "BI",
    "VERT": "BI",
    "BREVET DE PILOTE": "BP",
    "BLEU": "BP",
    "CONFIRME": "BPC",
    "MARRON": "BPC",
    "GENERAL": "GENERAL"
}

def normalize_str(s):
    return unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode('ascii').upper()

def get_level_from_path(path_parts):
    # Check the top-level folder (parts[0]) against map
    if not path_parts:
        return ["GENERAL"]
    
    top_folder = normalize_str(path_parts[0])
    
    # Check for direct matches or keywords
    found_levels = set()
    
    for key, code in LEVEL_MAP.items():
        if key in top_folder:
            found_levels.add(code)
            
    # Priority Resolution
    if "BPC" in found_levels: return ["BPC"]
    if "BP" in found_levels: return ["BP"]
    if "BI" in found_levels: return ["BI"]
    
    return ["GENERAL"]

def scan_library():
    courses_config = {}
    
    print(f"Scanning {COURSE_ROOT}...")
    
    for root, dirs, files in os.walk(COURSE_ROOT):
        # Calculate relative path from course root
        rel_path = os.path.relpath(root, COURSE_ROOT)
        if rel_path == '.': continue
        
        parts = rel_path.split(os.sep)
        
        # Current logic assumes: img/course/{LEVEL_FOLDER}/{CATEGORY}/{COURSE...}
        # But maybe just {LEVEL}/{COURSE} or {CATEGORY}/{COURSE} in General?
        # We derive level from the top folder regardless.
        
        current_level = get_level_from_path(parts)
        
        # Check for PDF Courses (File = Course)
        pdfs = [f for f in files if f.lower().endswith('.pdf')]
        
        for pdf in pdfs:
            # Course Name matches filename
            raw_app_name = os.path.splitext(pdf)[0]
            
            # Category: The folder containing the PDF
            # If parts = ['BREVET INITIAL - VERT', 'Facteurs Humains'] -> Category = Facteurs Humains
            # If parts = ['BREVET INITIAL - VERT'] -> Category = (Folder Name) or General? -> Usually Category is needed.
            
            if len(parts) > 1:
                category = parts[-1] 
            else:
                category = parts[0] # Fallback
                
            # Full Path relative to index.html (img/course/...)
            full_pdf_path = os.path.join(COURSE_ROOT, rel_path, pdf)
            
            # Key: Normalize distinct key
            key_raw = os.path.join(rel_path, raw_app_name)
            config_key = normalize_str(key_raw).replace(' ', '-').replace('_', '-').lower()
            
            courses_config[config_key] = {
                "title": raw_app_name.replace('_', ' ').replace('-', ' '),
                "category": category.replace('_', ' '),
                "path": os.path.dirname(full_pdf_path), # Path to folder containing pdf? Or path to image folder? 
                                                        # The viewer expects "path" to be a folder for images. 
                                                        # For PDF only courses, path is less critical but let's point to dir.
                "pages": 0,
                "pdf": full_pdf_path,
                "level": current_level
            }
            print(f"Index PDF: {raw_app_name} [{current_level[0]}]")

        # Check for Image Courses (Folder = Course)
        images = [f for f in files if f.lower().endswith(('.png', '.jpg'))]
        if images:
            # This whole folder is a course
            # Course Name = Folder Name (parts[-1])
            course_name = parts[-1]
            
            # Category = Parent folder (parts[-2]) or Top folder
            if len(parts) > 2:
                category = parts[-2]
            elif len(parts) > 1:
                category = parts[0]
            else:
                category = "General"

            # Determine Level (same logic)
            # Find PDF inside?
            course_pdf = None
            if pdfs:
                course_pdf = os.path.join(COURSE_ROOT, rel_path, pdfs[0])

            config_key = normalize_str(rel_path).replace(' ', '-').replace('_', '-').lower()
            
            courses_config[config_key] = {
                "title": course_name.replace('_', ' ').replace('-', ' '),
                "category": category.replace('_', ' '),
                "path": os.path.join(COURSE_ROOT, rel_path),
                "pages": len(images),
                "pdf": course_pdf, # Can be null if only images
                "level": current_level
            }
            print(f"Index Bundle: {course_name} [{current_level[0]}]")

    # Write Config
    with open('courses.json', 'w', encoding='utf-8') as f:
        json.dump(courses_config, f, indent=4, ensure_ascii=False)
        
    # Write JS Data
    with open('js/data/courses_data.js', 'w', encoding='utf-8') as f:
        json_str = json.dumps(courses_config, indent=4, ensure_ascii=False)
        f.write(f"const COURSES_DATA = {json_str};")
        
    print("Library Scan Complete. courses.json and js/data/courses_data.js updated.")

if __name__ == "__main__":
    scan_library()
