# 🪂 Assistant Parapente - Technical Architecture & Developer Guide

Welcome to the official technical documentation for **Assistant Parapente** (v4.6+).  
This document serves as the **Single Source of Truth** for both human software engineers and AI coding agents (Google Antigravity, Claude, ChatGPT, Cursor, etc.).

---

## 📌 Executive Summary & Architecture Overview

Assistant Parapente is a modern, responsive single-page web application (SPA) designed for paragliding pilots. It provides four major feature domains:
1. **Sites & Weather Scoring**: Real-time flyability scoring based on weather models (AROME / GFS), interactive 2D (Leaflet) and 3D (MapLibre GL) maps, wind limits, and SpotAir vector icons.
2. **Flight Logbook (Carnet de Vol)**: Flight logging, equipment & wing maintenance tracking, and native **IGC file parsing** for 3D/2D flight trace rendering and stats extraction.
3. **FFVL Theory & QCM**: Complete FFVL theoretical exam preparation (Initial, Pilot, Confirmed Pilot) with Training, Exam, and Revision modes, spaced repetition algorithms, and performance analytics.
4. **Library & Manual**: Official PDF course reader and contextual flight manual.

### Core Architecture Principles
- **Native ES6 Modules**: Zero build step required! Everything runs natively in modern browsers via standard `import` / `export` syntax.
- **Unidirectional Reactive State**: `AppState` (`js/core/app_state.js`) provides a publish/subscribe pattern for global settings (theme, level, active route, network state).
- **Declarative Event Delegation**: Eliminates inline HTML event attributes (`onclick=...`). Interactivity uses HTML data attributes `data-action="..."` and `data-args="..."` dispatched via `EventDelegator` (`js/core/events.js`).
- **Service & View Separation**: UI views (`js/views/`) strictly handle DOM rendering and user interactions, delegating state management, data processing, and external APIs to stateless services (`js/services/`).
- **Offline-First & Hybrid Storage**: High-capacity persistent offline storage via native `IndexedDB` (`IDBStorageService`) for heavy datasets (IGC flight traces and telemetry) alongside `LocalStorage` (`StorageService`) for instant synchronous preferences, automatically syncing with Cloud Firestore when user signs in (`FirebaseService`).
- **Security Policy (XSS & Tabnabbing Prevention)**: To prevent Cross-Site Scripting, the usage of raw `innerHTML` with unsanitized user or external data is **strictly forbidden**. All dynamic injections must either use `document.createElement()` + `textContent` or wrap variables in `escapeHTML()` (from `js/core/security.js`). Furthermore, all external targets (`target="_blank"` and `window.open`) strictly enforce `rel="noopener noreferrer"` to prevent Reverse Tabnabbing.

---

## 📂 Project Directory Structure

