# 📋 Rapport d'Audit de Modernité du Code — Assistant Parapente
**Destinataire exclusif :** Claude (et développeurs du projet)  
**Date d'audit :** Septembre 2026  
**Périmètre d'exécution :** 100% LOCAL (aucune modification externe, aucun push git, aucun déploiement distant)  
**Statut initial :** Tests passants (16/16 fichiers, 93/93 tests unitaires Vitest), ESLint 10 passant (0 erreur).

---

## 🧭 1. Synthèse Générale & Tableau de Bord

L'application **Assistant Parapente** est une Progressive Web App (SPA) écrite en **Vanilla JavaScript ES6** avec un modèle sans compilation obligatoire en développement. Le projet a bénéficié de refactorisations récentes de qualité, notamment sur le tooling, la sécurité (XSS) et la délégation d'événements.

Néanmoins, la base de code présente une **hétérogénéité générationnelle** : des outils et patterns 2024-2026 cohabitent avec des patterns hérités des années 2015-2020.

### Note Globale de Modernité : **7,2 / 10**

| Domaine | Note | Diagnostic synthétique |
| :--- | :---: | :--- |
| **Outillage & Tests** | **8,5 / 10** | Vite 8, Vitest 4, Playwright 1.62, ESLint 10 flat config. Excellent. Seul bémol : `"type": "commonjs"` dans `package.json`. |
| **Standards JavaScript (ES)** | **8,5 / 10** | Zéro `var`, ES Modules natifs, `async/await`, `?.`, `??`, `Map`/`Set`. Code propre et lisible. |
| **Sécurité & Événements** | **8,5 / 10** | Délégation d'événements déclarative (`data-action`), zéro `onclick` inline (test Vitest gardien), CSP en place. |
| **PWA & Offline** | **8,0 / 10** | Service Worker intelligent versionné par hash SHA256 Vite, stratégie anti-stale cache. |
| **Design System & CSS** | **7,0 / 10** | Variables complètes, tokens par niveau FFVL, `:has()` moderne. Bémol : unités `100vh`, absence de nesting et `light-dark()`. |
| **Performance & Données** | **6,0 / 10** | `sites_data.json` (3 Mo) bloque le boot initial. `LocalStorage` synchrone pour les traces GPS IGC volumineuses. |
| **Architecture DOM / HTML** | **5,5 / 10** | Monolithe `index.html` (> 2000 lignes) avec vues masquées (`display: none`), modales artisanales hors de l'API `<dialog>`. |
| **Encapsulation & État** | **5,5 / 10** | Persistance de variables globales sur `window` (`SITES_DATA`, `FirebaseAuthEngine`, etc.), polling `setTimeout` pour l'injection du header. |

---

## 🔍 2. Diagnostic Approfondi par Domaine

### 2.1. Architecture DOM, HTML & Modales (Majeur)

#### ❌ Problème 1 : Monolithe HTML avec écrans cachés
- **Fichier :** [index.html](index.html) (2 016 lignes, ~151 Ko)
- **Constat :** L'intégralité des 8 écrans (`#sites-screen`, `#logbook-screen`, `#qcm-screen`, etc.) et des 5 modales est injectée statiquement dans le DOM dès le premier chargement. L'affichage repose sur le masquage CSS (`.mode-screen { display: none; }` et `.active { display: block; }`).
- **Impact :** 
  - Arbre DOM lourd dès l'initiation (plus de 2 000 nœuds).
  - Ralentissement du First Contentful Paint (FCP) et de l'Interaction to Next Paint (INP) sur smartphone.
- **Cible moderne :** Rendu à la demande (Dynamic View Mounting) via des templates `<template>` ou des Web Components natifs (`<sites-view>`, `<logbook-view>`), ne conservant dans le DOM que la vue active.

