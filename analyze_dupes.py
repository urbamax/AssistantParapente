
import json
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

codes = [q['code'] for q in filtered]
c = Counter(codes)

dupes = [k for k, v in c.items() if v > 1]
print(f"Duplicates found: {len(dupes)}")
if dupes:
    print(dupes)

# Also check simply if there are 24 dupes?
print(f"Total entries: {len(codes)}")
print(f"Unique entries: {len(set(codes))}")
