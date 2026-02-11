import csv
import json
import os

# Define file paths
base_dir = '/Volumes/PiRoot/home/maximeurbaniak/TheorieParapente/js/data'
qcm_csv_path = os.path.join(base_dir, 'qcm_ffvl.csv')
explanations_csv_path = os.path.join(base_dir, 'qcm_ffvl_explanations.csv')
output_js_path = os.path.join(base_dir, 'qcm_data.js')

# Data storage
questions_map = {}

# 1. Parse Explanations first (to have a mapping of ID -> Explanation)
print(f"Reading explanations from {explanations_csv_path}...")
explanations_map = {}
try:
    with open(explanations_csv_path, 'r', encoding='utf-8') as f:
        # Check delimiter
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            if not row: continue
            q_id = row.get('id')
            expl = row.get('explication')
            if q_id and expl:
                explanations_map[q_id.strip()] = expl.strip()
    print(f"Loaded {len(explanations_map)} explanations.")
except Exception as e:
    print(f"Error reading explanations: {e}")

# 2. Parse Questions
print(f"Reading questions from {qcm_csv_path}...")
questions_list = []

try:
    with open(qcm_csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f, delimiter=',')
        for row in reader:
            if not row or len(row) < 3:
                continue
            
            # Format: ID, Question, Ans1, Pts1, Ans2, Pts2 ...
            q_id = row[0].strip()
            q_text = row[1].strip()
            
            answers = []
            # Answers start at index 2, pairs of (Text, Points)
            # Maximum valid length check to avoid index errors
            i = 2
            while i + 1 < len(row):
                ans_text = row[i].strip()
                ans_pts_str = row[i+1].strip()
                
                # Stop if answer text is empty (end of valid answers)
                if not ans_text:
                    i += 2
                    continue
                    
                try:
                    ans_pts = int(ans_pts_str)
                except ValueError:
                    # Handle case where points might be empty or malformed
                    ans_pts = 0
                
                answers.append({
                    "text": ans_text,
                    "pts": ans_pts
                })
                i += 2
            
            # Lookup explanation
            explanation = explanations_map.get(q_id, "")
            
            # Matches QuizEngine expected format
            question_obj = {
                "code": q_id,
                "question": q_text,
                "ans": answers,
                "explication": explanation
            }
            questions_list.append(question_obj)

except Exception as e:
    print(f"Error reading questions: {e}")

# 3. Write to JS file
print(f"Writing {len(questions_list)} questions to {output_js_path}...")

js_content = f"""// Données QCM générées automatiquement
// Permet le chargement local sans serveur (contourne CORS)
window.QCM_OFFICIAL = {{
    "questions": {json.dumps(questions_list, ensure_ascii=False, indent=4)}
}};
console.log("✅ Données QCM chargées depuis qcm_data.js (" + window.QCM_OFFICIAL.questions.length + " questions)");
"""

with open(output_js_path, 'w', encoding='utf-8') as f:
    f.write(js_content)

print("Done.")
