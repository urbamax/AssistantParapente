---
description: "Task list for forecast context next to every verdict"
---

# Tasks: Forecast Context Next to Every Verdict

**Input**: Design documents from `specs/002-verdict-forecast-context/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/ui-context.md](contracts/ui-context.md),
[quickstart.md](quickstart.md)

**Tests**: REQUIRED (constitution Principle IV, test-first): every test task is written first
and MUST be run and seen failing before the implementation tasks of its phase.

**Organization**: by user story. US4 (bounded requests) is implemented first because it protects
the provider quota that US3 uses more (plan.md, Implementation Phases).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US4 from spec.md

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 [P] In `js/data/weather_config.js`, add and export: `DEFAULT_LOCATION = Object.freeze({ lat: 50.7264, lng: 1.6147, name: 'Boulogne-sur-Mer', isDefault: true })`; `RADIUS = Object.freeze({ MIN: 10, MAX: 200, DEFAULT: 50, STEP: 10, LEGACY_UNLIMITED: 210 })`; `STALE_AFTER_MS = 3 * 60 * 60 * 1000`; `WEATHER_MODEL_INFO` keyed by `meteofrance`, `iconeu`, `icon`, `ecmwf`, `gfs`, `best_match` with `{ labelKey, metaModel, runLabel }` exactly as in research.md R3 (`meteofrance_arome_france_hd`/« AROME », `dwd_icon_eu`/« ICON-EU », `dwd_icon`/« ICON », `ecmwf_ifs025`/« ECMWF », `ncep_gfs025`/« GFS », `best_match` → `metaModel: null`)
- [X] T002 [P] In `js/i18n/fr.js`, add a `forecast` section: model labels (« AROME (Météo-France) », « ICON-EU (DWD) », « ICON (DWD, global) », « ECMWF (IFS) », « GFS (NOAA) », « Sélection automatique (Open-Meteo, multi-modèles) »), context line « {model} · récupérée à {time} », run part « run {component} de {hour} », day prefixes (« hier », weekday abbreviations), stale text « Prévision récupérée il y a {age} — peut être dépassée », « Actualiser », « Actualisation impossible : {reason} », agreement texts (« {model} d'accord », « {model} n'est pas d'accord : {verdict} », « Comparaison {model} indisponible »), default-location notice « Recherche centrée sur Boulogne-sur-Mer — activez le GPS ou saisissez une adresse. », radius label « {km} km »
- [X] T003 [P] In `tests/fixtures/forecasts.js`, add `metaJson({ runAtS, updateIntervalS })` (Open-Meteo `static/meta.json` shape with `last_run_initialisation_time` and `update_interval_seconds`), `SITES_AROUND_BOULOGNE` (3 sites < 50 km, 2 sites 60–150 km, 1 site > 200 km from 50.7264/1.6147, with real-looking coordinates), and `twoModelHours({ agreeAt, disagreeAt, incompleteAt, length })` returning aligned primary/secondary hour arrays

**Checkpoint**: modules import cleanly; `npm test` still green.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T004 Write tests in `tests/services/site_prefs_migration.test.js` for `migrateSitePrefs(prefs)` (pure, exported from `js/services/sites_service.js`): `radiusLimit` missing, `210`, `500` → `50`; `120` unchanged; `5` → `10`; `weatherModel: 'meteoblue'` → `'best_match'`; other keys untouched; input object not mutated; and `FirebaseAuthEngine.getLocalPreferences()` (`js/services/firebase_service.js`) returns a migrated radius/model when LocalStorage holds `radiusLimit: 210` / `weatherModel: 'meteoblue'`
- [X] T005 Run `npx vitest run tests/services/site_prefs_migration.test.js`; confirm it fails
- [X] T006 Implement and export `migrateSitePrefs` in `js/services/sites_service.js` using `RADIUS` from `js/data/weather_config.js`; apply it to `prefs` before the `PREFERENCE_KEYS` loop (around line 191); change the state defaults `radiusLimit: 210` (lines ~48 and ~81) to `RADIUS.DEFAULT`
- [X] T007 In `js/services/firebase_service.js` (defaults around line 1350), set `radiusLimit: 50`, and apply the same migration (import `migrateSitePrefs`) to local and merged cloud preferences before they are returned
- [X] T008 Run `npx vitest run tests/services/site_prefs_migration.test.js tests/services/sites_service.test.js`; all pass

**Checkpoint**: saved « Illimité » radii and « meteoblue » models are migrated on load.

---

## Phase 3: User Story 4 - Weather only for sites around the pilot (Priority: P1) 🎯 MVP

**Goal**: default 50 km, max 200 km, Boulogne-sur-Mer when no position, favourites always kept, weather requested only for that set (FR-014–FR-018).

**Independent Test**: fresh profile without GPS → ~21 sites around Boulogne-sur-Mer requested, notice shown, slider stops at 200 km (SC-008).

### Tests for User Story 4 ⚠️ write first, see them fail

- [X] T009 [P] [US4] In `tests/services/sites_service.test.js` (with `SITES_AROUND_BOULOGNE`): `getEffectiveLocation()` returns `DEFAULT_LOCATION` when `userLocation` is null and the user location otherwise; `getGeoFilteredSites` with no user location keeps only sites ≤ 50 km of Boulogne-sur-Mer; with radius 200 keeps ≤ 200 km; always keeps favourite sites beyond the radius; `fetchWeatherForSites` request URLs contain exactly the coordinates of that set (count latitudes)
- [X] T010 [P] [US4] In `tests/views/sites_verdict.test.js`: with `userLocation` null, the sites view renders the default-location notice text; with a GPS location it does not; radius label shows « 200 km » at 200 and never « Illimité »; `SitesService.countSearchMatchesOutsideRadius()` > 0 renders « {n} sites correspondent hors du rayon de {km} km » (FR-019)
- [X] T011 [US4] In `tests/e2e/sites_flow.spec.js`: new scenario (service worker blocked, Open-Meteo mocked, geolocation permission not granted): the notice « Recherche centrée sur Boulogne-sur-Mer » is visible; `#radius-slider` has `max="200"` and value `50`; the number of latitudes in the first Open-Meteo request equals the number of sites ≤ 50 km of Boulogne-sur-Mer plus favourites; after typing an address in the location search (mock the geocoding request) the notice disappears
- [X] T012 [US4] Run `npx vitest run tests/services/sites_service.test.js tests/views/sites_verdict.test.js` and `npx playwright test tests/e2e/sites_flow.spec.js --project=chromium`; confirm T009–T011 fail

