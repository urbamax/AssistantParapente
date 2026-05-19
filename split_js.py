import re
import os

with open('/Volumes/maximeurbaniak/TheorieParapente/js/sites_engine.js', 'r', encoding='utf-8') as f:
    content = f.read()

# We won't parse it with regex, it's easier to manually write the modularized code.
