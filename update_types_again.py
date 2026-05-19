import re

with open('/Volumes/maximeurbaniak/TheorieParapente/js/data/sites_data.js', 'r') as f:
    content = f.read()

# Pattern to find each object
objects = re.findall(r'(\{\s+id:.*?\s+observations: ".*?"\n\s+\})', content, re.DOTALL)

for obj in objects:
    # Determine type
    nom = re.search(r'nom: "(.*?)"', obj).group(1).lower()
    obs = re.search(r'observations: "(.*?)"', obj).group(1).lower()
    
    combined = nom + " " + obs
    
    type_str = "NATUREL"
    if 'dune' in combined:
        type_str = "DUNE"
    elif 'treuil' in combined:
        type_str = "TREUIL"
        
    # Inject type field before observations if it doesn't already exist
    if 'type: "' not in obj:
        new_obj = re.sub(r'(\s+)(observations: ".*?")', r'\1type: "' + type_str + '",\1\2', obj)
        content = content.replace(obj, new_obj)

# Make sure the comment at the top is updated if not already
if "type," not in content:
    content = content.replace("Modèle : id, nom, latitude, longitude, orientations_vent, observations", "Modèle : id, nom, latitude, longitude, orientations_vent, type, observations")

with open('/Volumes/maximeurbaniak/TheorieParapente/js/data/sites_data.js', 'w') as f:
    f.write(content)
