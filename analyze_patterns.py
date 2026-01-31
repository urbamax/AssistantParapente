
import json
import re
from collections import Counter

filepath = "/Volumes/PiRoot/home/maximeurbaniak/TheorieParapente/js/data/qcm_official_data.js"

with open(filepath, 'r') as f:
    content = f.read()

start_index = content.find('{')
end_index = content.rfind('}') + 1
json_content = content[start_index:end_index]

try:
    data = json.loads(json_content)
    questions = data.get('questions', [])
except:
    questions = []

filtered = [q for q in questions if q['code'][0] not in ['H', 'R', 'X'] and 'V' in q['code']]

print(f"Total found: {len(filtered)}")

# Analyze patterns
patterns = []
for q in filtered:
    code = q['code']
    # Extract the suffix part (letters at the end)
    suffix = re.search(r'[A-Z]+$', code).group(0)
    patterns.append(suffix)

c = Counter(patterns)
print("Distribution of code patterns:")
for k, v in c.items():
    print(f"{k}: {v}")

# Maybe the user excludes M or B?
# "toutes les V"
# If a code is "VBM", it contains V.
# If the user says 174, and we have 198.
# 198 - 174 = 24.

# Let's specifically look if there is a group of exactly 24 questions.
# Or if we exclude specific patterns.
