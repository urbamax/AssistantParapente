import re

with open('/Volumes/maximeurbaniak/TheorieParapente/js/data/sites_data.js', 'r') as f:
    content = f.read()

# Fix keys that have trailing quote like latitude":
content = re.sub(r'(\s+)latitude":', r'\1latitude:', content)
content = re.sub(r'(\s+)longitude":', r'\1longitude:', content)
content = re.sub(r'(\s+)"nom":', r'\1nom:', content)
content = re.sub(r'(\s+)"latitude":', r'\1latitude:', content)
content = re.sub(r'(\s+)"longitude":', r'\1longitude:', content)

with open('/Volumes/maximeurbaniak/TheorieParapente/js/data/sites_data.js', 'w') as f:
    f.write(content)