### Implementation for User Story 4

- [X] T013 [US4] In `js/services/sites_service.js`: add `getEffectiveLocation()` (`userLocation` or `DEFAULT_LOCATION`); in `getGeoFilteredSites` (around line 813) always compute distances from the effective location and apply `radiusLimit`, remove the `< 210` condition, and keep sites whose id is in `userPreferences.favoriteSites` regardless of distance; `setRadiusLimit` (around line 1027) clamps to `RADIUS.MIN`–`RADIUS.MAX`; add `countSearchMatchesOutsideRadius()` (sites matching the active search query but beyond the radius, never fetched) for FR-019
- [X] T014 [US4] In `index.html` (`#radius-slider`, around line 1017): `min="10" max="200" value="50" step="10"`; initial label « 50 km »
- [X] T015 [US4] In `js/views/sites.js` (around line 379): radius label always `t('forecast.radiusKm', { km })` (remove the `=== 210 ? 'Illimité'` branch); render the default-location notice (element `#default-location-notice`, `textContent`) near the radius control when `getEffectiveLocation().isDefault`, hide it after a GPS fix (around line 324) or a geocoded/saved location is set
- [X] T016 [US4] Run `npm test` and `npx playwright test tests/e2e/sites_flow.spec.js --project=chromium`; T009–T011 pass, all previous tests still pass

**Checkpoint**: request volume bounded; demonstrable alone.

---

## Phase 4: User Story 1 - Know which model and how old (Priority: P1)

