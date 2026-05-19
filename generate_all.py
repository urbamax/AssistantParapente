import re
import json

data = """
1	ONO, La Comté (Site Naturel)	50°24'57.3"N	2°30'41.1"E
2	SSO, Olhain (Site Naturel)	50°26'02.1"N	2°35'08.7"E
3	Zuycoote, Dunes (SIte Naturel)	51°04'17.1"N	2°29'10.5"E
4	Parking Equihen, déco herbe (Site Naturel)	50°40'50.3"N	1°33'59.5"E
5	Parking Equihen, déco dunes (Site Naturel)	50°40'06.5"N	1°34'12.4"E
6	SO & NO : parking blanc de Antin, Valhuon (Piste de Treuil)	50°26'12.0"N	2°24'11.0"E
7	NE ; Ferme d’Antin (Piste de Treuil)	50°25'35.7"N	2°23'49.9"E
8	OSO, Equihen, déco dunes (Site Naturel)	50°39'49.3"N	1°34'18.8"E
9	OSO, Equihen, déco herbe (Site Naturel)	50°40'46.6"N	1°34'01.8"E
10	SO, Monchy Marquay (Piste de Treuil)	50°23'43.0"N	2°25'20.8"E
11	ENE, Rebreuve Ranchicourt (Piste de Treuil)	50°25'39.2"N	2°30'51.0"E
12	NE, Antin Bours (Piste de Treuil)	50°26'29.5"N	2°23'03.4"E
13	SSE, Bailleul aux Cornailles (Piste de Treuil)	50°23'12.9"N	2°26'09.5"E
14	E, Valhuon Parking Blanc (Piste de Treuil)	50°26'14.6"N	2°23'10.9"E
15	Déco parapente la Comté	50.4167894	2.5134675
"""

def dms_to_dd(degrees, minutes, seconds, direction):
    dd = float(degrees) + float(minutes)/60 + float(seconds)/(60*60)
    if direction == 'S' or direction == 'W':
        dd *= -1
    return round(dd, 6)

def parse_dms(dms_str):
    if not dms_str.endswith("N") and not dms_str.endswith("E"):
        return float(dms_str)
    
    match = re.match(r"(\d+)°(\d+)'([\d.]+)\"([NSEW])", dms_str)
    if match:
        d, m, s, dir = match.groups()
        return dms_to_dd(d, m, s, dir)
    return 0.0

def generate_id(name):
    s = name.lower()
    s = re.sub(r'[^a-z0-9\s-]', '', s)
    s = re.sub(r'\s+', '-', s)
    return s.strip('-')

sites = []
for line in data.strip().split('\n'):
    parts = line.split('\t')
    if len(parts) == 4:
        idx, raw_name, lat_str, lng_str = parts
        
        # Extract winds
        winds = []
        clean_name = raw_name
        
        match = re.match(r'^([A-Z]{1,3}(?:\s*&\s*[A-Z]{1,3})?)\s*[,;:]?\s*(.*)', raw_name)
        if match and match.group(1) not in ['Zuycoote', 'Parking', 'Déco']:
            w_str = match.group(1)
            winds = [w.strip() for w in w_str.split('&')]
            clean_name = match.group(2)
            
        # Special cases manually:
        if 'Zuycoote' in raw_name:
            winds = ['N', 'NO'] # From old data
        elif 'Parking Equihen' in raw_name:
            winds = [] # It's a parking, maybe no wind, or inherit? Let's leave empty.
        elif 'Déco parapente' in raw_name:
            winds = ['ONO'] # Based on item 1
            
        lat = parse_dms(lat_str)
        lng = parse_dms(lng_str)
        
        obs = "Site Naturel" if "Naturel" in clean_name else ("Piste de Treuil" if "Treuil" in clean_name else "Site")
        clean_name = clean_name.replace("(Site Naturel)", "").replace("(SIte Naturel)", "").replace("(Piste de Treuil)", "").strip(" ,;")
        
        # Format the id to avoid duplicates
        base_id = generate_id(clean_name)
        final_id = f"{base_id}-{idx}" # unique
        
        site = {
            "id": final_id,
            "nom": clean_name,
            "latitude": lat,
            "longitude": lng,
            "orientations_vent": winds,
            "observations": obs
        }
        sites.append(site)

out = "const SITES_DATA = [\n"
for i, s in enumerate(sites):
    out += "    {\n"
    out += f'        id: "{s["id"]}",\n'
    out += f'        nom: "{s["nom"]}",\n'
    out += f'        latitude: {s["latitude"]},\n'
    out += f'        longitude: {s["longitude"]},\n'
    
    winds_str = ', '.join([f'"{w}"' for w in s["orientations_vent"]])
    out += f'        orientations_vent: [{winds_str}],\n'
    
    out += f'        observations: "{s["observations"]}"\n'
    out += "    }" + ("," if i < len(sites)-1 else "") + "\n"
out += "];\n"

with open('/Volumes/maximeurbaniak/TheorieParapente/js/data/sites_data.js', 'w') as f:
    f.write(out)
