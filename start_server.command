#!/bin/bash
# Se déplacer dans le dossier où se trouve ce script
cd "$(dirname "$0")"

# Ouvrir le navigateur
open "http://localhost:8000"

# Lancer le serveur local
python3 -m http.server 8000