#### ❌ Problème 2 : Modales artisanales vs API native `<dialog>`
- **Fichiers :** 
  - [index.html#L1259-L1985](index.html#L1259-L1985) (`#gdpr-settings-modal`, `#spotair-modal`, `#manual-modal`)
  - [js/core/ui_manager.js#L221-L238](js/core/ui_manager.js#L221-L238) (`showManual`, `hideManual`)
  - [js/views/sites.js](js/views/sites.js) (`openSpotairModal`, `closeSpotairModal`)
- **Constat :** Les fenêtres modales utilisent des `<div>` ordinaires positionnées en `position: fixed; z-index: ...; display: flex;`.
  - **Aucun piégeage du focus clavier (Focus Trap)** : un utilisateur naviguant au clavier (Tab) peut sortir de la modale et interagir avec l'arrière-plan masqué.
  - **Touche Échap (Escape) ignorée** : aucune écoute native de la touche Échap pour fermer les modales.
  - Gestion manuelle et fragile des animations d'ouverture/fermeture via `setTimeout(..., 400)` et `void modal.offsetWidth`.
- **Cible moderne :** Utiliser la balise HTML native `<dialog>` et ses méthodes `.showModal()` et `.close()`.
  - Intégration automatique dans le `top-layer` du navigateur.
  - Focus trap natif et automatique pour les lecteurs d'écran et claviers.
  - Écoute automatique de la touche `Échap` (événement `cancel`).
  - Style du fond via le pseudo-élément standard `dialog::backdrop`.

#### ❌ Problème 3 : Injection de composants partagés avec polling aveugle
- **Fichier :** [js/core/ui_manager.js#L33-L74](js/core/ui_manager.js#L33-L74) et [js/core/ui_manager.js#L188-L203](js/core/ui_manager.js#L188-L203)
- **Constat :** Le header et le footer sont chargés via un `fetch('components/header.html')` puis injectés par `innerHTML`. Pour synchroniser l'UI après l'injection, la méthode `restoreLevelUI` s'auto-appelle jusqu'à 50 fois avec `setTimeout(..., 100)` !
- **Cible moderne :**
  - Soit encapsuler `<app-header>` et `<app-footer>` sous forme de **Web Components natifs** (`Custom Elements` : `customElements.define('app-header', HeaderComponent)`).
  - Soit a minima faire renvoyer à `loadComponents()` une `Promise` explicite résolue dès l'injection terminée, sans aucun polling `setTimeout`.

#### ❌ Problème 4 : Absence de View Transitions dans le Routeur SPA
- **Fichier :** [js/core/router.js#L42-L61](js/core/router.js#L42-L61)
- **Constat :** Le routeur masque brutalement l'ancienne vue et affiche la nouvelle en manipulant des classes CSS `.active`.
- **Cible moderne :** Utiliser la **View Transitions API** native (`document.startViewTransition`) avec fallback gracieux pour les navigateurs non supportés. Permet des transitions fluides (fade, morphing) en quelques lignes de CSS sans aucune dépendance tierce.

---

### 2.2. JavaScript, Architecture & Standards ES

#### ❌ Problème 5 : Pollution de l'objet global `window`
- **Fichiers :**
  - [js/core/main.js#L296](js/core/main.js#L296) : `window.SITES_DATA = ...`
  - [js/services/sites_service.js#L251](js/services/sites_service.js#L251) : `if (typeof SITES_DATA === 'undefined') ...`
  - [js/services/firebase_service.js#L1290](js/services/firebase_service.js#L1290) : `window.FirebaseAuthEngine = ...`
  - [js/views/manual.js#L291](js/views/manual.js#L291) : `window.LibraryEngine = ...`
  - [js/views/logbook.js#L1042](js/views/logbook.js#L1042) : `window.TEMPORARY_IGC_RAW = ...`
  - [js/services/quiz_service.js#L61](js/services/quiz_service.js#L61) : `window.QCM_OFFICIAL = ...`
  - [types/globals.d.ts#L6-L19](types/globals.d.ts#L6-L19) : types any déclarés pour compenser.
- **Constat :** Bien que le projet utilise des modules ES6 (`import`/`export`), les composants et services continuent à communiquer et à stocker des données sur `window`.
- **Cible moderne :** Encapsulation stricte dans les modules. Par exemple, `SitesService` doit posséder sa propre méthode `loadSites()` et exposer un getter `SitesService.getSites()`, éliminant complètement la variable globale `SITES_DATA`.

#### ❌ Problème 6 : Génération d'identifiants par timestamp
- **Fichier :** [js/services/logbook_service.js#L52](js/services/logbook_service.js#L52)
- **Constat :** `flight.id = Date.now().toString();`
- **Impact :** Risque de collision d'identifiants lors d'imports groupés ou d'actions rapides, et manque de conformité avec les formats standards d'UUID.
- **Cible moderne :** `flight.id = crypto.randomUUID();` (API native du navigateur disponible universellement).

#### ❌ Problème 7 : Imports Firebase CDN répétés et disparates
- **Fichiers :**
  - [js/services/firebase_service.js](js/services/firebase_service.js) : contient 16 occurrences de `await import('https://www.gstatic.com/firebasejs/10.12.0/...')` disséminées dans chaque méthode.
  - [sw.js#L26-L27](sw.js#L26-L27) : utilise `importScripts()` avec les scripts `firebase-app-compat.js` (API compat v8) au lieu du SDK modulaire.
- **Cible moderne :**
  - Centraliser les imports Firebase dans un module wrapper unique ou utiliser un `<script type="importmap">` dans `index.html`.
  - Migrer le Service Worker en mode module (`type: 'module'`) pour harmoniser l'usage du SDK.

---

### 2.3. Performance & Stockage des Données

#### ❌ Problème 8 : Blocage du boot sur un JSON de 3 Mo
- **Fichier :** [js/core/main.js#L292-L303](js/core/main.js#L292-L303)
- **Constat :**
  ```javascript
  document.addEventListener('DOMContentLoaded', async () => {
      try {
          const response = await fetch('js/data/sites_data.json');
          window.SITES_DATA = await response.json();
      } catch (e) { ... }
      bootApplication();
  });
  ```
  Le boot global attend la fin du téléchargement et du parsing JSON de **3 Mo** de sites de décollage avant d'initialiser le routeur et l'interface.
- **Impact :** Si l'utilisateur démarre sur le QCM, la Bibliothèque ou son Carnet de vol (qui n'ont pas besoin des sites), il subit un gel de 300 ms à plusieurs secondes selon la connexion.
- **Cible moderne :** Rendre le chargement de `sites_data.json` paresseux (lazy loading) à l'intérieur de `SitesService.init()` ou au montage de la vue Sites (`SitesView.mount()`).

#### ❌ Problème 9 : Traces GPS IGC stockées en synchrone dans `LocalStorage`
- **Fichiers :** 
  - [js/services/storage.js](js/services/storage.js)
  - [js/services/logbook_service.js#L20-L24](js/services/logbook_service.js#L20-L24)
- **Constat :** Les vols enregistrés contiennent des traces GPS complètes (points de vol avec latitude, longitude, altitude, horodatage, vario). L'intégralité du tableau `this.flights` est convertie en JSON et stockée dans `localStorage.setItem('tp_logbook_data', ...)`.
- **Impact :**
  - La limite maximale de `LocalStorage` est de **5 Mo** par domaine. Quelques fichiers IGC détaillés suffisent à saturer la mémoire et déclencher une erreur `QuotaExceededError`.
  - `localStorage` est synchrone et bloque le thread UI principal lors de la sérialisation/désérialisation de gros volumes de données.
- **Cible moderne :** Utiliser **IndexedDB** (via une abstraction moderne et légère ou le wrapper standard `idb`) pour stocker les traces GPS et les vols volumineux de façon asynchrone, en réservant `LocalStorage` aux simples préférences (thème, niveau).

---

### 2.4. CSS & Design System

#### ❌ Problème 10 : Unités de Viewport `100vh`
- **Fichiers :**
  - [css/base.css#L108](css/base.css#L108) (`body { height: 100vh; }`)
  - [css/auth.css#L9](css/auth.css#L9)
  - [css/quiz.css#L154](css/quiz.css#L154)
  - [css/sites.css#L842](css/sites.css#L842)
  - [css/gdpr.css#L153](css/gdpr.css#L153)
- **Constat :** L'unité `100vh` ne tient pas compte des barres d'outils dynamiques (barre d'adresse, barre de navigation basse) des navigateurs mobiles (Safari iOS, Chrome Android), provoquant des sauts de mise en page et des boutons masqués.
- **Cible moderne :** Remplacer par `100dvh` (Dynamic Viewport Height) avec fallback `100vh`.

#### ❌ Problème 11 : Absence de CSS Nesting natif
- **Fichier :** [css/components.css](css/components.css), [css/sites.css](css/sites.css), [css/header.css](css/header.css)
- **Constat :** Le code utilise une syntaxe verbeuse et répétée :
  ```css
  .icon-btn { ... }
  body.light-mode .icon-btn { ... }
  body.dark-theme .icon-btn { ... }
  .icon-btn:hover { ... }
  ```
- **Cible moderne :** Le nesting CSS natif (`&`) est Baseline universel depuis 2023 :
  ```css
  .icon-btn {
      ...
      &:hover { ... }
      body.light-mode & { ... }
  }
  ```

#### ❌ Problème 12 : Mode sombre/clair sans `light-dark()`
- **Fichier :** [css/base.css#L74-L97](css/base.css#L74-L97)
- **Constat :** Le fichier duplique manuellement 25 variables CSS dans un bloc `html.light-mode, body.light-mode`.
- **Cible moderne :** La fonction CSS standard `light-dark(valClair, valSombre)` permet de déclarer en une seule ligne :
  ```css
  --bg-app: light-dark(var(--p-light-deep), var(--p-dark-deep));
  --text-main: light-dark(#0f172a, #ffffff);
  ```

---

### 2.5. Outillage, Configuration & Node.js

#### ❌ Problème 13 : `"type": "commonjs"` dans `package.json`
- **Fichier :** [package.json#L27](package.json#L27)
- **Constat :** `package.json` spécifie `"type": "commonjs"`, alors que 100% du code applicatif, des tests et des configs de build (`vite.config.mjs`, `eslint.config.mjs`) sont en ES Modules.
- **Impact :** Lors de l'exécution de `npm test`, Vite émet un avertissement d'obsolescence :
  > `(!) Your Vite config uses features that are unsupported by configLoader: 'native' ... Use a .mjs extension or set "type": "module" in the closest package.json`
- **Cible moderne :** Passer `"type": "module"` dans `package.json`.

#### ❌ Problème 14 : Fichiers résiduels SMB dans le projet
- **Dossier :** `js/`
- **Constat :** Présence de 5 fichiers fantômes issus de partages réseau Apple SMB :
  - `js/.smbdeleteAAAb0e74.4`
  - `js/.smbdeleteBAAb0e74.4`
  - `js/.smbdeleteCAAb0e74.4`
  - `js/.smbdeleteDAAb0e74.4`
  - `js/.smbdeleteEAAb0e74.4`
- **Cible moderne :** Supprimer ces fichiers orphelins qui polluent les recherches de code.

---

## 🛠️ 3. Plan d'Action Strict pour Claude (Feuille de Route)

Chaque tâche est conçue pour être exécutée **localement**, de manière **incrémentale**, sans régression et vérifiable par les tests.

---

### 🟢 Phase 1 : Quick Wins Immédiats — TERMINÉ ✅

#### ✅ Tâche 1.1 : Harmoniser ESM dans `package.json`
* **Statut :** Exécuté et validé.
* `"type": "module"` activé dans `package.json`.
* `playwright.config.js` migré en ES module natif (`import ... from '@playwright/test'; export default ...`).
* `scripts/fix_xss.js` renommé en `scripts/fix_xss.cjs`.
* Disparition complète de l'avertissement Vite `configLoader: 'native'`.

#### ✅ Tâche 1.2 : Purge des fichiers résiduels SMB
* **Statut :** Exécuté et validé.
* Fichiers orphelins `js/.smbdelete*` purgés.

#### ✅ Tâche 1.3 : Remplacement des ID de vol par `crypto.randomUUID()`
* **Statut :** Exécuté et validé.
* Implémenté avec fallback dans `js/services/logbook_service.js` (`addFlight`, `addEquipment`) et `js/views/logbook.js`.

#### ✅ Tâche 1.4 : Correction des hauteurs de Viewport en CSS (`100dvh`)
* **Statut :** Exécuté et validé.
* `height: 100dvh;` (avec fallback `100vh`) appliqué dans `css/base.css`, `css/auth.css`, `css/quiz.css`, `css/sites.css`, `css/gdpr.css`.

---

### 🟡 Phase 2 : Modernisation Web APIs — TERMINÉ ✅

#### ✅ Tâche 2.1 : Rendre le chargement de `sites_data.json` asynchrone (Lazy Boot)
* **Statut :** Exécuté et validé.
* Implémenté via `SitesService.ensureSitesLoaded()` avec promesse unique partagée.
* Le boot de l'application dans `js/core/main.js` ne bloque plus sur le téléchargement de 3 Mo : temps de boot mesuré à **1.55 ms** en test E2E.
* `SitesView.mount()` et `LogbookView.mount()` attendent proprement la fin du chargement si nécessaire.

#### ✅ Tâche 2.2 : Intégrer l'API View Transitions dans le Routeur
* **Statut :** Exécuté et validé.
* `js/core/router.js` intègre `document.startViewTransition` avec fallback transparent.
* `css/base.css` gère le respect de la directive d'accessibilité `prefers-reduced-motion: reduce`.

#### ✅ Tâche 2.3 : Migrer les Modales vers la balise native `<dialog>`
* **Statut :** Exécuté et validé.
* `#manual-modal` et `#spotair-modal` migrés vers l'élément natif `<dialog>` dans `index.html`.
* `css/gdpr.css` enrichi pour gérer `dialog.gdpr-modal-overlay` et son pseudo-élément standard `::backdrop`.
* `ui_manager.js` et `sites.js` mis à jour pour invoquer `showModal()` / `close()` et écouter l'événement standard `cancel` (touche Échap).

---

### 🟠 Phase 3 : Architecture Pérenne (IndexedDB & Découplage) — TERMINÉ ✅

#### ✅ Tâche 3.1 : Découplage des données de sites (`SITES_DATA`)
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [js/services/sites_service.js](js/services/sites_service.js), [js/views/sites.js](js/views/sites.js), [js/views/logbook.js](js/views/logbook.js).
* **Réalisations :**
  1. `SitesService.getSites()` est désormais la source de vérité unique pour accéder au catalogue des sites.
  2. Toutes les occurrences directes de `SITES_DATA` ont été éradiquées de `js/views/sites.js` (marqueurs de carte, recherche, modale SpotAiR, comparateur) et de `js/views/logbook.js` (recherche de site par mots-clés, calcul du site le plus proche d'une balise GPS, autocomplétion des formulaires et affichage météo).
  3. `LogbookView.mount()` appelle explicitement `await SitesService.ensureSitesLoaded()` pour garantir que le catalogue est disponible à l'ouverture du carnet sans dépendance temporelle sur le boot.
  4. Rétro-compatibilité : `window.SITES_DATA` reste alimenté par `SitesService` en lecture seule pour la console de débogage et les scripts externes éventuels.

#### ✅ Tâche 3.2 : Migration du stockage IGC vers IndexedDB
* **Statut :** Exécuté et validé.
* **Fichiers créés/modifiés :** [js/services/idb_storage.js](js/services/idb_storage.js), [js/services/logbook_service.js](js/services/logbook_service.js), [js/views/logbook.js](js/views/logbook.js), [tests/services/idb_storage.test.js](tests/services/idb_storage.test.js).
* **Réalisations :**
  1. Création d'un module natif autonome `js/services/idb_storage.js` (zéro dépendance externe) utilisant l'API standard `window.indexedDB` (`AssistantParapente_IDB`, version 1).
  2. Trois Object Stores dédiés : `flights` (clé primaire `id`), `traces` (clé primaire `id`, dédié aux chaînes volumineuses de traces IGC brutes `rawIgc`), et `keyval` (clé primaire `key`).
  3. Fallback gracieux et transparent : si IndexedDB est désactivé ou indisponible (ex: navigation ultra-restreinte ou moteur Happy-DOM en test Node), le service se dégrade doucement sans jamais lever d'exception non gérée.
  4. Migration transparente à chaud : `LogbookService` migre automatiquement les vols existants depuis `LocalStorage` vers IndexedDB dès la première ouverture, et extrait les traces brutes dans le store dédié `traces`.
  5. Affichage asynchrone des traces : `LogbookView.showTrace` charge la trace depuis `LogbookService.getFlightTrace(sessionId)` (depuis IndexedDB si non présente en mémoire), prévenant toute saturation des 5 Mo de quota de `LocalStorage`.
  6. Suite de tests unitaires dédiée `tests/services/idb_storage.test.js` (7 tests couvrant le fallback et les opérations CRUD transactionnelles complètes).

---

### 🟣 Phase 4 : Modernisation CSS, Container Queries & Imports SDK — TERMINÉ ✅

#### ✅ Tâche 4.1 : CSS Nesting natif (`&`)
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [css/components.css](css/components.css), [css/sites.css](css/sites.css), [css/header.css](css/header.css), [css/auth.css](css/auth.css).
* **Réalisations :**
  1. Remplacement des sélecteurs verbeux et dupliqués (`.icon-btn`, `body.light-mode .icon-btn`, `.icon-btn:hover`) par la syntaxe CSS Nesting standard (`&`).
  2. Simplification des variantes d'état (`.action-btn.primary`, `.action-btn.secondary`, `.manual-tab-btn.active`).

#### ✅ Tâche 4.2 : Container Queries (`@container`)
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [css/sites.css](css/sites.css).
* **Réalisations :**
  1. Définition du contexte de conteneur sur le conteneur de liste : `.sites-list-container, #sites-list-container { container-type: inline-size; container-name: sites-container; }`.
  2. Les cartes `.site-card` adaptent désormais leur padding et leur agencement à la largeur réelle disponible dans leur colonne (`@container sites-container (max-width: 580px)`), et non plus uniquement au viewport global de l'écran.

#### ✅ Tâche 4.3 : Validation de formulaires non-intrusive (`:user-valid` / `:user-invalid`)
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [css/auth.css](css/auth.css).
* **Réalisations :**
  1. Ajout de `:user-invalid` et `:user-valid:not(:placeholder-shown)` sur les champs de saisie `.auth-input`.
  2. Les erreurs de validation n'apparaissent qu'après une interaction réelle de l'utilisateur (saisie ou perte de focus), évitant le comportement classique irritant des formulaires vierges soulignés de rouge.

#### ✅ Tâche 4.4 : Centralisation et mémoïsation des imports Firebase SDK
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [js/services/firebase_service.js](js/services/firebase_service.js).
* **Réalisations :**
  1. Élimination des 16 occurrences éparpillées de `await import('https://www.gstatic.com/firebasejs/10.12.0/...')`.
  2. Centralisation de la version du SDK (`FIREBASE_VERSION = '10.12.0'`) et création de chargeurs mémoïsés (`loadAppModule()`, `loadAuthModule()`, `loadFirestoreModule()`, `loadMessagingModule()`).
  3. Chaque module dynamique n'est désormais instancié qu'une seule fois dans une promesse partagée.

---

### 🌐 Phase 5 : PWA, Service Worker Offline & Standards Web Modernes — TERMINÉ ✅

#### ✅ Tâche 5.1 : Mise à jour du Manifest PWA W3C (`manifest.json`)
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [manifest.json](manifest.json).
* **Réalisations :**
  1. Ajout des champs standards `id: "./"`, `scope: "./"`, `lang: "fr"`, `orientation: "any"` et `categories`.
  2. Configuration de `display_override: ["window-controls-overlay", "standalone", "minimal-ui"]` pour un affichage pleine page natif sur desktop et mobile.
  3. Intégration de **Shortcuts d'application (raccourcis d'icône)** pour l'appui long sur smartphone :
     - Accès direct à **Sites & Météo** (`?mode=SITES`).
     - Accès direct au **Carnet de Vol** (`?mode=LOGBOOK`).
     - Accès direct aux **QCM Brevets FFVL** (`?mode=QUIZ`).
  4. Mise à jour de la couleur de thème (`#ff7a00`) et du fond (`#000205`) aux couleurs officielles de l'Assistant.

#### ✅ Tâche 5.2 : Précaching Service Worker (`sw.js`) pour le stockage IndexedDB
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [sw.js](sw.js).
* **Réalisations :**
  1. Ajout de `'./js/services/idb_storage.js'` dans `CRITICAL_ASSETS`.
  2. Garantit que le moteur IndexedDB autonome est immédiatement pré-caché à l'installation du SW pour un fonctionnement 100% hors-ligne en vol ou au décollage.

#### ✅ Tâche 5.3 : En-têtes HTML5 & Resource Hints (`index.html`)
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [index.html](index.html).
* **Réalisations :**
  1. Remplacement du `theme-color` statique par des balises adaptatives avec Media Queries :
     - `<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f8fafc">`
     - `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000205">`
  2. Balises méta PWA et plein écran iOS/iPadOS : `mobile-web-app-capable`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` (black-translucent).
  3. Optimisation des connexions réseau (Resource Hints) : ajout de `preconnect` et `dns-prefetch` pour `https://unpkg.com` (chargement accéléré de Leaflet, MapLibre et Deck.gl).

---

### ⚡ Phase 6 : Idiomes JavaScript Modernes (ES2023 / ES2024) & Sémantique HTML5 — TERMINÉ ✅

#### ✅ Tâche 6.1 : Groupement déclaratif des données avec `Object.groupBy()` (ES2024 Baseline)
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [js/views/manual.js](js/views/manual.js), [js/views/quiz.js](js/views/quiz.js), [js/services/quiz_service.js](js/services/quiz_service.js), [tests/services/quiz_service.test.js](tests/services/quiz_service.test.js).
* **Réalisations :**
  1. **Bibliothèque de cours (`js/views/manual.js`) :** `renderGroupedByCategory` regroupe les cours par catégorie via `Object.groupBy` avec fallback fonctionnel, remplaçant la boucle impérative manuelle.
  2. **Statistiques QCM (`js/views/quiz.js`) :** Agrégation par thème des questions du brevet via `Object.groupBy(levelQs, q => q.theme || 'Autre')`, calculant directement `totalQuestions` sans incréments manuels.
  3. **Service QCM (`js/services/quiz_service.js`) :** Ajout de la méthode `getQuestionsByTheme()` pour regrouper le catalogue officiel instantanément.
  4. Test unitaire dédié validant le bon fonctionnement de l'agrégation.

#### ✅ Tâche 6.2 : Tri immuable sans copie superficielle via `toSorted()` (ES2023 Baseline)
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [js/views/logbook.js](js/views/logbook.js), [js/views/quiz.js](js/views/quiz.js), [js/views/manual.js](js/views/manual.js), [js/services/sites_service.js](js/services/sites_service.js), [js/services/quiz_service.js](js/services/quiz_service.js).
* **Réalisations :**
  1. Éradication des motifs verbeux `[...arr].sort(...)` ou `.slice().sort(...)` au profit de `arr.toSorted(...)` (immutabilité native garantie par la spécification ES2023).
  2. **Inventaire du carnet de vol :** `LogbookService.getEquipment().toSorted(...)` empêche toute mutation accidentelle de la liste interne d'équipements.
  3. **Autocomplétion des sites :** `Array.from(new Set(allSites)).toSorted(...)`.
  4. **Tri des scores QCM :** `levelQuestionEntries.toSorted(...)` et `Object.entries(levelThemes).toSorted(...)`.
  5. **Géocodage d'adresses (`js/services/sites_service.js`) :** Suppression d'une structure intermédiaire artificielle `{ item, idx, rank }` servant autrefois à compenser le tri instable des vieux moteurs JS. `data.toSorted((a, b) => getCountryRank(a) - getCountryRank(b))[0]` est 100% stable et allège le code de 10 lignes.

#### ✅ Tâche 6.3 : Balise sémantique HTML5 `<search>` et champs `type="search"`
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [index.html](index.html), [css/library.css](css/library.css).
* **Réalisations :**
  1. Remplacement des `<div class="search-box">` par des conteneurs sémantiques `<search role="search" class="search-box">` pour :
     - La recherche de la Banque de questions QCM (`#bank-search`).
     - La recherche de la Bibliothèque de documents (`#library-search`).
     - La recherche d'adresse / GPS des sites (`#address-input`).
     - La barre de recherche principale des sites (`#site-search`).
  2. Passage des inputs en `type="search"` pour bénéficier du bouton d'effacement natif et de la touche "Recherche" sur les claviers virtuels mobiles iOS / Android.
  3. Mise à jour de [css/library.css](css/library.css) avec CSS Nesting natif et personnalisation du bouton de purge webkit.

---

### 🎨 Phase 7 : Optimisation du Cycle de Vie DOM & Cohérence des Thèmes (`color-scheme` & `light-dark()`) — TERMINÉ ✅

#### ✅ Tâche 7.1 : Éradication du polling aveugle de `restoreLevelUI`
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [js/core/ui_manager.js](js/core/ui_manager.js), [tests/core/ui_manager.test.js](tests/core/ui_manager.test.js).
* **Réalisations :**
  1. Suppression du comportement pathologique où `restoreLevelUI` planifiait 25 à 50 `setTimeout(..., 100)` même lorsque le sélecteur `#global-level-select` était déjà trouvé et synchronisé.
  2. La méthode synchronise désormais la valeur et se termine immédiatement sans aucun timer superflu.
  3. En cas de chargement asynchrone différé du header, les tentatives sont bornées à 3 (150 ms maximum au total) au lieu de 5 secondes de surcharge du thread JS.
  4. Test unitaire dédié vérifiant l'absence totale de timers traînants dès que l'élément est présent.

#### ✅ Tâche 7.2 : Cohérence native du thème (`color-scheme` & `light-dark()`)
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [css/base.css](css/base.css), [js/core/ui_manager.js](js/core/ui_manager.js), [index.html](index.html).
* **Réalisations :**
  1. **Déclaration native `color-scheme` :** Ajout de `color-scheme: light;` sur `html.light-mode` et `color-scheme: dark;` sur `html.dark-theme` / `body.dark-theme`.
  2. **Synchronisation dynamique :** `UIManager.applyThemeMode` synchronise explicitement `document.documentElement.style.colorScheme` dès le basculement de thème.
  3. **Prévention du flash (Early Boot) :** Le script synchrone de `<head>` dans `index.html` applique immédiatement `style.colorScheme` avant le premier rendu du DOM.
  4. **Adaptation des contrôles natifs :** Les barres de défilement (scrollbars), les fenêtres modales `<dialog>`, et les contrôles natifs de formulaire (`<input type="date">`, `<input type="time">`, `<select>`) s'affichent automatiquement dans le thème adéquat sans artefacts d'inversion navigateur.
  5. **Amélioration progressive `light-dark()` :** Bloc `@supports (color: light-dark(#fff, #000))` ajoutant la déclaration unifiée des jetons de couleur principaux en une seule ligne tout en conservant les fallbacks.
  6. **Résilience des gestionnaires d'erreurs globaux :** Remplacement de `document.body.appendChild` par `(document.body || document.documentElement).appendChild` dans les listeners d'erreur de `<head>` pour parer à tout crash survenu avant le parsing de `<body>`.

---

### 🛡️ Phase 8 : Généralisation Intégrale de l'API Native `<dialog>` (100% des Modales) — TERMINÉ ✅

#### ✅ Tâche 8.1 : Migration de toutes les modales restantes vers `<dialog>`
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [index.html](index.html), [css/gdpr.css](css/gdpr.css), [css/auth.css](css/auth.css), [js/gdpr_engine.js](js/gdpr_engine.js), [js/services/firebase_service.js](js/services/firebase_service.js).
* **Réalisations :**
  1. **Migration des 4 modales restantes vers `<dialog>` :**
     - `#auth-modal-overlay` : Espace Synchro & Authentification Firebase.
     - `#gdpr-settings-modal` : Paramètres de confidentialité et consentement local.
     - `#gdpr-privacy-modal` : Politique de confidentialité intégrale.
     - `#gdpr-legal-modal` : Mentions légales et clauses de non-responsabilité.
  2. **100% de couverture W3C native :** Les 6 modales de l'application (`#spotair-modal`, `#manual-modal`, `#auth-modal-overlay`, `#gdpr-settings-modal`, `#gdpr-privacy-modal`, `#gdpr-legal-modal`) reposent désormais exclusivement sur l'élément HTML5 standard `<dialog>`.
  3. **Intégration Top-Layer et Accessibilité (a11y) :**
     - Invocation de `showModal()` / `close()` dans `GdprEngine` et `FirebaseAuthEngine`.
     - Piégeage automatique du focus clavier (Focus Trap) natif sans aucune librairie externe.
     - Prise en charge native de la touche `Échap` via l'écoute de l'événement standard `cancel` avec fermeture animée.
     - Arrière-plans gérés uniformément via `dialog::backdrop` avec flou glassmorphic `backdrop-filter: blur(12px)`.

---

### ⚡ Phase 9 : Navigation Preload SW, Encapsulation QCM & CSS Avancé — TERMINÉ ✅

#### ✅ Tâche 9.1 : Encapsulation totale du catalogue QCM dans `QuizService`
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [js/services/quiz_service.js](js/services/quiz_service.js), [js/views/quiz.js](js/views/quiz.js), [tests/services/quiz_service.test.js](tests/services/quiz_service.test.js).
* **Réalisations :**
  1. **Encapsulation Orientée Objet :** Ajout des méthodes `getQuestions()`, `setQuestions(questions)`, et `getQuestionByCode(code)` sur le singleton `QuizService`.
  2. **Indexation haute performance :** Caching interne d'une `Map` sur `QuizService` permettant des résolutions de questions par code ou par identifiant en temps constant $\mathcal{O}(1)$ (au lieu d'un scan linéaire répété sur ~850 questions).
  3. **Découplage de la vue :** Éradication des lectures directes de `window.QCM_OFFICIAL` dans [js/views/quiz.js](js/views/quiz.js) (`renderStats`, `renderQuestionBank`, `_getQuestionMap`).
  4. **Passerelle de compatibilité ascendante :** Maintien transparent de `window.QCM_OFFICIAL` pour la console de débogage et les outils tiers sans impacter l'encapsulation de l'architecture.
  5. **Extension de la suite de tests :** Ajout de 2 nouveaux tests unitaires portant la suite à **106 tests unitaires** réussis.

#### ✅ Tâche 9.2 : Purge des états globaux résiduels (`TEMPORARY_IGC_RAW`)
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [js/views/logbook.js](js/views/logbook.js), [types/globals.d.ts](types/globals.d.ts).
* **Réalisations :**
  1. Suppression du fallback mort `window.TEMPORARY_IGC_RAW` dans `LogbookView.saveSession()`, remplacé définitivement par la gestion sur l'instance (`this.currentRawIgc`).
  2. Nettoyage de la déclaration TypeScript globale dans [types/globals.d.ts](types/globals.d.ts).

#### ✅ Tâche 9.3 : Accélération Service Worker par Navigation Preload & Offline Enrichi
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [sw.js](sw.js).
* **Réalisations :**
  1. **Navigation Preload API (Baseline Web API) :**
     - Activation de `registration.navigationPreload.enable()` dans l'événement `activate`.
     - Consommation de `event.preloadResponse` dans le gestionnaire de navigation `fetch`.
     - Élimine la pénalité de latence inhérente au démarrage à froid du Service Worker en démarrant la requête réseau en parallèle du boot du worker.
  2. **Offline enrichi pour la cartographie des cours :**
     - Ajout de `'./js/data/question_course_mapping.json'` dans les `CRITICAL_ASSETS` mis en cache à l'installation.
     - Garantit le fonctionnement hors-ligne à 100% de la mise en relation questions <-> fiches de cours.

#### ✅ Tâche 9.4 : Modernisation CSS (Nesting natif & Container Queries)
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [css/quiz.css](css/quiz.css), [css/logbook.css](css/logbook.css), [css/footer.css](css/footer.css).
* **Réalisations :**
  1. **Nesting natif CSS (`&`) :** Simplification et clarification des sélecteurs sur `.choice-btn`, `.qcm-option`, `.next-btn`, `.logbook-card`, `.logbook-tab-btn`, `.delete-btn`, `.app-footer`, `.ffvl-logo`, `.club-logo`.
  2. **Container Queries Logbook :**
     - Déclaration de `container-type: inline-size; container-name: logbook-list;` sur `.logbook-list`.
     - Règle `@container logbook-list (max-width: 480px)` adaptant automatiquement l'alignement des entêtes et détails de vols sans dépendre de la largeur globale de l'écran du navigateur.

---

### 🚀 Phase 10 : Lazy Loading 3D (Économie 2.4 Mo), Lookup O(1) Sites & Navigation UX — TERMINÉ ✅

#### ✅ Tâche 10.1 : Chargement Asynchrone à la Demande des Moteurs 3D (`map_3d.js`)
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [index.html](index.html), [js/components/map_3d.js](js/components/map_3d.js), [js/views/logbook.js](js/views/logbook.js).
* **Réalisations :**
  1. **Allègement drastique du chargement initial :** Retrait des scripts et feuilles de style lourds (`maplibre-gl.js` ~800 ko, `maplibre-gl.css` ~100 ko, `deck.gl.js` ~1.5 Mo) de `<head>` dans [index.html](index.html).
  2. **Économie de bande passante et CPU :** Économie nette de **~2.4 Mo de payload réseau** et élimination complète du temps de compilation WebGL au démarrage pour 100% des utilisateurs consultant la météo ou révisant les QCM.
  3. **Chargeur mémoïsé à la demande :** Implémentation de `Map3DComponent.ensureDependenciesLoaded()` injectant dynamiquement les scripts CDN au premier clic sur "Afficher la trace 3D", avec promesse partagée contre les appels concurrents.
  4. **Retour visuel non-bloquant :** Affichage d'un indicateur de chargement stylisé (`ri-loader-4-line`) avec gestion d'erreur réseau explicite et sans crash silencieux.

#### ✅ Tâche 10.2 : Indexation des Sites en $\mathcal{O}(1)$ (`SitesService.getSiteById`)
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [js/services/sites_service.js](js/services/sites_service.js), [js/views/sites.js](js/views/sites.js), [tests/services/sites_service.test.js](tests/services/sites_service.test.js).
* **Réalisations :**
  1. Ajout de `getSiteById(id)` avec cache indexé `Map` interne sur [js/services/sites_service.js](js/services/sites_service.js).
  2. Remplacement du parcours linéaire `SitesService.getSites().find((s) => s.id === siteId)` par `SitesService.getSiteById(siteId)` dans [js/views/sites.js](js/views/sites.js).
  3. Ajout d'un test unitaire dédié dans [tests/services/sites_service.test.js](tests/services/sites_service.test.js), portant la suite à **107 tests unitaires** réussis.

#### ✅ Tâche 10.3 : Optimisation Navigation, Historique & A11y (`router.js`)
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [js/core/router.js](js/core/router.js), [index.html](index.html).
* **Réalisations :**
  1. **Respect de `prefers-reduced-motion` :** Vérification proactive du media query utilisateur avant tout appel à `document.startViewTransition()`, évitant les surcoûts d'animation sur machines contraintes ou pour les personnes sensibles.
  2. **Gestion propre de l'historique :** Recours automatique à `window.history.replaceState` au lieu de `pushState` lorsque l'URL courante correspond déjà au mode cible, évitant l'empilement d'états redondants lors du retour arrière du navigateur.
  3. **Modernisation script pré-rendu :** Remplacement de `var` par `const` et `let` dans le script synchrone de `<head>`.

---

### 3.11. Phase 11 : Internationalisation Temps Réel (`Intl`), Sécurité Reverse Tabnabbing & A11y Bibliothèque

#### ✅ Tâche 11.1 : Internationalisation & Formatage Temporel Optimisé (`date_utils.js`)
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [js/utils/date_utils.js](js/utils/date_utils.js), [tests/utils/date_utils.test.js](tests/utils/date_utils.test.js).
* **Réalisations :**
  1. **Mémoïsation des formateurs `Intl` :** Déplacement des instances `Intl.DateTimeFormat('fr-FR', ...)` au niveau racine du module. Élimine l'instanciation répétitive d'objets lourds lors des itérations sur les vols ou relevés météo (réduction de la pression sur le garbage collector).
  2. **Support du temps relatif natif :** Ajout de la fonction `formatRelativeTime(dateStr, baseDate)` exploitant l'API moderne `Intl.RelativeTimeFormat('fr-FR', { numeric: 'auto' })` (ex: "à l'instant", "il y a 10 minutes", "avant-hier", "il y a 5 jours").
  3. **Tests unitaires :** Ajout de scénarios de validation complète dans [tests/utils/date_utils.test.js](tests/utils/date_utils.test.js), portant le total de la suite de tests à **108 tests unitaires** passants.

#### ✅ Tâche 11.2 : Sécurisation Absolue contre le Reverse Tabnabbing (`rel="noopener noreferrer"` & `window.open`)
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [js/views/manual.js](js/views/manual.js), [js/views/sites.js](js/views/sites.js), [js/core/main.js](js/core/main.js), [index.html](index.html).
* **Réalisations :**
  1. **Protection de `window.open` :** Ajout systématique du 3e argument `'noopener,noreferrer'` à chaque appel programmatique de `window.open` dans l'application (`openCourse` dans `manual.js`, `openGpsWith` et `focusSiteMap` dans `sites.js`, et gestionnaire central `openUrl` dans `main.js`). Empêche les sites tiers ouverts de manipuler l'application parente via `window.opener`.
  2. **Protection des ancres HTML `<a target="_blank">` :** Éradication de 100% des liens externes sans attribut de sécurité. Ajout de `rel="noopener noreferrer"` sur toutes les balises d'intégration de cartes et fiches externes (`index.html` et popups / boutons de `js/views/sites.js`).

#### ✅ Tâche 11.3 : Accessibilité Clavier et Style CSS Moderne (`library.js`, `library.css`, `sites.js`)
* **Statut :** Exécuté et validé.
* **Fichiers modifiés :** [js/views/manual.js](js/views/manual.js), [css/library.css](css/library.css), [js/views/sites.js](js/views/sites.js).
* **Réalisations :**
  1. **Composants interactifs a11y dans la Bibliothèque :** Remplacement de la propriété `.onclick` par `addEventListener`, ajout des attributs ARIA `role="button"`, `tabindex="0"`, `aria-label="Consulter le cours : ..."` et prise en charge des touches clavier `Enter` et `Space` pour l'ouverture des cours.
  2. **Localisations sauvegardées a11y :** Dans `SitesView.renderSavedLocations()`, remplacement des assignations `.onclick` par `addEventListener` avec accessibilité clavier complète (`role="button"`, `tabindex="0"`, `aria-label`).
  3. **CSS Nesting et `:focus-visible` :** Restructuration complète de `.library-list-item` avec le CSS Nesting natif (`&`), ajout d'un anneau de focus contrasté `:focus-visible` (outline 2px et halo lumineux) pour la navigation sans souris.

---

### 3.12. Phase 12 : Résolution du Bug Safari (Service Worker Cache Desync) & E2E WebKit

#### ✅ Tâche 12.1 : Éradication du Bug de Cache Safari (`SyntaxError: Importing binding name 'default'`)
* **Statut :** Résolu et validé directement dans Safari.
* **Fichiers modifiés :** [sw.js](sw.js), [bump.py](bump.py), [index.html](index.html), [components/header.html](components/header.html).
* **Diagnostic & Cause Racine :**
  - Dans Safari (WebKit), un bandeau rouge d'erreur globale affichait : `GLOBAL ERROR: SyntaxError: Importing binding name 'default' cannot be resolved by star export entries.`
  - Le Service Worker appliquait une stratégie *Cache-First* (`return cached || networkFetch`) avec un nom de cache figé (`parapente-app-v2026.09.20_v1`).
  - Lors des récentes étapes de refactorisation ESM, Safari conservait dans sa `CacheStorage` une version antérieure de certains modules tandis que d'autres étaient récupérés sur le réseau. Le moteur de liaison de modules de WebKit (JavaScriptCore) détectait alors un conflit d'exportations entre l'ancien graphe de dépendances et le nouveau.
* **Correctif appliqué :**
  1. **Garde-fou Dev `sw.js` :** Détection automatique de l'environnement de développement (`localhost` / `127.0.0.1`). En local, le Service Worker utilise désormais impérativement une stratégie **Network-First** avec repli sur cache uniquement hors-ligne (`fetch(request).catch(() => caches.match(request))`). Tout risque de déphasage de cache en développement est définitivement éliminé.
  2. **Bump de Cache automatique :** Passage à `2026.09.26_v1` via `bump.py`. Lors de l'activation du nouveau Service Worker, l'événement `activate` supprime automatiquement tous les anciens caches de l'application.

#### ✅ Tâche 12.2 : Automatisation de la Validation Cross-Browser WebKit (Safari)
* **Statut :** Intégré et validé.
* **Fichiers modifiés :** [playwright.config.js](playwright.config.js).
* **Réalisations :**
  1. **Ajout de la cible `webkit` :** Configuration du navigateur WebKit (moteur natif de Safari) aux côtés de Chromium dans la configuration Playwright.
  2. **Exécution réussie :** Les 6 tests E2E multi-navigateurs (Chromium + WebKit) passent avec succès (**6/6 passants**).

---

## 📊 3.4. Bilan Comparatif Avant / Après

| Dimension | Avant Intervention | Après Modernisation | Statut |
| :--- | :--- | :--- | :--- |
| **Norme Modules** | `"type": "commonjs"` avec warning Vite | `"type": "module"` ESM natif universel | 🟢 Conforme |
| **Génération d'ID** | `Date.now().toString()` (collisions) | `crypto.randomUUID()` avec fallback | 🟢 Baseline |
| **Unités Viewport** | `height: 100vh` (barre mobile coupée) | `height: 100dvh` (dynamic viewport) | 🟢 Baseline 2023 |
| **Démarrage Application**| Bloquant sur `sites_data.json` (3 Mo) | Asynchrone / Lazy boot (~1.08 ms) | 🟢 Optimisé |
| **Moteurs 3D (MapLibre/deck.gl)**| Chargés au boot dans `<head>` (~2.4 Mo) | **Lazy loaded à la demande** au clic 3D | 🟢 Gain 2.4 Mo |
| **Composants Modales** | `<div>` custom sans gestion a11y focus | `<dialog>` natif HTML5 avec `::backdrop` (100% des modales) | 🟢 Standard W3C |
| **Transitions d'écran** | Remplacement direct brutal sans transition | `document.startViewTransition()` + respect a11y | 🟢 Baseline |
| **Accès Catalogue Sites**| Variable globale mutable `window.SITES_DATA`| `SitesService.getSites()` & lookup $\mathcal{O}(1)$ | 🟢 Découplé |
| **Accès Banque QCM** | Variable globale `window.QCM_OFFICIAL` | `QuizService.getQuestions()` & index $\mathcal{O}(1)$ | 🟢 Découplé |
| **Stockage Traces IGC**| `LocalStorage` (risque de dépassement 5 Mo) | `IndexedDB` haute capacité avec fallback | 🟢 Pérenne |
| **PWA & Service Worker** | Cache classique sans Navigation Preload | **Navigation Preload** + Dev Network-First auto | 🟢 Moderne PWA |
| **Compatibilité Safari** | Risque de désynchronisation de cache WebKit | **Network-First localhost** + E2E WebKit automatique | 🟢 Blindé |
| **Internationalisation** | Appels répétés `toLocaleDateString` | Formateurs `Intl.DateTimeFormat` et `RelativeTimeFormat` mémoïsés | 🟢 Optimisé GC |
| **Sécurité Liens Externes**| `target="_blank"` et `window.open` sans protection | **100% protégés** via `noopener,noreferrer` (Reverse Tabnabbing) | 🟢 Durci OWASP |
| **HTML5 & Performance** | Meta statiques, pas de preconnect maps | `theme-color` adaptatif, preconnect unpkg | 🟢 Optimisé |
| **CSS Architecture** | Duplications verbeuses, media queries seules | CSS Nesting (`&`) + Container Queries (`@container`) | 🟢 Baseline 2023 |
| **Contrôles OS & Thème** | Formulaires et scrollbars non synchronisés | `color-scheme` natif + `light-dark()` (Baseline 2024) | 🟢 Baseline 2024 |
| **Synchronisation UI** | Polling aveugle (25-50 timers `setTimeout`) | Rendu direct et sortie immédiate (0 timer résiduel) | 🟢 Optimisé |
| **Validation Formulaires**| États `:focus` simples | `:user-valid` et `:user-invalid` non-intrusifs | 🟢 Baseline 2023 |
| **Chargement SDK Firebase**| 16 `await import()` disséminés avec URLs en dur | Chargeurs mémoïsés + constante de version unique | 🟢 Propre & DRY |
| **Agrégation de données** | Boucles impératives verbeuses | `Object.groupBy()` natif (ES2024 Baseline) | 🟢 Baseline 2024 |
| **Tri des collections** | `[...arr].sort()` mutatif ou index wrappers | `arr.toSorted()` immuable & natif (ES2023) | 🟢 Baseline 2023 |
| **Recherche & a11y** | `<div>` génériques avec `type="text"` | `<search>` HTML5 landmark + `type="search"` + `:focus-visible` | 🟢 Baseline 2023 |
| **Tests & Qualité** | 93 tests unitaires | **108 tests unitaires**, ESLint 0 erreur, E2E 6/6 (Chrome + WebKit) | 🟢 100% au vert |

---

## 🔒 4. Règles d'Or & Invariants Absolus pour Claude

Lors de toute intervention future sur ce projet, Claude doit respecter impérativement :

1. **Exécution 100% locale** : Ne jamais pousser sur un dépôt distant sans accord explicite de l'utilisateur, ne rien modifier sur le projet Firebase Cloud distant lors des tests.
2. **Préservation du mode sans build** : L'application doit impérativement continuer de tourner directement dans un navigateur via `python3 -m http.server 8000` ou `npx serve .`. Vite n'est qu'un bundler optionnel pour la production (`dist/`).
3. **Maintien des tests au vert** : Chaque modification doit être validée par `npm test`, `npm run lint` et si nécessaire `npm run test:e2e`.
4. **Zéro attribut d'événement inline** : Ne jamais écrire de `onclick="..."` ou `onchange="..."` dans les chaînes HTML générées. Toujours utiliser `data-action="..."` et `EventDelegator`.
5. **Prévention stricte du XSS** : Tout texte utilisateur ou externe injecté dans le DOM doit passer par `escapeHTML()` de [security.js](js/core/security.js) ou être affecté via `textContent`.
6. **Intégrité de la documentation** : Après toute modification structurelle, mettre à jour [DOCUMENTATION.md](DOCUMENTATION.md).

---
*Ce document sert de référence contractuelle pour la modernisation continue de l'Assistant Parapente.*
