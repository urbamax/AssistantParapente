import os
import json
import re

ROOT_DIR = '/Users/USER/Desktop/APP THEORIE PARAPENTE'
IMG_COURSE_DIR = os.path.join(ROOT_DIR, 'img', 'course')
COURSES_JSON_PATH = os.path.join(ROOT_DIR, 'courses.json')
ENGINE_JS_PATH = os.path.join(ROOT_DIR, 'js', 'engine.js')

def get_readable_title(folder_name):
    # Convert snake_case or slug to Title Case
    # Handle specific capitalized words
    name = folder_name.replace('_', ' ').replace('-', ' ')
    words = name.split()
    capitalized_words = []
    
    uppercase_terms = {'fh', 'bi', 'bp', 'bpc', 'pp', 'vl', 'ffvl', 'isrm'}
    
    for w in words:
        if w.lower() in uppercase_terms:
            capitalized_words.append(w.upper())
        elif w.isdigit():
             capitalized_words.append(w)
        else:
            capitalized_words.append(w.capitalize())
            
    return ' '.join(capitalized_words)

def main():
    print("Syncing Courses from Directory Structure...")
    
    courses_config = {}
    
    # Walk img/course
    # We support depth 1 (course) or depth 2 (category/course)
    
    # Get top level items
    try:
        items = sorted([item for item in os.listdir(IMG_COURSE_DIR) if not item.startswith('.')])
    except FileNotFoundError:
        print(f"Directory not found: {IMG_COURSE_DIR}")
        return

    for item in items:
        item_path = os.path.join(IMG_COURSE_DIR, item)
        if not os.path.isdir(item_path): continue
        
        # Check if this is a leaf course (contains images)
        images = [f for f in os.listdir(item_path) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
        
        if images:
            # It's a Top Level Course
            pages_count = len(images)
            title = get_readable_title(item)
            category = "Autre" # Or "General"? or define a mapping?
            
            # Key is the folder name
            key = item
            courses_config[key] = {
                "title": title,
                "category": category,
                "path": f"img/course/{item}",
                "pages": pages_count
            }
            print(f"Found Course: {item} ({pages_count} pages)")
        else:
            # It might be a Category Folder
            subitems = sorted([sub for sub in os.listdir(item_path) if not sub.startswith('.')])
            category_title = get_readable_title(item)
            
            for sub in subitems:
                sub_path = os.path.join(item_path, sub)
                if os.path.isdir(sub_path):
                     sub_images = [f for f in os.listdir(sub_path) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
                     if sub_images:
                         pages_count = len(sub_images)
                         title = get_readable_title(sub)
                         key = f"{item}/{sub}"
                         courses_config[key] = {
                             "title": title,
                             "category": category_title,
                             "path": f"img/course/{key}",
                             "pages": pages_count
                         }
                         print(f"Found Course: {key} ({pages_count} pages)")

    # Write courses.json
    with open(COURSES_JSON_PATH, 'w') as f:
        json.dump(courses_config, f, indent=4)
        print("Updated courses.json")
        
    # Update engine.js
    with open(ENGINE_JS_PATH, 'r') as f:
        js_content = f.read()
        
    # Format JSON block for JS (indent keys by 8 spaces, so block indented by 4)
    json_str = json.dumps(courses_config, indent=4)
    indented_json_lines = []
    for line in json_str.split('\n'):
        indented_json_lines.append('    ' + line)
    formatted_courses_block = '\n'.join(indented_json_lines)
    
    # Construct replacement block with markers
    new_block = "\n    COURSES: " + formatted_courses_block + ","
    
    # Regex replacement using MARKERS
    # Matches everything between /* COURSES_START */ and /* COURSES_END */
    # (including newlines)
    # The markers themselves are preserved in the replacement implicitly if we match strictly between them?
    # No, usually easiest to match headers and replace inner.
    
    pattern = r'(\/\* COURSES_START \*\/)([\s\S]*?)(\/\* COURSES_END \*\/)'
    
    if re.search(pattern, js_content):
        new_content = re.sub(pattern, r'\1' + new_block + '\n    ' + r'\3', js_content)
        with open(ENGINE_JS_PATH, 'w') as f:
            f.write(new_content)
        print("Updated engine.js using Markers")
    else:
        print("Could not find COURSES markers in engine.js. Please run regenerate_engine.py first.")

if __name__ == "__main__":
    main()
