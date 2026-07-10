#!/bin/bash

# Configuration
APP_NAME="AssistantParapente"
# Détermine le dossier racine du projet (le parent du dossier scripts/)
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Le dossier de sauvegarde sera créé à côté du dossier du projet
BACKUP_DIR="${PROJECT_DIR}/../${APP_NAME}_backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${APP_NAME}_backup_${TIMESTAMP}.tar.gz"

# Créer le dossier de backup s'il n'existe pas
mkdir -p "$BACKUP_DIR"

echo "========================================"
echo "Début de la sauvegarde de $APP_NAME"
echo "========================================"
echo "Dossier source : $PROJECT_DIR"
echo "Fichier de destination : $BACKUP_FILE"
echo ""

# Exécuter la commande tar en excluant les dossiers lourds, temporaires ou non nécessaires (git, node_modules, etc.)
tar -czvf "$BACKUP_FILE" \
    --exclude=".git" \
    --exclude="node_modules" \
    --exclude=".venv" \
    --exclude=".DS_Store" \
    --exclude="*.log" \
    --exclude="*__pycache__*" \
    -C "${PROJECT_DIR}/.." "$(basename "$PROJECT_DIR")"

# Vérification du résultat
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Sauvegarde terminée avec succès !"
    echo "Emplacement : $BACKUP_FILE"
    # Affiche la taille du fichier créé
    echo "Taille :"
    du -h "$BACKUP_FILE"
else
    echo ""
    echo "❌ Erreur lors de la création de la sauvegarde."
    exit 1
fi