**Goal**: every verdict display shows model, retrieval time and run time when known (FR-001–FR-004, FR-008).

**Independent Test**: each model → context line on popup, card and comparison table; run time only when metadata exists (SC-001, SC-002, SC-006).

### Tests for User Story 1 ⚠️ write first, see them fail

- [X] T017 [P] [US1] In `tests/services/sites_service.test.js`: after `fetchWeatherForSites`, `state.forecastProvenance[siteId]` = `{ modelKey, fetchedAt, runAt }`; a second call within the 10-min cache keeps the **original** `fetchedAt` (mock `Date.now`); `fetchModelRunTime(modelKey)` requests `https://api.open-meteo.com/data/{metaModel}/static/meta.json` and returns `last_run_initialisation_time * 1000`, returns `null` for `best_match` without any request, returns `null` on HTTP error, and is cached 30 min
- [X] T018 [P] [US1] In `tests/services/sites_service.test.js`: `_resolveModelEndpoint('best_match')` returns the `forecast` endpoint; `'meteoblue'` is no longer a key
- [X] T019 [P] [US1] In `tests/views/sites_verdict.test.js`: `formatForecastContext(provenance, now)` → « AROME (Météo-France) · récupérée à 14 h 05 · run AROME de 08 h » (local time); without `runAt` no « run »; day prefix « hier » for yesterday; `buildWeatherPopupHtml`, the site card weather block and `renderComparator` contain the context line once
- [X] T020 [US1] In `tests/e2e/sites_flow.spec.js`: mock `**/static/meta.json` too; the expanded AUTEUIL card shows « AROME (Météo-France) » and « récupérée à »; selecting the « Sélection automatique » option shows no « run »
- [X] T021 [US1] Run `npx vitest run tests/services/sites_service.test.js tests/views/sites_verdict.test.js` and `npx playwright test tests/e2e/sites_flow.spec.js --project=chromium`; confirm T017–T020 fail

### Implementation for User Story 1