```
AssistantParapente/
├── index.html                  # Single Page Application Entrypoint
├── README.md                   # Quickstart Guide & Architecture Pointer
├── DOCUMENTATION.md            # This Master Documentation File
├── ideas_roadmap.md            # R&D, SpotAir SVG API & 3D Trace Roadmap
├── components/                 # Injected HTML Shared Components
│   ├── header.html             # Top Navigation, Level Selector, Theme Toggle
│   └── footer.html             # Footer links & copyright
├── css/                        # Modular Vanilla CSS Files
│   ├── base.css                # CSS variables, typography, dark/light theme tokens
│   ├── components.css          # Shared buttons, badges, modals, cards
│   ├── header.css              # Header, level selector & theme button styles
│   ├── footer.css              # Footer layouts
│   ├── sites.css               # Sites list, weather filters & map overlays
│   ├── logbook.css             # Flight logbook forms, tables & stats cards
│   ├── quiz.css                # QCM exam UI, option cards & timer
│   ├── library.css             # PDF manual viewer & course cards
│   ├── auth.css                # Firebase Login/Signup modal
│   └── gdpr.css                # GDPR consent drawer & privacy options
├── js/
│   ├── core/                   # Framework Core Engines
│   │   ├── main.js             # Boot Sequence & Module Wiring
│   │   ├── app_state.js        # Reactive State Management (Pub/Sub)
│   │   ├── router.js           # Client-side Router & History API
│   │   ├── events.js           # Event Delegator (data-action handlers)
│   │   └── ui_manager.js       # Component injection & Theme Manager
│   ├── views/                  # Screen Controllers & UI Renderers
│   │   ├── sites.js            # Sites view controller
│   │   ├── logbook.js          # Logbook & IGC viewer controller
│   │   ├── quiz.js             # QCM & exam controller
│   │   └── manual.js           # Library & course viewer controller
│   ├── services/               # Data & Business Logic Layer
│   │   ├── sites_service.js    # Sites filtering, Open-Meteo weather fetch & limits
│   │   ├── logbook_service.js  # Flight records CRUD & wing maintenance calculations
│   │   ├── quiz_service.js     # Question randomization, scoring & streak tracking
│   │   ├── firebase_service.js # Authentication & Cloud Firestore synchronization
│   │   ├── igc_parser.js       # Native IGC GPS file parser (B-records, vario, stats)
│   │   ├── storage.js          # LocalStorage wrapper & fallback keys
│   │   └── idb_storage.js      # Native IndexedDB wrapper for heavy flights & IGC traces
│   ├── components/
│   │   └── map_3d.js           # MapLibre GL 3D terrain viewer & line extrusion
│   ├── i18n/fr.js              # French UI strings catalogue (read via js/utils/i18n.js t())
│   ├── data/                   # Static Datasets & Configs
│   │   ├── sites_data.json     # French paragliding takeoffs & landings database
│   │   ├── courses_data.js     # Theoretical courses catalog & metadata
│   │   ├── weather_config.js   # Wind directions, thresholds & weather model definitions
│   │   ├── equipment_config.js # Wing & harness default parameters
│   │   ├── qcm_ffvl.csv        # Raw FFVL QCM database
│   │   ├── qcm_ffvl_explanations.csv # Question explanations data
│   │   └── question_course_mapping.json # Mapping between QCM questions and courses
│   ├── weatherScoring.js       # Flyability scoring engine (AROME/GFS, gust & direction)
│   └── gdpr_engine.js          # GDPR consent logic
└── courses/                    # Course PDF Documents categorized by level
    ├── BREVET INITIAL - VERT/
    ├── BREVET DE PILOTE - BLEU/
    ├── BREVET DE PILOTE CONFIRMÉ - MARRON/
    └── GENERAL/
```

---

## ⚡ Core Architecture & Execution Flow

### 1. Boot Sequence (`js/core/main.js`)
When the DOM triggers `DOMContentLoaded`, `bootApplication()` executes the following sequence:

```mermaid
sequenceDiagram
    autonumber
    participant Browser
    participant Main as main.js
    participant State as AppState
    participant Events as EventDelegator
    participant UI as UIManager
    participant Router as AppRouter

    Browser->>Main: DOMContentLoaded
    Main->>State: GlobalState.init()
    Main->>Events: AppEvents.init()
    Main->>UI: UIManager.init()
    UI->>Browser: fetch(header.html & footer.html)
    Main->>Events: Register action handlers (navigate, QCM, Logbook, Sites, Auth)
    Main->>Router: AppRouter.register(routes) & initHistory()
    Main->>Router: AppRouter.navigate(LAST_ACTIVE_ROUTE || 'LIBRARY')
```

### 2. Reactive State Management (`js/core/app_state.js`)
`GlobalState` maintains global application variables and notifies subscribers on mutation:

```javascript
import GlobalState from './core/app_state.js';

// Subscribe to state changes
const unsubscribe = GlobalState.subscribe('level', (newLevel) => {
    console.log('User pilot level updated to:', newLevel); // 'BI', 'BP', 'BPC', or 'ALL'
});

// Update state value
GlobalState.set('level', 'BP');
```

