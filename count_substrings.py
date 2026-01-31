
filepath = "/Volumes/PiRoot/home/maximeurbaniak/TheorieParapente/js/data/qcm_official_data.js"

with open(filepath, 'r') as f:
    content = f.read()

count = content.count('"code": "F7VBM"')
print(f"Occurrences of 'code': 'F7VBM': {count}")

# Also check simply F7VBM just in case
count_simple = content.count('F7VBM')
print(f"Occurrences of 'F7VBM': {count_simple}")