- [X] T022 [US1] In `js/services/sites_service.js`: rename the `meteoblue` key to `best_match` in `_resolveModelEndpoint`; record `forecastProvenance[site.id] = { modelKey, fetchedAt: <chunk cache timestamp>, runAt }` in `fetchWeatherForSites` (use the cache entry's `timestamp`, never `Date.now()` on a cache hit); add `fetchModelRunTime(modelKey)` (fetch `static/meta.json`, 30-min cache, errors → `null`, no request when `metaModel` is null) and call it once per fetch
- [X] T023 [US1] In `index.html` (model `<select>`, around line 1242): replace `value="meteoblue"` and its label with `value="best_match"` « Sélection automatique (Open-Meteo, multi-modèles) »; align the other option labels with `forecast.*` catalogue labels
- [X] T024 [US1] In `js/views/sites.js`: add `formatForecastContext(provenance, now)` (exported for tests) and render the context line (`<p class="forecast-context">`, escaped) once in `buildWeatherPopupHtml`, once in the site card weather block, and in `renderComparator` (one line above the table if all favourites share provenance, else one per row); loading message uses the model label
- [X] T025 [P] [US1] In `css/sites.css`: `.forecast-context` (small, muted, wraps on mobile) for both themes
- [X] T026 [US1] Run `npm test` and `npx playwright test tests/e2e/sites_flow.spec.js --project=chromium`; T017–T020 pass

**Checkpoint**: source and retrieval/run time visible on every verdict.

---

## Phase 5: User Story 2 - Stale forecasts are flagged (Priority: P1)

**Goal**: forecasts retrieved > 3 h ago flagged everywhere with age and « Actualiser » (FR-005–FR-007).

**Independent Test**: set `fetchedAt` 4 h in the past → warning on every display; refresh removes it; failure keeps it with the reason (SC-003).

### Tests for User Story 2 ⚠️ write first, see them fail

- [X] T027 [P] [US2] In `tests/services/sites_service.test.js`: `isForecastStale(siteId, now)` false at 2 h 59, true at 3 h 01; `fetchWeatherForSites({ force: true })` bypasses the cache and updates `fetchedAt`; on HTTP 429 or network error it returns `{ success: false, reason }` and leaves provenance unchanged
- [X] T028 [P] [US2] In `tests/views/sites_verdict.test.js`: `formatAge(ms)` → « 3 h 20 », « 1 j 2 h »; with a stale provenance the popup, card and comparator contain « peut être dépassée » and a button `data-action="SitesrefreshWeather"`; `updateForecastAges(now)` updates the age text of existing `.forecast-context` elements without re-rendering the list
- [X] T029 [US2] In `tests/e2e/sites_flow.spec.js`: install a fake clock (`page.clock.install`), load the sites with mocked Open-Meteo, advance time by 3 h 05 min: the expanded AUTEUIL card shows « peut être dépassée » and an « Actualiser » button; clicking it (Open-Meteo mocked again) removes the warning; with the refresh mocked to HTTP 429 the warning stays and « Actualisation impossible » is shown (constitution Principle IV)
- [X] T030 [US2] Run `npx vitest run tests/services/sites_service.test.js tests/views/sites_verdict.test.js`; confirm T027–T029 fail

### Implementation for User Story 2

- [X] T031 [US2] In `js/services/sites_service.js`: `isForecastStale(siteId, now = Date.now())` with `STALE_AFTER_MS`; `fetchWeatherForSites({ force })` skips cache reads when `force`; failures return a French `reason` (offline, provider limit with remaining cooldown)
- [X] T032 [US2] In `js/views/sites.js`: stale variant of the context line (class `forecast-context--stale`, age via `formatAge`, « Actualiser » button); register `SitesrefreshWeather` in `js/core/main.js` calling a view method that forces the fetch and shows « Actualisation impossible : {reason} » on failure; a 60 s `setInterval` started in `mount()` and cleared in `unmount()` calls `updateForecastAges(now)` (updates `data-fetched-at` elements in place)
- [X] T033 [P] [US2] In `css/sites.css`: `.forecast-context--stale` warning style (icon + text, not colour alone), both themes
- [X] T034 [US2] Run `npx vitest run tests/services/sites_service.test.js tests/views/sites_verdict.test.js` then `npm test` and `npx playwright test tests/e2e/sites_flow.spec.js --project=chromium`; T027–T029 pass

**Checkpoint**: US4, US1, US2 complete.

---

## Phase 6: User Story 3 - Model disagreement for the displayed hour (Priority: P2)

**Goal**: the second model covers the displayed sites and hours; agreement shown on every verdict for the displayed hour (FR-009–FR-012, FR-010a).

**Independent Test**: move the slider through 48 h with `twoModelHours` → agreement always compares the same hour; incomplete → unavailable (SC-004, SC-005).

### Tests for User Story 3 ⚠️ write first, see them fail

- [ ] T035 [P] [US3] In `tests/services/sites_service.test.js`: `fetchSecondaryModel()` (renamed from `fetchSecondaryModelForFavorites`) requests the same site set as the primary fetch (geo-filtered + favourites), in chunks of 400, with the same `forecast_days=8` and hourly variables incl. `cape`, reuses the 10-min cache, and does nothing while the 429 cooldown is active; `weatherForecastsSecondary[id]` is an array aligned on the primary time axis; secondary model is `gfs`, or `meteofrance` when primary is `gfs`, and nothing is fetched when they are equal
- [ ] T036 [P] [US3] In `tests/services/sites_service.test.js`: `getModelAgreement(site, offset)` over 48 offsets of `twoModelHours` returns `agree`/`disagree` for complete hours at that exact offset, `unavailable` when either hour is missing or incomplete, `not_compared` when models are equal; the primary outcome object is identical before and after
- [ ] T037 [P] [US3] In `tests/views/sites_verdict.test.js`: popup, card and comparator show « GFS d'accord », « GFS n'est pas d'accord : {verdict} » or « Comparaison GFS indisponible » for the displayed offset; nothing when `not_compared`
- [ ] T038 [US3] In `tests/e2e/sites_flow.spec.js`: mock two models with a disagreement at hour 2; clicking timeline dot 2 of the AUTEUIL card shows « n'est pas d'accord »; dot 0 shows « d'accord »
- [ ] T039 [US3] Run `npx vitest run tests/services/sites_service.test.js tests/views/sites_verdict.test.js` and `npx playwright test tests/e2e/sites_flow.spec.js --project=chromium`; confirm T035–T038 fail

### Implementation for User Story 3

- [ ] T040 [US3] In `js/services/sites_service.js`: implement `fetchSecondaryModel()` reusing the primary chunking/cache/backoff/cooldown code (extract a shared `_fetchChunks(sites, modelKey, { force })`), parse with the same builder into arrays aligned with the primary `currentHourIndex`; `getModelAgreement(site, offset = this.state.forecastOffset)` returning `{ state, secondaryModelKey, secondaryOutcome }` per data-model.md (daylight taken from the primary hour)
- [ ] T041 [US3] In `js/views/sites.js`: call `fetchSecondaryModel()` after each primary fetch (not only in the comparator, around line 1616); render the agreement line (class `model-agreement model-agreement--{state}`) in the popup, the card weather block and the comparator « Confiance » column, recomputed on slider changes; update the comparator to the new return shape
- [ ] T042 [P] [US3] In `css/sites.css`: `.model-agreement--agree|--disagree|--unavailable` with icon + text, both themes
- [ ] T043 [US3] Run `npm test` and `npx playwright test tests/e2e/sites_flow.spec.js --project=chromium`; T035–T038 pass

**Checkpoint**: all four stories complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T044 [P] Update `DOCUMENTATION.md`: forecast context line, provenance and run-time metadata, 3 h staleness, per-hour model agreement and request set, radius 10–200 km default 50 with Boulogne-sur-Mer fallback, `best_match` model, preference migration
- [ ] T045 Run `npm run lint`, `npm run format:check`, `npm run typecheck` (configs `eslint.config.mjs`, `.prettierrc.json`, `jsconfig.json`) and fix touched files
- [ ] T046 Run `npm test` (`vitest.config.js`), `npm run test:e2e` (`playwright.config.js`, Chromium + WebKit) and `npm run build` (`vite.config.mjs`); all green; record the local e2e run in the PR
- [ ] T047 Follow `specs/002-verdict-forecast-context/quickstart.md` §2 in the browser (fresh profile, light and dark, mobile width) and count Open-Meteo locations requested in the Network panel
- [ ] T048 Run `/speckit-analyze` on `specs/002-verdict-forecast-context/` and resolve inconsistencies

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → US4 → US1 → US2 → US3 → Polish.
- US4 first: it bounds requests before US3 doubles them. US1, US2 and US3 all edit `js/services/sites_service.js` and `js/views/sites.js`, so they run sequentially.
- US2 depends on US1 (context line); US3 depends on US4 (request set) and US1 (display slots).

### Parallel opportunities

- Phase 1: T001, T002, T003.
- Test tasks of a story in different files: T009 ∥ T010; T017/T018 (service tests) ∥ T019 (view tests); T027 ∥ T028 (T029 e2e after); T035/T036 ∥ T037.
- CSS tasks (T025, T033, T042) in parallel with the view work of their phase.
- T044 ∥ T045.

### Parallel example: User Story 4

```text
Together: T009 (tests/services/sites_service.test.js) + T010 (tests/views/sites_verdict.test.js)
Then: T011 (e2e) → T012 (confirm failures)
Then: T013 (service) → T014 (index.html) ∥ T015 (view)
```

## Implementation Strategy

1. Phases 1–3 (US4) = MVP: stops the quota exhaustion on its own.
2. US1 → validate (source and age visible).
3. US2 → validate (stale warning and refresh).
4. US3 → validate (per-hour agreement everywhere).
5. Polish → one pull request.

Commit after each phase; Conventional Commits in English; never weaken a test to make it pass.
