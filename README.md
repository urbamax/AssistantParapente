# 🪂 Assistant Parapente

> [!CAUTION]
> **Projet propriétaire — Tous droits réservés / All Rights Reserved**
> 
> Le code de l'application **Assistant Parapente** est publié pour être consulté, mais il reste la propriété de **Maxime Urbaniak**.
> 
> **Aucune licence libre ni droit d'utilisation n'est accordé** : vous n'êtes pas autorisé à copier, modifier, redistribuer, héberger, sous-licencier ou exploiter tout ou partie du code source, de l'interface ou des éléments graphiques sans l'autorisation écrite préalable de l'auteur (voir [`LICENSE`](LICENSE)).
> 
> **Je ne souhaite pas que ce dépôt soit forké.** Les conditions d'utilisation de GitHub permettent techniquement de forker un dépôt public, mais un fork ne donne **aucun droit** d'utiliser, copier, modifier, héberger, déployer, publier ou redistribuer ce code, en tout ou en partie, sur GitHub ou ailleurs. Toute réutilisation sans mon autorisation écrite est une contrefaçon : je demanderai son retrait à GitHub (signalement DMCA) ou à l'hébergeur concerné.
> 
> **Contributions non acceptées** : les pull requests et issues extérieures ne sont pas acceptées.

**Assistant Parapente** est une Progressive Web App (PWA) tout-en-un conçue pour accompagner les pilotes de vol libre du Brevet Initial jusqu'au Brevet de Pilote Confirmé : choix et exploitabilité des sites de vol, carnet de vol numérique avec analyse de traces GPS, entraînement aux examens théoriques FFVL officiels, check-lists de sécurité et bibliothèque de formation.

---

## 🌟 Fonctionnalités Principales

### 🗺️ Sites de Vol & Météo Pré-Vol *(accès restreint au rôle propriétaire)*
- **Cartographie 2D & 3D Relief** : Navigation interactive sur carte Leaflet 2D et rendu 3D haute performance avec relief DEM via MapLibre GL JS.
- **Exploitabilité en temps réel** : Analyse croisée des modèles météo haute résolution AROME (0.01° et 0.025°) et GFS via l'API Open-Meteo pour chaque décollage et atterrissage.
- **Balises & Brises** : Intégration des balises en temps réel (Pioupiou / FFVL) et des windgrams Spotair.
- **Orientation & Aérologie** : Scoring visuel de l'exploitabilité par tranche horaire, alertes de vent fort, de rafales et de risque orageux (CAPE), avec rappel systématique de décision pilote.
- **Fonctionnement Hors-Ligne** : Mise en cache automatique des dernières prévisions consultées pour un accès sur le terrain hors réseau.

