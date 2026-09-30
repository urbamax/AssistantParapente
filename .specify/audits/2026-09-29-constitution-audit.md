# Constitution Audit — 2026-09-29

Audit of the existing codebase (`main` at `1130453`) against the
[constitution v1.0.0](../memory/constitution.md), as required by the Development Workflow
section ("existing code is not exempt").

**Method**: targeted reading and searches across `js/`, `index.html`, `components/`, `sw.js`,
`functions/`, `vite.config.mjs`, CI and tests; weather-scoring findings were confirmed by
executing `evaluateSpotForecast` with incomplete inputs. Baseline: 21 unit test files, 153 tests,
all passing.

**Not covered by this audit**: the content of the ~856 quiz questions and explanations
(accuracy, every-option justification, acronyms) is a separate, ongoing content audit; only the
mechanisms that display sources were checked here. Test-first discipline (Principle IV) cannot be
verified retroactively and applies from now on.

Each gap below is meant to become its own Spec Kit cycle (`/speckit-specify`). IDs are stable so
specs can reference them.

---

## Critical — pilot safety and data integrity

### A1. Missing weather values are silently turned into verdicts
Principles I, II.

- `js/weatherScoring.js` — when `windSpeed` is missing (`undefined`), both limit comparisons are
  false, the score becomes `NaN || 0`, and the site is returned **flyable** ("Passable (0/100)").
  Confirmed by execution.
- `js/services/sites_service.js:620-624` — hourly values are built with `Math.round(...)` and
  `?? 0` without checking for `null`: a missing gust becomes 0 km/h, so the gust check always
  passes; missing precipitation becomes 0 mm; a missing wind speed becomes 0 km/h and is shown
  as a real "Vent hors limites" verdict; a missing direction is shown as "Mauvaise orientation".
- `isDaytime` defaults to `true` when sunrise/sunset data is missing.
- Expected: any missing input yields an explicit "data unavailable" state, never a verdict.

### A2. Sites without orientation data are scored as perfectly oriented
Principle I.

- In `evaluateSpotForecast`, a site with no orientation skips the orientation check and gets
  `scoreOrientation = 100`: with good wind it is shown "Excellent (100/100)". Confirmed by
  execution. Unknown data is presented as the best case.

### A3. Server push notification announces "is flyable, favourable conditions now"
Principles II, I.

- `functions/index.js` sends `"<site> est volable !"` / `"conditions favorables maintenant"`:
  a verdict phrased as a go-ahead, with no reminder that the pilot decides and must check on
  site.
- It uses Open-Meteo's generic `forecast` endpoint, not the model the user selected in the app,
  so the notification can contradict what the app shows.
- It re-implements the scoring logic (same A1 flaws: `|| 0`, `?? 0`) and relies on a manual copy
  of `sites_data.json` (identical today, drift-prone).
- Deployment status unknown (requires the Blaze plan); to confirm with the owner.

### A4. No "your decision, check on site" reminder next to verdicts
Principle II.

- Verdicts appear as "Volable", "Excellent (x/100)", a pulsing green marker, and "Fiable" in the
  comparison table. The decision-support disclaimer exists only in the help/about text and the
  legal notice (`index.html` ~3011, ~2705), not where the verdict is shown.

### A5. The thunderstorm check (CAPE) is never active
Principles I, II.

- `evaluateSpotForecast` rejects CAPE > 1000 J/kg, but no Open-Meteo request asks for `cape`,
  so storm risk is never evaluated while the code (and possibly users) assume it is.

### A6. Forecast model, run time and model disagreement are not shown with verdicts
Principles I, II.

- No display of the forecast's issue/fetch time was found in the sites view; the model name only
  appears in the loading message.
- Model disagreement (`getModelAgreement`) is shown only in the favourites comparison table, not
  on the map, list or site sheet.

### A7. Site details are injected into the page without escaping
Principles VI, I.

- `js/views/sites.js` ~2040-2140 inserts `dangers`, `observations`, `restrictions`,
  `secours_acces`, `acces_topo`, `aerologie_ideale`, `reglementation`, `praticabilite`,
  `conventionnement`, `structure_gestionnaire` and `site.url` (lines 645, 1966) raw into HTML.
- Data comes from the FFVL snapshot and community data (ParaglidingEarth). 6 fields already
  contain HTML tags or a literal `<` (e.g. `<corniches`), which the browser swallows: part of the
  safety text is silently lost.

---

## High

### B1. The last forecast is not available offline
Principle V.

- The weather cache (`_weatherCache`) is an in-memory `Map`, and `sw.js` sends Open-Meteo
  requests straight to the network. Offline, no forecast is shown at all.

### B2. Opened courses are not guaranteed offline
Principle V.

- `courses/` is in `NOT_PRECACHED` (`vite.config.mjs`) and `sw.js` deliberately bypasses PDFs;
  offline availability depends on the browser's HTTP cache only.