**Global State Properties**:
- `level`: Active FFVL Pilot Level filter (`'BI'` (Vert), `'BP'` (Bleu), `'BPC'` (Marron), `'ALL'` (Slate)).
- `mode`: Current active route (`'SITES'`, `'LOGBOOK'`, `'QCM'`, `'QCM_BANK'`, `'STATS'`, `'LIBRARY'`, `'MENU'`).
- `themeMode`: Dark mode policy (`'auto'`, `'light'`, `'dark'`).
- `isOnline`: Boolean tracking browser connectivity (`navigator.onLine`).

### 3. Declarative Event Delegation (`js/core/events.js`)
Instead of binding inline listeners, interactive elements use HTML attributes:
```html
<button data-action="navigate" data-args="SITES">Voir les sites</button>
<button data-action="setQcmMode" data-args="'EXAM'">Mode Examen</button>
```

`EventDelegator` listens globally to `click` and `change` events on `document`:
1. Inspects `e.target.closest('[data-action]')`.
2. Parses `data-args` (JSON or string).
3. Dispatches to registered handlers in `AppEvents` or falls back to view engine methods.

### 4. Router & Screen Lifecycles (`js/core/router.js`)
`AppRouter` manages SPA screen transitions and maintains browser history (`window.history.pushState`).

Each view implementation inherits from `BaseView` (`js/core/base_view.js`) which enforces a standard lifecycle interface and provides built-in UI fallback methods for error handling (e.g. `super.renderErrorState(msg)`):
```javascript
import BaseView from '../core/base_view.js';

class MyView extends BaseView {
    async mount(params) {
        await super.mount(params);
        // Render UI, fetch remote/local data, bind view-specific observers
    }
    
    async unmount() {
        await super.unmount();
        // Clean up map instances, interval timers, chart objects
    }
}

const instance = new MyView();
export default instance;
```

---

