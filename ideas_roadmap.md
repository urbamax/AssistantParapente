# 🚀 Pistes d'Évolution & R&D - Assistant Parapente

Ce fichier centralise les concepts techniques et les idées d'amélioration validés pour le futur, afin de ne pas perturber le code stable actuel.

---

## 🎨 1. Iconographie Officielle FFVL & SpotAir
*Objectif : Remplacer les marqueurs génériques de la carte des sites par les icônes vectorielles dynamiques de la fédération.*

### Spécifications de l'API SpotAir
Les icônes SVG sont générées à la volée via des paramètres d'URL :
- **Base URL Spots :** `https://www.spotair.mobi/icones/spots/spot.svg`
- **Base URL POI :** `https://www.spotair.mobi/icones/pois/poi.svg`

### Paramètres clés :
- `p` (Pratique) : `1` = Parapente, `2` = Delta, `3` = Speed-Riding.
- `t` (Type) : `1` = Déco, `2` = Atterro, `3` = Biplace (Déco+Atterro), `4` = Pente école, `8` = Treuil.
- `n` (Niveau IPPI) : `3` = Vert (BI), `4` = Bleu (BP), `5` = Marron (BPC).
- `h` (PMR) : `1` = Accessible.

### Logique des Vents (Masque Binaire sur 8 bits) :
Pour afficher les secteurs de vent favorables (`o`) ou défavorables (`od`), il faut additionner les puissances de 2 des directions :
- **N** : 1 | **NE** : 2 | **E** : 4 | **SE** : 8 | **S** : 16 | **SO** : 32 | **O** : 64 | **NO** : 128
*Exemple : Pour un déco exploitable par vent de Nord (1) et Nord-Ouest (128), l'URL contiendra `?o=129`.*

---

## ⛰️ 2. R&D Cartographie 3D (Traces Suspendues)
*Objectif : Obtenir une trace fine qui vole en altitude réelle sans l'effet "mur vertical" du fill-extrusion classique sous MapLibre GL JS.*

### Piste technique : Le Ruban Horizontal (MultiPolygon)
Puisque MapLibre drape obligatoirement les couches `type: 'line'` sur le relief (DEM), la parade consiste à transformer mathématiquement la ligne de points GPS en une suite de dalles horizontales (polygones) très fines (5m de large) calculées en l'air.

### Structure du style :
```javascript
paint: {
    'fill-extrusion-color': '#ff6600',
    'fill-extrusion-opacity': 0.85,
    // On crée une épaisseur de seulement 2 mètres juste sous le vol
    'fill-extrusion-base': ['-', ['get', 'altitude'], 2], 
    'fill-extrusion-height': ['get', 'altitude']
}

Note : Veiller à lier le badge du pilote (Altitude/Vario) à une couche symbol WebGL pour qu'il reste accroché au ruban sans s'enterrer sous le relief.

💻 3. Optimisations UX Futures

Formulaires Intelligents (Vol 🔄 Gonflage)
•	Mémoire de bascule : Lors du switch entre les onglets "Vol" et "Gonflage" dans la section "Ajouter", implémenter un pont de données temporaire pour ne pas vider les champs communs déjà saisis (Date & Heure, Lieu, Voile, Sellette).
Module Théorie (Brevet Initial)
•	Reset d'Examen : Forcer la réinitialisation stricte de la variable globale selectedTheme = null lors de l'accès au "Mode Examen". Cela évitera que les filtres d'un entraînement thématique précédent ne brisent l'obligation d'avoir un examen blanc à 60 questions totalement aléatoires.

