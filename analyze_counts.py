
import json
import re

# Load the file
filepath = "/Volumes/PiRoot/home/maximeurbaniak/TheorieParapente/js/data/qcm_official_data.js"

with open(filepath, 'r') as f:
    content = f.read()

# Extract JSON part strictly
start_index = content.find('{')
end_index = content.rfind('}') + 1
json_content = content[start_index:end_index]

try:
    data = json.loads(json_content)
    questions = data.get('questions', [])
except Exception as e:
    print(f"Error parsing JSON: {e}")
    # Fallback: try to just eval it strictly or clean it up?
    # It might contain JS comments or trailing commas which JSON doesn't like.
    # Let's hope it's standard JSON structure inside.
    questions = []

print(f"Total questions available: {len(questions)}")

if not questions:
    exit()

# Logic
level = 'BI'
excludedPrefixes = ['H', 'R', 'X']

filtered_step1 = [q for q in questions if q['code'][0] not in excludedPrefixes]
print(f"Count non-excluded (total expected pool?): {len(filtered_step1)}")

filtered_step2 = [q for q in filtered_step1 if 'V' in q['code']]
print(f"Count 'V' (Current Logic): {len(filtered_step2)}")

# Check against 'parapente' flag
filtered_parapente = [q for q in filtered_step2 if q.get('parapente') == True]
print(f"Count 'V' + 'parapente=true': {len(filtered_parapente)}")

# The user wants 174.
# If filtered_step2 is 198, then the current logic finds 198.
# If filtered_parapente is 174, then the fix is to simply use the 'parapente' flag.

if len(filtered_step2) > 174:
    print("Potential extra questions (in 'V' but maybe should be excluded):")
    # Identify the 24 questions difference if step2 is 198 and step3 is 174
    # Or just list questions that have V but not parapente=true
    
    extras = [q['code'] for q in filtered_step2 if q.get('parapente') != True]
    print(f"Questions with V but parapente=false: {len(extras)}")
    print(extras)

    # What if the difference is something else?
    # Maybe some 'V' questions are not marked 'parapente' but are valid?
    # Or maybe the delta is exactly the delta specific questions?
