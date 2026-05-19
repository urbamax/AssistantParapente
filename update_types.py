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
        
    # Inject type field after orientations_vent
    new_obj = re.sub(r'(orientations_vent: \[.*?\],)', r'\1\n        type: "' + type_str + '",', obj)
    
    # Replace in content
    content = content.replace(obj, new_obj)

# Update the comment at the top
content = content.replace("Modèle : id, nom, latitude, longitude, orientations_vent, observations", "Modèle : id, nom, latitude, longitude, orientations_vent, type, observations")

with open('/Volumes/maximeurbaniak/TheorieParapente/js/data/sites_data.js', 'w') as f:
    f.write(content)
