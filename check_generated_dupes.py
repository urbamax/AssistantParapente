
filepath = "/Volumes/PiRoot/home/maximeurbaniak/TheorieParapente/js/data/qcm_official_data_generated.json"

with open(filepath, 'r') as f:
    content = f.read()

count = content.count('"code": "F7VBM"')
print(f"Occurrences of 'code': 'F7VBM': {count}")
