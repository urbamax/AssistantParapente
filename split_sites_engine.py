import re
import os

filepath = '/Volumes/maximeurbaniak/TheorieParapente/js/sites_engine.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# We'll use a simple brace-matching parser
lines = content.split('\n')

base_props = ['state', 'init', 'show']
filter_props = ['setupDropdowns', 'renderDropdowns', 'cycleFilterState', 'toggleDropdown', 'toggleFilter', 'updateBadges', 'filterByTag', 'changeSortMode', 'changeStrategy', 'calculateDistance', 'updateWindLimits', 'toggleHideUnflyable', 'updateForecastLabel', 'setForecastOffset', 'setRadiusLimit', 'isFieldFilled']
weather_props = ['fetchWeatherForSites', 'changeWeatherModel', 'isForecastFlyable', 'degreesToCardinal']
ui_props = ['renderList', 'buildSiteCardHtml', 'copyCoords', 'jumpToSiteCard']
map_props = ['initMap', 'updateMapTiles', 'updateMapMarkers', 'buildWeatherPopupHtml', 'buildMapPopupHtml', 'openGpsMenu', 'closeGpsMenu', 'launchGps', 'switchMapMode', 'getLatestIsofrontsUrl', 'toggleIsofrontsSource', 'focusSiteWindy', 'toggleFullscreen']

# Find the start of the object
start_idx = -1
for i, line in enumerate(lines):
    if line.startswith('const SitesEngine = {'):
        start_idx = i
        break

if start_idx == -1:
    print("Could not find start of SitesEngine")
    exit(1)

# Now iterate and extract properties
current_prop = None
current_content = []
brace_count = 0
in_prop = False

properties = {}

for i in range(start_idx + 1, len(lines)):
    line = lines[i]
    if not in_prop:
        # Looking for property start
        m = re.match(r'^    ([a-zA-Z0-9_]+):\s*(async\s*function|function|\{)', line)
        if m:
            current_prop = m.group(1)
            in_prop = True
            current_content = [line]
            brace_count = line.count('{') - line.count('}')
        elif line.strip() == '}':
            break # end of SitesEngine
    else:
        current_content.append(line)
        brace_count += line.count('{') - line.count('}')
        if brace_count == 0:
            # End of property
            in_prop = False
            properties[current_prop] = '\n'.join(current_content).rstrip(',')

print(f"Extracted {len(properties)} properties")

def generate_file(filename, props_list):
    out = []
    for p in props_list:
        if p in properties:
            # replace "propName: function" with "SitesEngine.propName = function"
            content = properties[p]
            # Replace the first occurrence of "propName: " with "SitesEngine.propName = "
            content = re.sub(r'^    ' + p + r':\s*', f'SitesEngine.{p} = ', content)
            out.append(content + ';')
    
    with open(f'/Volumes/maximeurbaniak/TheorieParapente/js/{filename}', 'w', encoding='utf-8') as f:
        f.write('\n\n'.join(out))

generate_file('sites_filter.js', filter_props)
generate_file('sites_weather.js', weather_props)
generate_file('sites_ui.js', ui_props)
generate_file('sites_map.js', map_props)

# Generate base file
out = ['const SitesEngine = {']
if 'state' in properties:
    out.append('    state: ' + properties['state'][11:]) # '    state: {' -> '{'
else:
    print("WARNING: state not found")

out.append('};')
out.append('')

for p in base_props:
    if p != 'state' and p in properties:
        content = properties[p]
        content = re.sub(r'^    ' + p + r':\s*', f'SitesEngine.{p} = ', content)
        out.append(content + ';')
        out.append('')

with open('/Volumes/maximeurbaniak/TheorieParapente/js/sites_engine.js', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))

print("Split completed successfully!")

