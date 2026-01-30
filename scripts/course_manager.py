import argparse
import os
import json
import re

EXTRACTED_DATA_DIR = "extracted_data"
PROCESSED_COURSES_DIR = "processed_courses"
INDEX_FILE = os.path.join(PROCESSED_COURSES_DIR, "index.json")

def get_html_template(title, content, original_filename, image_path=None):
    # Determine basic ID for quiz based on filename
    course_id = "modernized/" + original_filename.replace(".txt", "").replace("affiches-pedagogiques-a3_", "")
    
    schema_html = ""
    if image_path:
        schema_html = f"""
        <div style="margin: 40px 0; text-align: center;">
            <img src="../../{image_path}" alt="Schéma explicatif" style="max-width: 100%; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); border: 1px solid #334155;">
        </div>
        """

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css" rel="stylesheet">
    <style>
        /* BASE MODERN STYLE */
        body {{
            font-family: 'Inter', sans-serif;
            line-height: 1.6;
            color: #e2e8f0;
            background: transparent !important; /* Force transparent for app integration */
            margin: 0;
            padding: 0;
        }}
        h1, h2, h3 {{ color: #38bdf8; margin-top: 1.5em; }}
        h1 {{ 
            border-bottom: 2px solid #334155; 
            padding-bottom: 10px; 
            margin-top: 0;
            font-size: 2em;
        }}
        .note {{
            background: rgba(56, 189, 248, 0.1);
            border-left: 4px solid #38bdf8;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
        }}
        ul {{ padding-left: 20px; }}
        li {{ margin-bottom: 8px; }}
        strong {{ color: #fff; }}
        
        /* SCHEMA PLACEHOLDER */
        .schema-container {{
            background: #1e293b;
            border: 1px dashed #475569;
            border-radius: 8px;
            padding: 40px;
            text-align: center;
            margin: 40px 0;
            color: #94a3b8;
        }}
    </style>
</head>
<body>

    <h1>{title}</h1>
    
    <!-- Schema Injection -->
    {schema_html}

    <div class="note">
        <i class="ri-information-line"></i> 
        Cours modernisé automatiquement depuis les supports FFVL.
    </div>

    <div class="content">
        {content}
    </div>

</body>
</html>"""

def normalize_filename(filename):
    # Remove extension
    name = os.path.splitext(filename)[0]
    # Remove common prefixes/suffixes
    name = re.sub(r'^\d+[-_]', '', name) # Remove leading numbers like "01-"
    name = re.sub(r'[-_]\d{4}$', '', name) # Remove trailing years like "-2021"
    name = name.replace("affiches-pedagogiques-a3_", "")
    name = name.replace("-", " ").replace("_", " ")
    return name.strip().title()

def modernize_course(filename):
    source_path = os.path.join(EXTRACTED_DATA_DIR, filename)
    if not os.path.exists(source_path):
        print(f"File not found: {source_path}")
        return

    # 1. Read Content
    with open(source_path, "r", encoding="utf-8", errors="ignore") as f:
        raw_text = f.read()

    # 2. Determine Title & Filename
    display_title = normalize_filename(filename)

    # 2. Assign Specific Image
    image_path = None
    if "brises" in filename:
        image_path = "img/schemas/schema_brises_vallee.png"
    elif "mecanique-du-vol" in filename or "desequilibre" in filename: # Shared physics schema
        image_path = "img/schemas/schema_forces_vol.png"
    elif "espacesaeriens" in filename:
        image_path = "img/schemas/schema_espaces_aeriens.png"
    elif "facteurs-humains" in filename:
        image_path = "img/schemas/schema_facteurs_humains.png"

    # Generate a clean output filename: e.g. "facteurs_humains.html"
    simple_name = filename.replace("affiches-pedagogiques-a3_", "").replace(".txt", "").replace("-", "_")
    # Clean up years like "2019", "2021" at end
    simple_name = re.sub(r'\d{4}$', '', simple_name)
    # Remove leading numbers
    simple_name = re.sub(r'^\d+_', '', simple_name)
    
    output_filename = simple_name.strip("_") + ".html"
    output_path = os.path.join("courses/html", output_filename)

    # 3. Improved To-HTML Conversion with Paragraph Buffering
    lines = raw_text.split('\n')
    html_content = ""
    in_list = False
    current_paragraph = []

    def flush_paragraph():
        nonlocal current_paragraph, html_content
        if current_paragraph:
            text = " ".join(current_paragraph).strip()
            if text:
                 html_content += f"<p>{text}</p>\n"
            current_paragraph = []

    for line in lines:
        line = line.strip()
        
        # Filter out artifact lines
        if "indd" in line or "Copyright" in line:
            continue

        # Empty Line -> Flush paragraph & list
        if not line:
            flush_paragraph()
            if in_list:
                html_content += "</ul>\n"
                in_list = False
            continue
            
        # Title Heuristic (One short uppercase line)
        if line.isupper() and len(line) < 100 and not line.startswith("-") and not line.startswith("•"):
            flush_paragraph()
            if in_list:
                html_content += "</ul>\n"
                in_list = False
            html_content += f"<h2>{line}</h2>\n"
            continue
            
        # Sub-Title / Header Heuristic (Short line, starts with Upper, no end punctuation)
        # e.g. "La brise de pente"
        if len(line) < 60 and line[0].isupper() and line[-1] not in ['.', ',', ':', ';', '!', '?'] and not line.startswith("-") and "www" not in line:
            flush_paragraph()
            if in_list:
                html_content += "</ul>\n"
                in_list = False
            # If it's very short, likely a strong label
            html_content += f"<h3>{line}</h3>\n"
            continue

        # List Heuristic
        if line.startswith("- ") or line.startswith("• "):
            flush_paragraph()
            if not in_list:
                html_content += "<ul>\n"
                in_list = True
            content = line[2:] 
            html_content += f"<li>{content.strip()}</li>\n"
            continue
        
        # Special Case: Title with dashes "- Les Brises -"
        if line.startswith("-") and line.endswith("-") and len(line) < 50:
             flush_paragraph()
             if in_list:
                html_content += "</ul>\n"
                in_list = False
             html_content += f"<h2>{line.replace('-', '').strip()}</h2>\n"
             continue

        # Standard Text -> Buffer it
        if in_list:
             # If we were in a list and hit text that isn't a bullet, close the list
             html_content += "</ul>\n"
             in_list = False
        
        current_paragraph.append(line)
            
    # Final cleanup
    flush_paragraph()
    if in_list:
        html_content += "</ul>\n"

    # 4. Wrap & Save
    final_html = get_html_template(display_title, html_content, filename, image_path) # Pass image_path
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(final_html)
        
    print(f"Modernized: {filename} -> {output_path}")

def main():
    parser = argparse.ArgumentParser(description="Course Manager")
    parser.add_argument("--modernize", nargs='+', help="List of files to modernize")
    args = parser.parse_args()

    # Ensure output dir exists
    if not os.path.exists("courses/html"):
        os.makedirs("courses/html")

    if args.modernize:
        print(f"Modernizing {len(args.modernize)} files...")
        for fname in args.modernize:
            modernize_course(fname)
    else:
        # Default scan behavior
        if not os.path.exists(PROCESSED_COURSES_DIR):
            os.makedirs(PROCESSED_COURSES_DIR)
        
        files = scan_files()
        print(f"Found {len(files)} files in {EXTRACTED_DATA_DIR}")
        for f in files[:5]: # Just show a few
            print(f" - {f}")

if __name__ == "__main__":
    main()
