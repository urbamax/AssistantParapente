import re
import os

files_to_update = [
    "index.html",
    "components/header.html",
    "js/core/main.js" # sometimes module has imports
]
version_regex = re.compile(r'\?v=[0-9\._a-zA-Z]+')
new_version = "?v=2026.10.01_v20"

for file_path in files_to_update:
    if not os.path.exists(file_path):
        continue
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    content = version_regex.sub(new_version, content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

# Service worker cache name: bumping it forces installed clients to fetch the new
# build instead of serving stale cached JS/CSS indefinitely (see sw.js CACHE_NAME).
sw_path = "sw.js"
if os.path.exists(sw_path):
    with open(sw_path, 'r', encoding='utf-8') as f:
        sw_content = f.read()

    cache_name_regex = re.compile(r"const CACHE_NAME = 'parapente-app-v[0-9\._a-zA-Z]+';")
    new_cache_name = f"const CACHE_NAME = 'parapente-app-v{new_version.replace('?v=', '')}';"
    sw_content = cache_name_regex.sub(new_cache_name, sw_content)

    with open(sw_path, 'w', encoding='utf-8') as f:
        f.write(sw_content)

print(f"Versions updated to {new_version}.")
