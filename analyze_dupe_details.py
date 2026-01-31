
import json
from collections import defaultdict

filepath = "/Volumes/PiRoot/home/maximeurbaniak/TheorieParapente/js/data/qcm_official_data.js"

with open(filepath, 'r') as f:
    content = f.read()

start_index = content.find('{')
end_index = content.rfind('}') + 1
json_content = content[start_index:end_index]

data = json.loads(json_content)
questions = data.get('questions', [])

filtered = [q for q in questions if q['code'][0] not in ['H', 'R', 'X'] and 'V' in q['code']]

mapping = defaultdict(list)
for q in filtered:
    mapping[q['code']].append(q)

for code, entries in mapping.items():
    if len(entries) > 1:
        print(f"Code {code}: {len(entries)} entries")
        for e in entries:
            print(f" - Level: {e.get('niveau')}")