### 5. Utilities & Shared Logic (`js/utils/`)
To maintain the DRY (Don't Repeat Yourself) principle, all reusable domain-agnostic logic must be extracted into pure functions within the `js/utils/` directory.
- `date_utils.js`: Date, time, and duration formatting (`formatDateTime`, `formatDuration`).
- `math_utils.js`: Mathematical functions (e.g., rounding `roundToDecimals`, percentages).
- `geo_utils.js`: Geographic and trigonometric calculations (Haversine distance, angle normalizations, cardinal conversions).
- `i18n.js`: `t(key, params)` reads the French strings catalogue `js/i18n/fr.js`.
- `text_utils.js`: Text manipulation and sanitization. *(Planned)*

Views and services must import these utilities rather than duplicating logic.

---

## 🌤️ Sites & Weather Scoring Engine

### 1. Flyability Scoring Algorithm (`js/weatherScoring.js`)
`evaluateSpotForecast(site, weather, prefs)` is a **pure** function (no DOM, no storage — the
pilot's wings are passed in `prefs.wings`) shared with the notification Cloud Function. Contract:
`specs/001-honest-missing-weather/contracts/evaluation.md`. It returns
`{ status, flyable, reasonCode, reason, missing, orientationUnknown, score, class, icon, warning }`
where `status` is `'loading' | 'incomplete' | 'unflyable' | 'flyable'` (authoritative; `flyable`
is kept for compatibility). Views choose colours from `status` / `reasonCode`, never from the
French `reason` text.

Evaluation order:
1. **No forecast** → `loading`.
2. **Missing data → no verdict** (`incomplete`): if any required value is absent or invalid
   (`normalizeForecastValue`: `null`, non-numeric, non-finite, negative, direction outside
   0–360°), the hour gets no verdict and `missing` lists every missing value. Required values:
   mean wind, gusts, precipitation, CAPE, daylight, plus wind direction when the site's
   orientation is known. **A missing value is never replaced by a default** (0 km/h, 0 mm,
   daytime). With the default AROME model every hour beyond ~108 h is empty and shows
   « Prévision incomplète ».
3. **Kill switches** (`unflyable`): night (legal flying time = sunrise−30 min to sunset−30 min),
   rain (> 0 mm), mean wind outside `vMin`/`vMax` (or outside every wing's range in equipment
   mode), gust delta above `deltaRafaleMax`, **thunderstorm risk** when CAPE >
   `STORM_CAPE_THRESHOLD` (1000 J/kg — source: FFVL, Commissions Nationales Sécurité et
   Technique, « Canicule, vague de chaleur et vol libre », 2026-07-31; a reference value, not a
   regulatory limit), wind direction not in the site's orientations.
4. **Unknown take-off orientation** (`getSiteOrientations` finds none of N, NE, E, SE, S, SO, O,
   NO): `flyable` with `orientationUnknown: true`, **no score**, and the notice « Orientation du
   décollage inconnue : à vérifier » (yellow, no pulse). Unknown data is never scored as ideal.
5. **Score** (0–100, unchanged): 50 % wind speed (distance to the middle of the pilot's range),
   50 % orientation (distance to `orientation_ideale_deg`), rated Excellent / Bon / Passable.

Every display of a verdict (map popup, site card, favourites comparison table) carries the
reminder « Avis basé sur des prévisions, risque d'orage estimé : la décision vous appartient,
vérifiez sur place. » (constitution, Principle II). Incomplete hours are excluded from flyable
hours, slots and consecutive counts (and not counted as unflyable); a site with no complete hour
shows « Aucune prévision fiable pour ce site ».

### 2. Forecast API Integration (`js/services/sites_service.js`)
Sites service fetches open-access meteorological data from **Open-Meteo API**:
- Hourly variables requested: `wind_speed_10m, wind_direction_10m, wind_gusts_10m, precipitation, cape`; values are validated with `normalizeForecastValue` when parsed (missing stays `null`).
- **AROME (Météo-France)**: High-resolution short-range forecast (Open-Meteo `meteofrance` endpoint; empty beyond ~108 h, shown as incomplete).
- **GFS / ICON**: Medium-range forecast (up to 7 days).

### 3. Interactive Cartography (2D & 3D)
- **2D Map**: Built on Leaflet.js with custom markers and SpotAir SVG federal vector icons.
- **3D Map & Flight Replay** (`js/components/map_3d.js`): Renders 3D terrain and true-altitude flight traces via MapLibre GL JS and deck.gl (`PathLayer`). To optimize performance, the ~2.4 MB 3D engine is **lazily loaded on demand** upon clicking "Afficher la trace 3D", saving bandwidth and boot time for regular users.

### 4. Service Encapsulation & Lookup (`SitesService`)
- Sites catalog is accessed via `SitesService.getSites()`.
- `SitesService.getSiteById(id)` provides constant-time $\mathcal{O}(1)$ resolution through an internal cached `Map`.

---

## 🪂 Flight Logbook & IGC Parser

### 1. Native IGC GPS Parser (`js/services/igc_parser.js`)
Processes binary `.igc` GPS log files strictly on the client side without server uploading.

**Extracted Parameters**:
- `date` & `flightDuration`: Date and start/end time.
- `maxAltitude` & `minAltitude`: Extracted from B-records (`B1102324545678N00612345EA0123401450`).
- `maxVario` & `minVario`: Calculated via temporal derivative of pressure altitude ($\frac{\Delta z}{\Delta t}$).
- `gpsTrack`: Normalized array of `{ lat, lon, alt, timestamp, vario }` for 2D/3D map playback.

### 2. Wing & Equipment Hours Tracking (`js/services/logbook_service.js`)
Every logged flight automatically increments the total airtime (hours & minutes) of the associated wing and harness, triggering visual alerts when equipment passes maintenance thresholds (e.g., 100h inspection alert).

---

## 📚 FFVL Theory & QCM Engine

### 1. Modes of Operation (`js/services/quiz_service.js`)
- **Training Mode**: Instant correction per question, selection by category/theme (Météo, Aérologie, Réglementation, Pilotage, Matériel).
- **Exam Mode**: 60 random questions selected across all subjects according to official FFVL weighting. Includes a strict 60-minute countdown timer.
- **Revision Mode**: Focuses specifically on questions previously answered incorrectly by the user.

### 2. Service Encapsulation & Indexing (`QuizService`)
- **Data Encapsulation**: Questions are encapsulated within `QuizService` and accessed via `getQuestions()`, `getThemes()`, and `getQuestionsByTheme()` (using `Object.groupBy` Baseline 2024).
- **Fast Lookup**: `getQuestionByCode(code)` maintains an internal `Map` for $\mathcal{O}(1)$ resolution by code or id.
- **Backwards Compatibility**: `window.QCM_OFFICIAL` is mirrored for external tools and debugging console access.

### 3. Scoring & Progression Analytics
Calculates overall success percentage, subject mastery radar, active day streak, and logs exam history locally and in Cloud Firestore.

---

## 🔐 Firebase Authentication & Cloud Sync

### 1. Hybrid Storage Strategy (`js/services/firebase_service.js`)
- **Offline Mode (Guest)**: Data is immediately written to `LocalStorage` using `StorageService`.
- **Authenticated Mode**: Automatically merges local data with Cloud Firestore (`users/{uid}/data`). Supports Google Auth and Email/Password sign-in.

---

## 🛡️ Resilience & Error Handling

To ensure the application never fails silently ("Silent Failure"), we enforce a strict standard for asynchronous operations and UI fallbacks:

### 1. Standardized Async Responses
All asynchronous methods in critical services (`firebase_service.js`, `logbook_service.js`, `quiz_service.js`) MUST return a standardized response object instead of throwing unhandled exceptions or returning mixed types:
```javascript
{ success: boolean, data: any, error: string | null }
```

### 2. UI Fallbacks (Error States)
Views (`js/views/`) must check the `success` flag when mounting or fetching data. If `success === false`, the view must not render a broken or empty state. Instead, it must call a dedicated `renderErrorState(errorMsg)` method to display a user-friendly error block with a "Réessayer" (Retry) action.

### 3. Global Router Protection
The `AppRouter` (`js/core/router.js`) protects the global application lifecycle by wrapping the `view.mount()` calls in a `try/catch` block. If a view crashes completely during initialization, the router catches the fatal error and injects a fallback "Crash Critique" interface to prevent a white screen.

---

## 🎨 Design System & Theme Engine

### 1. Color Palette Tokens (`css/base.css`)
The application dynamically adapts main visual accents based on the selected FFVL pilot level:

| Pilot Level | Accent Color | Variable | Visual Meaning |
| :--- | :--- | :--- | :--- |
| **BI** (Brevet Initial) | `#22c55e` | Emerald Green | Novice / Beginner |
| **BP** (Brevet de Pilote) | `#0ea5e9` | Sky Blue | Autonomous Pilot |
| **BPC** (Pilote Confirmé) | `#8B4513` | Saddle Brown | Advanced / Cross-Country |
| **ALL** (Tous Niveaux) | `#64748b` | Slate Gray | Neutral / All Levels |

### 2. Theme Switching Engine (`js/core/ui_manager.js`)
Supports three theme modes:
- `light`: Explicit light theme.
- `dark`: Explicit dark theme.
- `auto`: Automatically synchronizes with system preference via `window.matchMedia('(prefers-color-scheme: dark)')`.

---

## 🤖 Guidelines for AI Coding Agents & Human Developers

When modifying or expanding the codebase, follow these rules strictly:

### 1. Preserving Architecture Rules
- **The source must stay runnable without a build**: the app is native ES modules served as-is by any static server (`python3 -m http.server` or `npx serve`). Vite (`npm run build`) is only used to produce an optimized `dist/`; never make the source depend on Vite-only features (no `import.meta.env`, no bare-module imports, no Vite plugins that change semantics).
- **Runtime-fetched files** (`components/`, `courses/`, `img/`, `manifest.json`, `js/firebase_config.js`, the `js/data` JSON/CSV) are not in the import graph: if you add a new one, list it in `STATIC_PATHS` in `vite.config.mjs` so it is copied into `dist/`.
- **Maintain ES6 Imports**: Always specify file extensions in import statements (e.g., `import GlobalState from './app_state.js';`).
- **Use Event Delegation**: Never write inline event handlers in rendered HTML strings (e.g. avoid `onclick="doSomething()"`). Use `data-action="doSomething"` and `data-args="..."`.
- **Modern JavaScript Idioms (ES2023 / ES2024 Baseline)**:
  - Prefer immutable array sorting via `toSorted(array, compareFn)` from `js/utils/array_utils.js` instead of mutative `[...array].sort(...)`. Never call the native `array.toSorted(...)` directly: it throws on Safari < 16 / Chrome < 110 / Firefox < 115, and this helper is the feature-detected fallback for it (same reasoning as the `Object.groupBy` fallback below).
  - Prefer declarative grouping via `Object.groupBy(items, fn)` (with fallback) over manual accumulator loops.
  - Wrap search inputs in semantic HTML5 `<search role="search">` containers and use `type="search"`.

### JS type checking
`npm run typecheck` runs plain TypeScript's `checkJs` over `js/**/*.js` (config: `jsconfig.json`, ambient types for CDN globals in `types/`). It is part of CI and must stay at **0 errors**. Use JSDoc (`/** @type {HTMLInputElement} */`) casts for DOM reads. `sw.js` is excluded (service worker globals need a different `lib` set than the rest of the app, which targets the browser DOM).

### UI strings
User-facing text of new or reworked features lives in `js/i18n/fr.js` (frozen catalogue) and is read with `t('section.key', { placeholder })` from `js/utils/i18n.js` — never hard-coded in views (constitution, Language constraint). Existing screens migrate when they are touched.

### Code shared with the notification Cloud Function
Firebase deploys `functions/` alone, so it cannot import `js/`. `scripts/sync_functions_shared.mjs` copies `js/weatherScoring.js` and its imports into `functions/shared/*.mjs` (imports rewritten) and `js/data/sites_data.json` into `functions/`. It runs as a `predeploy` hook (`firebase.json`) and via `npm run sync:functions`; `tests/functions/shared_copy.test.js` fails in CI if a copy is stale. Never edit `functions/shared/` by hand. Server-only helpers (hour selection, notification rule) live in `functions/evaluate.mjs`.

### 2. Event Handler Registration Rule
When creating new interactive actions in views, register them in `main.js`:
```javascript
AppEvents.register('myCustomAction', (args, event, target) => {
    MyViewModule.handleCustomAction(args);
});
```

### 3. File Creation Protocol
- New views belong in `js/views/<name>.js`.
- New business logic/APIs belong in `js/services/<name>.js`.
- New CSS files must be imported in `index.html` head section.

---

## 🔍 Verification & Debugging Toolkit

Automated checks (all run in CI except end-to-end, which must be run locally before merging):
```bash
npm run lint && npm run format:check && npm run typecheck
npm test            # Vitest unit tests (tests/**, happy-dom; tests/functions/** run under node)
npm run test:e2e    # Playwright (tests/e2e/**) — mocks Open-Meteo, blocks the service worker
npm run build
```
Shared test data for the weather scoring lives in `tests/fixtures/forecasts.js` (including 96
reference cases recorded before spec 001: complete-data verdicts must never change).

To run a local server for testing:
```bash
python3 -m http.server 8000
# Open http://localhost:8000 in browser
```

To produce an optimized build (hashed and minified JS/CSS, versioned service worker):
```bash
npm run build      # outputs dist/
npm run preview    # serves dist/ locally
```
The build rewrites `sw.js` into `dist/sw.js`: the precache list is generated from the emitted files and `CACHE_NAME` is derived from their names, so no manual `bump.py` is needed for a `dist/` deployment.

---

*Documentation maintained for Assistant Parapente project.*
