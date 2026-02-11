#!/bin/bash
# Se placer dans le dossier du script (racine du projet)
cd "$(dirname "$0")"

# Exécuter le script de conversion Python
python3 js/data/convert_csv_to_js.py

# Confirmation
echo "✅ Données QCM (qcm_data.js) mises à jour à partir des CSV."
echo "🔄 Rechargez maintenant la page index.html pour voir les changements."
