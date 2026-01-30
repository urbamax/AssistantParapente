import csv
import json
import os
import glob

# Configuration
SOURCE_DIR = "/Users/USER/Desktop/APP THEORIE PARAPENTE/FFVL/Web_QCM2020_complet_FR_GB/Web_QCM2020_complet_FR_GB"
OUTPUT_FILE = "/Users/USER/Desktop/APP THEORIE PARAPENTE/FFVL/qcmffvl-master/data_full.js"

# Theme Mapping based on filename
FILES_TO_PROCESS = {
    "Météo-Tableau 1.csv": "Météo",
    "MécaVol-Tableau 1.csv": "MécaVol",
    "Règlementation-Tableau 1.csv": "Règlementation",
    "Pilotage-Tableau 1.csv": "Pilotage"
}

# Level Mapping from ID suffix
# V = Vert (Initial), B = Bleu (Pilote), M = Marron (Confirmé)
LEVEL_MAP = {
    'V': 0, # Vert / BI
    'B': 1, # Bleu / BP
    'M': 2  # Marron / BPC
}

def parse_csv(filepath, theme):
    questions = []
    print(f"Processing {filepath}...")
    
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.reader(f, delimiter=';')
        
        for row in reader:
            if not row or len(row) < 3:
                continue
                
            code = row[0].strip()
            
            # Skip header or empty lines
            if not code or code.startswith("Tableau") or code.startswith("©"):
                continue

            # Check for level suffix
            level_char = code[-1]
            if level_char not in LEVEL_MAP:
                print(f"Skipping row with unknown level code: {code}")
                continue
                
            level = LEVEL_MAP[level_char]
            q_text = row[1].strip()
            
            # Parse answers
            answers = []
            # Answers start at index 2, pairs of (Text, Points)
            # Row length varies, iterate until empty
            for i in range(2, len(row) - 1, 2):
                ans_text = row[i].strip()
                ans_pts_str = row[i+1].strip()
                
                if not ans_text or not ans_pts_str:
                    continue
                    
                try:
                    pts = int(ans_pts_str)
                except ValueError:
                    continue
                    
                answers.append({
                    "text": ans_text,
                    "pts": pts
                })
            
            if not answers:
                continue

            questions.append({
                "id": code,
                "niveau": level,
                "theme": theme,
                "question": q_text,
                "ans": answers
            })
            
    return questions

def main():
    all_questions = []
    
    # Check if directory exists
    if not os.path.exists(SOURCE_DIR):
        print(f"Error: Directory not found: {SOURCE_DIR}")
        return

    # Process each file
    for filename, theme in FILES_TO_PROCESS.items():
        # Handle potential unicode normalization issues in filenames (macOS NFD vs NFC)
        # We will try exact match first, then glob match if needed
        full_path = os.path.join(SOURCE_DIR, filename)
        
        if not os.path.exists(full_path):
            # Try finding it with glob to handle unicode differences
            # Normalize pattern: first few chars + * + last few chars
            # e.g., "Me" + "*" + "Vol-Tableau 1.csv"
            # Actually, simpler to iterate dir and match
            found = False
            for f in os.listdir(SOURCE_DIR):
                if filename.replace('́','').replace('̀','') in f.replace('́','').replace('̀',''):
                     full_path = os.path.join(SOURCE_DIR, f)
                     found = True
                     break
            if not found:
                 print(f"Warning: File not found: {filename}")
                 continue

        q_list = parse_csv(full_path, theme)
        print(f"Found {len(q_list)} questions in {theme}")
        all_questions.extend(q_list)

    print(f"Total questions processed: {len(all_questions)}")
    
    # Write to JS file
    js_content = f"const FFVL_DATA = {{ \"questions\": {json.dumps(all_questions, ensure_ascii=False, indent=2)} }};"
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(js_content)
        
    print(f"Successfully wrote data to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
