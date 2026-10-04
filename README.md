# 🪂 Assistant Parapente

**Assistant Parapente** est une application web progressive (SPA) moderne dédiée aux pilotes de parapente. Elle centralise la recherche de sites de vol avec calcul d'exploitabilité météo en temps réel (AROME/GFS), un carnet de vol numérique avec analyseur de traces GPS `.igc` et suivi d'usure des voiles, la préparation aux brevets théoriques FFVL (BI, BP, BPC), ainsi qu'une bibliothèque de cours et de manuels.

---

## 📖 Architecture & Documentation Technique

> [!IMPORTANT]
> Pour toute information détaillée sur l'architecture, la structure des modules ES6, le système d'évènements `data-action`, le calcul des scores météo et les consignes pour développeurs & agents IA, consultez le fichier maître :
> 👉 **[DOCUMENTATION.md](DOCUMENTATION.md)**

---

## 🚀 Démarrage Rapide

L'application fonctionne en **JavaScript ES6 natif** sans aucune étape de compilation pour le développement. Un build optionnel (Vite) produit une version optimisée dans `dist/`.

### Lancer un serveur local :

```bash
# Avec Python 3
python3 -m http.server 8000

# Ou avec Node.js / npx
npx serve .
```

Ouvrez ensuite votre navigateur sur `http://localhost:8000`.

### Build optimisé (optionnel) :

```bash
npm run build     # génère dist/ (JS/CSS hachés et minifiés, service worker versionné)
npm run preview   # sert dist/ en local
```

---

## 🛠️ Stack Technique

- **Core**: HTML5, Vanilla JavaScript (ES6 Modules), CSS3 (Variables & Glassmorphism).
- **Cartographie**: Leaflet.js (2D) & MapLibre GL JS (3D Relief DEM).
- **Météo**: API Open-Meteo (Prévisions haute résolution AROME & GFS).
- **Navigation & État**: Routeur SPA custom avec API History & Gestionnaire d'état réactif Pub/Sub (`AppState`).
- **Synchronisation**: Stockage hybride LocalStorage (`StorageService`) + Firebase Cloud Firestore (`FirebaseService`).
- **Parsing GPS**: Parser IGC natif côté client (`igc_parser.js` : détection du vol, analyse, treuil) et capteurs Syride `.sdf` (`sdf_parser.js` : facteur de charge, température du boîtier).

---

## 📂 Structure Synthétique du Projet

- `index.html` : Point d'entrée principal SPA.
- `js/core/` : Moteur de l'application (Boot Sequence, Event Delegator, Router, AppState, UIManager).
- `js/views/` : Contrôleurs de vues DOM (`sites.js`, `logbook.js`, `quiz.js`, `manual.js`).
- `js/services/` : Services métiers et API (`sites_service.js`, `logbook_service.js`, `quiz_service.js`, `firebase_service.js`, `igc_parser.js`).
- `js/components/` : Composants 3D MapLibre GL (`map_3d.js`).
- `css/` : Style modulaire Vanilla CSS (Thèmes Auto/Clair/Sombre et accents selon le niveau FFVL).
- `courses/` : Fichiers PDF officiels classés par niveau de brevet.

---

*Documentation & Code maintenus pour l'Assistant Parapente.*
