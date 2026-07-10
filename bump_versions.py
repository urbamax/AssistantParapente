import re
import os

files_to_update = [
    "/Volumes/maximeurbaniak/AssistantParapente/index.html",
    "/Volumes/maximeurbaniak/AssistantParapente/js/engine_v4_6.js",
    "/Volumes/maximeurbaniak/AssistantParapente/components/header.html"
]

# Match any query version format like ?v=2026.XX.XX_vX
version_regex = re.compile(r'\?v=2026\.[0-9]{2}\.[0-9]{2}_v[0-9]+')
new_version = "?v=2026.07.10_v8"

for file_path in files_to_update:
    if not os.path.exists(file_path):
        continue
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Update version strings
    content = version_regex.sub(new_version, content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
print("Versions updated to 2026.07.10_v8.")
