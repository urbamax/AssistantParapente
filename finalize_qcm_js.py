
import json

json_path = "/Volumes/PiRoot/home/maximeurbaniak/TheorieParapente/js/data/qcm_official_data_generated.json"
js_path = "/Volumes/PiRoot/home/maximeurbaniak/TheorieParapente/js/data/qcm_official_data.js"

with open(json_path, 'r') as f:
    data = f.read()

# Wrap
js_content = f"const QCM_OFFICIAL = {data};"

with open(js_path, 'w') as f:
    f.write(js_content)

print("Successfully updated qcm_official_data.js")
