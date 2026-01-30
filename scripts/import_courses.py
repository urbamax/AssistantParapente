import os
import shutil
import re
import json
import unicodedata

SOURCE_ROOT = "FFVL/Documents officiels"
DEST_ROOT = "img/course"

def slugify(value):
    value = str(value)
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode('ascii')
    value = re.sub(r'[^\w\s-]', '', value).strip().lower()
    return re.sub(r'[-\s]+', '-', value)

def create_config_entry(course_name, category, dest_rel_path, page_count, pdf_rel_path):
    # Determine Level (Heuristics)
    level = ["GENERAL"] # Default
    clean_cat = category.replace('_', ' ').replace('-', ' ').upper()
    text_for_search = (course_name + " " + clean_cat).upper()
    
    if "BREVET INITIAL" in text_for_search or "INITIAL" in text_for_search or "VERT" in text_for_search or "INITIATION" in text_for_search:
            level = ["BI"]
    elif "BREVET PILOTE" in text_for_search or "PILOTE" in text_for_search or "BLEU" in text_for_search or "BP" in text_for_search:
            level = ["BP"]
    
    if "CONFIRME" in text_for_search or "BPC" in text_for_search or "MARRON" in text_for_search or "CROSS" in text_for_search:
            level = ["BPC"]
            
    if "FACTEURS HUMAINS" in text_for_search and "BLEU" not in text_for_search: 
            if clean_cat == "FACTEURS HUMAINS":
                if "BLEU" in text_for_search: level = ["BP"]
                elif "CONFIRME" in text_for_search: level = ["BPC"]
                else: level = ["BI"]

    display_title = course_name.replace('-', ' ').replace('_', ' ').replace('.','').strip()
    display_category = category.replace('-', ' ').replace('_', ' ').strip()
    
    return {
        "title": display_title,
        "category": display_category,
        "path": f"img/course/{dest_rel_path}",
        "pages": page_count,
        "pdf": pdf_rel_path,
        "level": level
    }

def process_courses():
    courses_config = {}
    
    if os.path.exists(DEST_ROOT):
        print(f"Cleaning {DEST_ROOT}...")
        shutil.rmtree(DEST_ROOT)
    os.makedirs(DEST_ROOT, exist_ok=True)
    
    # Walk through source
    for root, dirs, files in os.walk(SOURCE_ROOT):
        # Identify if this folder is a "Course" (contains images OR PDFs)
        images = [f for f in files if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
        pdfs = [f for f in files if f.lower().endswith('.pdf')]
        
        if not images and not pdfs:
            continue
            
        # Get relative path from Source Root to preserve hierarchy
        rel_path = os.path.relpath(root, SOURCE_ROOT)
        
        # Path components
        parts = rel_path.split(os.sep)
        
        if rel_path == '.':
            category = "General"
            course_name = "Misc"
            slug_parts = ["misc"]
        else:
            course_name = parts[-1]
            category = parts[0] if len(parts) > 0 else "Autre"
            slug_parts = [slugify(p) for p in parts]
            
        # CASE 1: Image-based Course (Folder = Course)
        if images:
            # Sort images
            def sort_key(f):
                nums = re.findall(r'\d+', f)
                if nums:
                    return int(nums[-1])
                return f
            images.sort(key=sort_key)
            
            # Destination Path
            dest_rel_path = os.path.join(*slug_parts)
            dest_full_path = os.path.join(DEST_ROOT, dest_rel_path)
            os.makedirs(dest_full_path, exist_ok=True)
            
            print(f"Processing Bundle: {rel_path} -> {dest_rel_path}")

            # Copy Images
            page_count = 0
            for i, img_file in enumerate(images):
                new_name = f"page_{str(i+1).zfill(2)}.png" 
                src_file = os.path.join(root, img_file)
                dst_file = os.path.join(dest_full_path, new_name)
                if not os.path.exists(dst_file):
                    shutil.copy2(src_file, dst_file)
                page_count += 1
                
            # Copy PDF
            pdf_rel_path = None
            if pdfs:
                src_pdf = os.path.join(root, pdfs[0]) # Take first
                dest_pdf_name = f"{slugify(course_name)}.pdf"
                dest_pdf_path = os.path.join(dest_full_path, dest_pdf_name)
                shutil.copy2(src_pdf, dest_pdf_path)
                pdf_rel_path = f"img/course/{dest_rel_path}/{dest_pdf_name}"

            # Config
            config_key = "/".join(slug_parts)
            courses_config[config_key] = create_config_entry(course_name, category, dest_rel_path, page_count, pdf_rel_path)

        # CASE 2: PDF-only Course (Each PDF = Course)
        elif pdfs:
            # The current folder is the CATEGORY (or part of it)
            if rel_path == '.':
                 current_category = "General"
                 cat_slug_parts = []
            else:
                 current_category = course_name # The folder name IS the category now
                 cat_slug_parts = slug_parts # The path to this folder
            
            for pdf_file in pdfs:
                raw_name = os.path.splitext(pdf_file)[0]
                c_name = raw_name
                c_slug = slugify(c_name)
                
                if cat_slug_parts:
                    item_slug_parts = cat_slug_parts + [c_slug]
                else:
                    item_slug_parts = [c_slug]
                    
                dest_rel_path = os.path.join(*item_slug_parts)
                dest_full_path = os.path.join(DEST_ROOT, dest_rel_path)
                os.makedirs(dest_full_path, exist_ok=True)
                
                print(f"Processing PDF Course: {raw_name} -> {dest_rel_path}")
                
                # Copy PDF
                src_pdf = os.path.join(root, pdf_file)
                dest_pdf_name = f"{c_slug}.pdf"
                dest_pdf_path = os.path.join(dest_full_path, dest_pdf_name)
                shutil.copy2(src_pdf, dest_pdf_path)
                pdf_rel_path = f"img/course/{dest_rel_path}/{dest_pdf_name}"
                
                # Config
                config_key = "/".join(item_slug_parts)
                courses_config[config_key] = create_config_entry(c_name, current_category, dest_rel_path, 0, pdf_rel_path)

    # Output JSON to file
    with open('courses.json', 'w', encoding='utf-8') as f:
        json.dump(courses_config, f, indent=4, ensure_ascii=False)
    print("Config written to courses.json")

if __name__ == "__main__":
    process_courses()
