
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

prefixes = [q['code'][0] for q in filtered]
c = Counter(prefixes)
print("Distribution by Prefix:")
for k, v in sorted(c.items()):
    print(f"{k}: {v}")