### 📓 Carnet de Vol & Analyseur de Traces GPS
- **Parsing IGC natif 100% côté client** : Analyse instantanée des fichiers `.igc` sans envoi serveur (détection automatique du décollage, de l'atterrissage, de la durée de vol, des altitudes, du dénivelé, des gains, des thermiques enroulés et de la finesse).
- **Détection Treuil** : Détection et qualification automatique des remorquages au treuil et des largages.
- **Capteurs de Vol Avancés** : Prise en charge des fichiers Syride `.sdf` pour l'analyse des facteurs de charge (accéléromètre G-Max / G-Min).
- **Import en Masse** : Glisser-déposer de lots de fichiers `.igc` ou d'archives `.zip`, et import direct de l'historique de vols fédéral FFVL.
- **Gestion du Matériel & Usure** : Suivi des heures de vol cumulées par aile, sellette et parachute de secours, avec rappels d'entretien et de repliage.
- **Encadrement École & Validation** : Suivi des sessions en école (nom de l'école, stage, moniteurs, brevet préparé) et enregistrement des validations pratiques de brevets.
- **Statistiques & Records** : Graphiques d'activité, records personnels et filtres multi-critères.
- **Synchronisation Hybride** : Persistance locale immédiate (LocalStorage & IndexedDB) et synchronisation cloud temps réel avec Firebase Cloud Firestore.

### 🎓 Théorie & Brevets FFVL (QCM Officiel)
- **100% Conforme aux Examens Officiels FFVL** : Aligné rigoureusement sur le barème et la sélection des examens officiels de la FFVL (qcm.ffvl.fr).
  - **Brevet Initial (BI)** : 30 questions $\times$ 6 pts = **180 points** (seuil de réussite : 135 pts / 75%).
  - **Brevet de Pilote (BP)** : 60 questions $\times$ 6 pts = **360 points** (seuil de réussite : 270 pts / 75%).
  - **Brevet de Pilote Confirmé (BPC)** : 30 questions QCM $\times$ 6 pts = **180 points** (+ questions ouvertes).
  - **Qualification Treuil** : questions officielles en entraînement, révision et perfectionnement (pas d'examen théorique QCM).
- **Distribution Fédérale par Blocs de 10** : Respect strict des quotas par thème (Météo 20%, Mécavol 20%, Pilotage 20%, Matériel 10%, Réglementation 10%, Facteurs humains 10%, Milieu naturel 10%) avec exclusion des questions réservées au Delta.
- **Modes d'Entraînement Multiples** :
  - **Mode Examen** : Conditions réelles d'examen (sans correction immédiate, détection anti-triche et bilan officiel en points).
  - **Mode Révision (Répétition Espacée)** : Algorithme de mémorisation basé sur SM-2 avec suivi des échéances de révision.
  - **Mode Perfectionnement** : Ciblage des questions à travailler jusqu'à atteindre un pourcentage de maîtrise visé (50%, 75%, 90%, 100%).
  - **Mode Entraînement** : Filtrage par thème et volume, validation pas-à-pas avec explications pédagogiques détaillées pour chaque choix.
- **Ateliers & Axes de Révision** : Ateliers anti-pièges et parcours de révision chapitre par chapitre directement reliés aux pages des manuels officiels.
- **Synthèse Vocale Interactive** : Lecture audio des questions et options pour réviser les mains libres.
- **Suivi de Progression Officielle** : Suivi des brevets théoriques et pratiques obtenus avec affichage des scores officiels en points et pourcentages.

### 🛡️ Sécurité, Check-lists & Fiche d'Urgence ICE
- **Check-lists interactives** : Méthode prévol 7 points de l'Initiation et grille 9BD.
- **Test « Prêt à décoller ? »** : Verdict colorimétrique objectif (vert / orange / rouge) avant l'envol.
- **Fiche d'urgence ICE & QR Code casque** : Génération d'étiquette QR (vCard hors-ligne + lecteur web `?mode=ICE#...`) avec contacts d'urgence, groupe sanguin, allergies, anticoagulants et licence.
- **Urgences Aéronautiques** : Procédure d'appel de secours, coordonnées GPS instantanées, rappel de la fréquence sécurité FFVL (143.9875 MHz) et numéro d'urgence européen 112.

### 📱 PWA, Sauvegarde & Communauté
- **Installation 1-clic & Hors-Ligne** : Installable sur l'écran d'accueil (Android/Chromium natif + guide visuel iOS Safari), utilisable sans réseau au décollage.
- **Sauvegarde locale sans compte** : Export/import JSON complet (carnet, matériel, traces IGC compressées, statistiques QCM) sans création de compte obligatoire.
- **Retours pilotes & Communauté** : Modale intégrée de signalement/suggestion et accès direct au serveur Discord communautaire.

### 📚 Bibliothèque & Visionneuse de Cours
- **Lecteur de documents intégré** : Consultation in-app des livrets de progression et manuels fédéraux officiels via PDF.js.
- **Renvois contextuels** : Liens directs depuis chaque question QCM vers la page exacte du manuel officiel traitant du sujet.

---

## 🛠️ Stack Technique & Architecture

- **Front-end** : Vanilla JavaScript (ES6 Modules natifs), HTML5 sémantique, CSS3 moderne (Variables, Glassmorphism, Responsive Mobile-First).
- **Cartographie** : Leaflet.js (2D) et MapLibre GL JS (3D Relief DEM vectoriel).
- **Météo** : Open-Meteo API (modèles haute précision Météo-France AROME et GFS).
- **Navigation & État** : Routeur Single Page Application (SPA) custom exploitant l'API History, orchestré par un bus d'événements Pub/Sub réactif (`AppState`).
- **Stockage Hybride** : IndexedDB (`IDBStorage`) + LocalStorage (`StorageService`) couplés à Google Cloud Firestore (`FirebaseService`).
- **Qualité & Tests** :
  - Tests unitaires et d'intégration : **Vitest** (plus de 2 000 tests automatisés).
  - Tests End-to-End : **Playwright** (Chromium et WebKit / Safari).
  - Typage & Validation : **TypeScript** (`tsc -p jsconfig.json`), **ESLint** et **Prettier**.
  - Pipeline de validation pre-push stricte (`.githooks/`).

---

## 📖 Documentation Technique

Pour consulter l'architecture logicielle, le cycle de vie des vues et les spécifications internes du projet :
👉 Consultez **[DOCUMENTATION.md](DOCUMENTATION.md)**

---

## ⚖️ Droits, Propriété & Contenus Tiers

- **Propriété exclusive & Droits d'auteur** : Le code source, l'architecture logicielle, le design de l'interface utilisateur, la marque et les textes originaux sont © Maxime Urbaniak — **tous droits réservés** (voir [`LICENSE`](LICENSE)). Aucune autorisation de réutilisation, de reproduction ou de diffusion publique n'est concédée.
- **Contributions non acceptées** : Ce dépôt est consultable en lecture seule à titre de vitrine personnelle. Les contributions extérieures (pull requests, issues) ne sont pas acceptées. Je ne souhaite pas que ce dépôt soit forké ; un fork ne confère aucun droit de réutilisation, et toute copie réutilisée sans autorisation fera l'objet d'une demande de retrait (signalement DMCA auprès de GitHub ou de l'hébergeur). Pour signaler une éventuelle vulnérabilité de sécurité en toute confidentialité, consultez [`SECURITY.md`](SECURITY.md).
- **Contenus tiers fédéraux** : Les cours, affiches, livrets de progression et questions officielles du QCM restent la **propriété intellectuelle exclusive de la FFVL et de leurs auteurs respectifs** (voir [`NOTICE`](NOTICE)). Ils sont référencés sans but lucratif uniquement pour faciliter la formation et la sécurité des pilotes. Toute demande de retrait ou de modification émanant d'un ayant droit est traitée sans délai.

---

*Assistant Parapente — Conçu pour et par des passionnés de vol libre.*
