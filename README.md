# 🪂 Assistant Parapente

> [!CAUTION]
> **Projet Privé & Propriétaire — Tous droits réservés / All Rights Reserved**
> 
> Ce dépôt et l'application **Assistant Parapente** sont un projet **privé et propriétaire** appartenant exclusivement à **Maxime Urbaniak**.
> 
> **Aucune licence libre ni droit d'utilisation n'est accordé** : vous n'êtes pas autorisé à copier, cloner pour réutilisation publique, modifier, redistribuer, héberger, sous-licencier ou exploiter tout ou partie du code source, de l'interface ou des éléments graphiques sans l'autorisation écrite préalable de l'auteur (voir [`LICENSE`](LICENSE)).
> 
> **Contributions extérieures fermées** : ce projet n'accepte aucune contribution externe, pull request ou issue de tiers.

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

### Vérifier avant d'envoyer (mêmes contrôles que la CI) :

```bash
npm run verify        # lint, format, typecheck, tests, tests Python, build (≈ 5 s)
npm run verify:full   # + tests e2e Playwright Chromium et WebKit (≈ 35 s)
```

Un hook `pre-push` (`.githooks/`, activé par `npm install`) lance `npm run verify` avant chaque `git push` et bloque l'envoi si quelque chose échoue (`git push --no-verify` pour contourner exceptionnellement).

### Règles Firestore

`firestore.rules` est la source de vérité des règles de sécurité (chaque pilote n'accède qu'à `users/{son uid}`). Les tester en local, sur l'émulateur (Java requis, rien n'est envoyé à Firebase) :

```bash
npm run test:rules
```

Le déploiement reste manuel : `firebase deploy --only firestore:rules`, ou coller le fichier dans la console Firebase > Firestore > Règles.

---

## ⚖️ Droits, Propriété Privée & Contenus Tiers

- **Propriété exclusive & Droits d'auteur** : Le code source, l'architecture logicielle, le design de l'interface utilisateur, la marque et les textes originaux sont © Maxime Urbaniak — **tous droits réservés** (voir [`LICENSE`](LICENSE)). Il s'agit d'un développement **strictement privé et propriétaire**. Aucune autorisation de réutilisation, de reproduction ou de diffusion publique n'est concédée.
- **Contributions fermées** : Ce dépôt est rendu visible à titre de vitrine et de consultation personnelle. Le projet n'accepte aucune contribution extérieure : toute pull request non sollicitée sera systématiquement fermée. Pour signaler une éventuelle faille de sécurité en toute confidentialité, consultez [`SECURITY.md`](SECURITY.md).
- **Contenus tiers fédéraux** : Les cours, affiches, livrets de progression et questions officielles du QCM restent la **propriété intellectuelle exclusive de la FFVL et de leurs auteurs respectifs** (voir [`NOTICE`](NOTICE)). Ils sont référencés ou mis à disposition sans but lucratif uniquement pour faciliter la formation et la sécurité des pilotes. Toute demande de retrait ou de modification émanant d'un ayant droit est traitée sans délai.

## 🛠️ Stack Technique

- **Core**: HTML5, Vanilla JavaScript (ES6 Modules), CSS3 (Variables & Glassmorphism).
- **Cartographie**: Leaflet.js (2D) & MapLibre GL JS (3D Relief DEM).
- **Météo**: API Open-Meteo (Prévisions haute résolution AROME & GFS).
- **Navigation & État**: Routeur SPA custom avec API History & Gestionnaire d'état réactif Pub/Sub (`AppState`).
- **Synchronisation**: Stockage hybride LocalStorage (`StorageService`) + Firebase Cloud Firestore (`FirebaseService`).
- **Parsing GPS**: Parser IGC natif côté client (`igc_parser.js` : détection du vol, analyse, treuil) et capteurs Syride `.sdf` (`sdf_parser.js` : facteur de charge).

---

## 📂 Structure Synthétique du Projet

- `index.html` : Point d'entrée principal SPA.
- `js/core/` : Moteur de l'application (Boot Sequence, Event Delegator, Router, AppState, UIManager).
- `js/views/` : Contrôleurs de vues DOM (`sites.js`, `logbook.js`, `quiz.js`, `manual.js`).
- `js/services/` : Services métiers et API (`sites_service.js`, `logbook_service.js`, `quiz_service.js`, `firebase_service.js`, `igc_parser.js`).
- `js/components/` : Composants 3D MapLibre GL (`map_3d.js`).
- `css/` : Style modulaire Vanilla CSS (Thèmes Auto/Clair/Sombre et accents selon le niveau FFVL).
- `courses/` : documents pédagogiques de la FFVL, **absents du dépôt** (propriété de la FFVL et de leurs auteurs, voir `NOTICE`) ; le site les sert depuis son propre serveur.

---

*Documentation & Code maintenus pour l'Assistant Parapente.*