- Map tiles (ArcGIS) are not cached either: the map is empty offline (site list and sheets
  still load from the precached `sites_data.json`).

### B3. Most quiz questions have no verified source
Principle III.

- `question_course_mapping.json` has 824 entries, of which 332 carry a hand-verified
  `verifiedPage`; about 856 questions exist. The display mechanism is compliant (only
  `verifiedPage` is used as a citation, `quiz_service.js:193`), but ~60 % of explanations have no
  verified source and nothing tells the user so.
- Official FFVL/DGAC documents (now admissible) are not yet used as sources.

### B4. Test gaps
Principle IV.

- End-to-end tests (Playwright, 3 specs: sites, offline logbook, GDPR) are not run in CI.
- No unit test imports: `core/security.js`, `core/events.js`, `core/router.js`,
  `core/base_view.js`, `gdpr_engine.js`, `utils/array_utils.js`, `utils/text_utils.js`,
  `utils/math_utils.js`, `components/map_3d.js`; `views/quiz.js` and `views/sites.js` are
  covered only partially through e2e.
- User-visible flows without an e2e test include the quiz/exam flow, the library and IGC import.

---

## Medium

### C1. Firebase SDK cannot carry SRI
Principle VI. `firebase_service.js` loads the SDK with dynamic `import()` from `gstatic.com`,
which does not support `integrity`. Options: self-host the SDK files, or amend the rule.

**Status (2026-09-30): fixed by spec 013.** The SDK 12.19.0 is hosted under `vendor/firebase-12.19.0/`;
`tests/core/firebase_sdk.test.js` checks every file against the official SHA-384. The same spec
removed the service worker's pre-consent `importScripts` from `gstatic.com`.

### C2. Footer links without `noopener`
Principle VI. 5 `target="_blank"` links in `components/footer.html` lack
`rel="noopener noreferrer"`.

### C3. Third-party requests without consent
Principle VI.

- Google Fonts is loaded at start-up (sends the visitor's IP to Google) and the footer loads
  logos from `wordpress.com` and `ffvl.fr`, before any consent.
- Windy, Météo-Parapente, Paraglidable, ParaglidingEarth and SpotAir iframes load on user click
  without a consent notice (third-party cookies possible).

### C4. Leftover Analytics identifier
Principle VI. `js/firebase_config.js` holds a `measurementId` (Google Analytics). Analytics is not
loaded today; removing the ID prevents accidental activation.

### C5. Scoring logic reads storage directly
Principle VIII. `weatherScoring.js` reads `localStorage` (`tp_equipment_data`) inside the pure
scoring function; equipment should be passed in by the service.

### C6. Quiz text inserted as raw HTML
Principle VI. `quiz.js:1572` and the question list insert `explication` / question text through
`innerHTML` without escaping. The data is bundled, so risk is low, but the rule has no exception.

### C7. Keyboard access
Devices and accessibility constraint. 23 elements carry `data-action` on non-focusable tags
(`div`, `span`, `a` without `href`, etc.) without `tabindex`/`role="button"`: not operable with
a keyboard.

### C8. No centralised UI strings module
Language constraint. Required for new or reworked features; does not exist yet.

**Status (2026-09-30): in progress.** The module exists (`js/i18n/fr.js`, `t()`, since spec 001). Screens migrate one per feature: logbook done (spec 014), sites done (spec 015), with a shared guard test; next: quiz, safety, account, static `index.html`.

### C9. Outdated `DOCUMENTATION.md`
Governance. It says `npm run typecheck` is not in CI and cannot reach 0 errors (false since
`dc3324a`), references `js/data/sites_data.js` (now `.json`) and debugging scripts that no longer
exist (`debug_sites.js`, `test_logbook.js`, `test_scoring.js`).

---

## Compliant areas (spot-checked)

- Layering: no `fetch` in views, no `localStorage` in views, every view extends `BaseView`.
- No inline event handlers; no `import.meta.env` or bare module imports.
- All `window.open` calls use `noopener,noreferrer`; Leaflet, Remix Icon and the lazily loaded
  3D engine scripts carry SRI.
- Firebase is loaded only after GDPR consent; no analytics is loaded.
- Course links use hand-verified pages only.
- Runtime-fetched data files are listed in `STATIC_PATHS`; `sites_data.json` is precached.
- CI runs lint, format check, typecheck, unit tests and build.

## Suggested order

1. A1 + A2 + A5 (one spec: "honest handling of missing and unknown weather data")
2. A4 + A6 (one spec: "verdict presentation: opinion, uncertainty, source and time")
3. A3 (decide: rewrite or disable the push notification)
4. A7 + C6 (escaping of site and quiz data, fix the 6 damaged entries)
5. B1 + B2 (offline forecast and courses)
6. B4 (e2e in CI, missing unit tests)
7. B3 (quiz sourcing — long-running content work)
8. C1–C5, C7–C9
