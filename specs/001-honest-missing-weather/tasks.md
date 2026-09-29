---
description: "Task list for honest handling of missing and unknown weather data"
---

# Tasks: Honest Handling of Missing and Unknown Weather Data

**Input**: Design documents from `specs/001-honest-missing-weather/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/evaluation.md](contracts/evaluation.md),
[contracts/ui-states.md](contracts/ui-states.md), [quickstart.md](quickstart.md)

**Tests**: REQUIRED. Constitution Principle IV (Test-First, NON-NEGOTIABLE): every test task is
written first and MUST be run and seen failing before the implementation tasks of its phase.

**Organization**: tasks are grouped by user story so each story can be implemented and checked
on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1–US4 from spec.md
- Paths are relative to the repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: strings catalogue and shared test fixtures used by every story.

- [X] T001 [P] Create `js/utils/i18n.js` exporting `t(key, params)`: looks up a dot-separated key in the catalogue imported from `../i18n/fr.js`, replaces `{name}` placeholders from `params`, returns the key itself when missing (and `console.warn`s once per key); pure ES module with `.js` import extensions, no build-only features
- [X] T002 [P] Create `js/i18n/fr.js` exporting a frozen `FR` object with a `weather` section containing the current verdict texts moved verbatim from `js/weatherScoring.js` ("Chargement...", "Nuit", "Pluie ({mm} mm)", "Vent hors limites", "Vent hors limites (Matériel)", "Rafales hors limites", "Risque orageux (CAPE)", "Mauvaise orientation", "Excellent ({score}/100)", "Bon ({score}/100)", "Passable ({score}/100)", " avec {wings}") plus the new texts from contracts/ui-states.md: "Prévision incomplète", "Indisponible : {list}", missing-value labels (vent moyen, rafales, direction du vent, précipitations, risque d'orage, heures de jour), "Orientation du décollage inconnue : à vérifier", "Aucune prévision fiable pour ce site", "Indisponible" (confidence column), the legend label "Prévision incomplète", the placeholder "—", and the reminder "Avis basé sur des prévisions, risque d'orage estimé : la décision vous appartient, vérifiez sur place."
- [X] T003 [P] Create `tests/utils/i18n.test.js`: `t()` returns catalogue text, fills placeholders, returns the key for an unknown key; write it before T001 and see it fail
- [X] T004 [P] Create `tests/fixtures/forecasts.js` exporting: `COMPLETE_HOUR` (all values present, daytime), `completeHourWith(overrides)`, sites `SITE_SOUTH` (`orientations_vent: ['S']`), `SITE_NO_ORIENTATION` (no orientation field), `SITE_UNRECOGNISED_ORIENTATION` (`orientations_vent: ['Sud-Ouest']`), default prefs `{ vMin: 5, vMax: 25, deltaRafaleMax: 15 }`, a `REFERENCE_CASES` array of ≥ 20 complete forecasts × known-orientation sites with the **current** `evaluateSpotForecast` output recorded (generate once by running the unmodified function, commit the literal expected values), and `AROME_TAIL_RESPONSE`: an Open-Meteo-shaped hourly payload whose last hours are `null` for wind, gusts, direction and cape (as observed in research R1)

**Checkpoint**: `npm test` runs the new i18n tests green; fixtures importable.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: value normalisation and orientation detection, used by every story.

**⚠️ CRITICAL**: no user-story work before this phase is complete.

- [X] T005 [P] Add tests in `tests/weatherScoring.test.js` for `normalizeForecastValue(value, kind)` per contracts/evaluation.md: returns `null` for `null`, `undefined`, `''`, `'abc'`, `NaN`, `Infinity`, `-Infinity`, negative values for every kind, and `windDir` values `< 0` or `> 360`; returns rounded integers for `windSpeed`/`windGust`/`windDir`, the raw number for `precipitation` and `cape`; accepts numeric strings like `'12.4'`
- [X] T006 [P] Add tests in `tests/weatherScoring.test.js` for `getSiteOrientations(site)`: array field, comma string field, `orientation` fallback, trimming and upper-casing, only the eight labels `N, NE, E, SE, S, SO, O, NO` recognised, returns `[]` for missing/empty/unrecognised
- [X] T007 Run `npx vitest run tests/weatherScoring.test.js` and confirm T005–T006 fail (functions not exported yet)
- [X] T008 Implement and export `normalizeForecastValue` and `getSiteOrientations` in `js/weatherScoring.js`; keep the module free of DOM, storage and browser globals (it will run in Node, research R4)
- [X] T009 Remove the `localStorage` read from `evaluateSpotForecast` in `js/weatherScoring.js`: hardware mode uses `userPreferences.wings` (array, default `[]`); in `js/services/sites_service.js` `isForecastFlyable` reads `tp_equipment_data` once per call site via the existing storage helper and passes `wings`; update the existing hardware-mode test to pass `wings` explicitly (audit C5, research R6)

**Checkpoint**: all existing tests plus T005–T006 pass; scoring no longer touches storage.

---

## Phase 3: User Story 1 - No verdict from incomplete forecasts (Priority: P1) 🎯 MVP

**Goal**: an hour with any missing required value shows "Prévision incomplète" with every missing value named, never a verdict.

**Independent Test**: with `AROME_TAIL_RESPONSE`, the empty hours show the incomplete state on map, list, timeline, table and sheet; complete hours keep their verdict (SC-001, SC-002, SC-004).

### Tests for User Story 1 ⚠️ write first, see them fail

- [X] T010 [P] [US1] In `tests/weatherScoring.test.js`, add a test matrix: for each required value (`windSpeed`, `windGust`, `windDir` on `SITE_SOUTH`, `precipitation`, `daylight` via `isDaytime: null`) and every pair of them, `evaluateSpotForecast` returns `status: 'incomplete'`, `flyable: false`, `score: null`, `reasonCode: 'INCOMPLETE'`, and `missing` equal to all missing codes in the fixed order `windSpeed, windGust, windDir, precipitation, cape, daylight`; includes the audit reproduction (missing `windSpeed` previously "Passable (0/100)"); values passed directly to `evaluateSpotForecast` that are invalid (`-3`, `'abc'`, `Infinity`, `windDirDeg: 400`) are treated as missing; hardware mode (`filterMode: 'hardware'`, `wings` given) with missing `windSpeed` → incomplete, never "Vent hors limites (Matériel)"
- [X] T011 [P] [US1] In `tests/weatherScoring.test.js`, add the regression test iterating `REFERENCE_CASES`: `flyable`, `score`, `reason` unchanged and `status` equals `'flyable'`/`'unflyable'` accordingly (FR-013, SC-004)
- [X] T012 [P] [US1] In `tests/services/sites_service.test.js`, add: `fetchWeatherForSites` with `AROME_TAIL_RESPONSE` stores `null` (not `0`) for missing wind, gust, direction, precipitation and `windCard: null`; `isDaytime` is `null` when `daily.sunrise`/`sunset` is missing for that date
- [X] T013 [P] [US1] In `tests/services/sites_service.test.js`, add aggregate tests for `getFilteredAndSortedSites`: incomplete hours are not counted in `flyableHours`, `maxConsecutiveHours`, `flyableSlots` or `conditionScore`, end a consecutive run, and are not counted as unflyable; new `site.completeHours` equals the number of non-incomplete hours; `hideUnflyable` still hides a site whose loaded hours are all incomplete (spec assumption)
- [X] T014 [P] [US1] In `tests/services/sites_service.test.js`, add: `getModelAgreement` returns `null` when either the primary or the secondary hour is incomplete; the secondary fetch stores `null` for missing values
- [X] T015 [US1] In `tests/e2e/sites_flow.spec.js`, add a scenario mocking `**/meteofrance*` and `**/forecast*` with 2 complete hours then `null` hours: moving the forecast slider onto a `null` hour shows "Prévision incomplète" and the missing-values text on the list card; the timeline bar of that hour has the incomplete class; no "Vent hors limites" is shown for it; with a mock where every hour is `null`, the card shows "Aucune prévision fiable pour ce site"; the map marker of an incomplete hour has class `marker-core--incomplete`
- [X] T016 [US1] Run `npm test` and `npx playwright test tests/e2e/sites_flow.spec.js`; confirm T010, T012–T015 fail and T011 passes (baseline)

### Implementation for User Story 1

- [X] T017 [US1] In `js/weatherScoring.js`, restructure `evaluateSpotForecast` per data-model.md "Evaluation order": `loading` when no weather; compute `missing` by passing each input through `normalizeForecastValue` (defence in depth, research R1; windDir only when `getSiteOrientations(site)` is non-empty; `cape` added in US3) and return the `incomplete` outcome before any check; add `status` and `reasonCode` to every return; build `reason` with `t()` from `js/utils/i18n.js` using keys from T002 (exact current texts preserved); `class: 'weather-incomplete'`, `icon: 'ri-question-line'` for incomplete
- [X] T018 [US1] In `js/services/sites_service.js` (primary forecast builder around line 618 and secondary builder around line 358), build every hourly value with `normalizeForecastValue`; `windCard` = `degreesToCardinal(windDirDeg)` only when `windDirDeg !== null`, else `null`; `precipitation` no longer defaults to `0`; `isDaytime` = `null` when sunrise or sunset is missing for that day (no `true` default)
- [X] T019 [US1] In `js/services/sites_service.js` `getFilteredAndSortedSites`, use `status` instead of `.flyable`: count only `'flyable'`; an `'incomplete'` hour closes the current slot and resets the consecutive counter; compute `site.completeHours`; keep the `hideUnflyable` rule "no flyable hour in the first 48 h → hidden, forecast not loaded → shown"
- [X] T020 [US1] In `js/services/sites_service.js` `getModelAgreement`, return `null` when either outcome has `status === 'incomplete'`
- [X] T021 [US1] In `js/views/sites.js`, replace every colour/label choice based on French text (`status.reason === 'Nuit'`, `startsWith('Pluie')`, `=== 'Mauvaise orientation'`, around lines 580–586 and 1803–1815) with `status.status` / `status.reasonCode`; add the incomplete case: hollow marker (transparent core, 2 px dashed `#94a3b8` border, « ? » glyph via class `marker-core--incomplete`), visibly different from the filled grey loading marker, no pulse; timeline bar with class `timeline-hour-dot--incomplete` and title "{heure} : Prévision incomplète — Indisponible : …"
- [X] T022 [US1] In `js/views/sites.js`, render missing values as "—" (never `null`, `NaN` or `0`) in the list weather row (around line 1738), the map popup (`buildWeatherPopupHtml`, around line 626) and the comparison table; for incomplete hours show "Prévision incomplète" plus "Indisponible : {labels}" built with `t()`; insert all dynamic text via `escapeHTML()` or `textContent`
- [X] T023 [US1] In `js/views/sites.js`, slots line (around line 1778): when `site.completeHours === 0` show "Aucune prévision fiable pour ce site" instead of "Aucun créneau favorable…"; comparison table "Confiance" column shows "Indisponible" when `getModelAgreement` is `null` because of incomplete data; legend (around line 1993) gains a "Prévision incomplète" entry
- [X] T024 [P] [US1] In `css/sites.css`, add `.site-weather-row.weather-incomplete`, `.marker-core--incomplete` (transparent background, dashed border, centred « ? ») and `.timeline-hour-dot--incomplete` (hatched pattern via `repeating-linear-gradient`) for dark and `body.light-mode`, distinguishable without colour (pattern + label), contrast ≥ 4.5:1 for text
- [X] T025 [US1] Run `npm test` and `npx playwright test tests/e2e/sites_flow.spec.js`: T010–T015 pass in `tests/weatherScoring.test.js`, `tests/services/sites_service.test.js` and `tests/e2e/sites_flow.spec.js`; fix the implementation until green

**Checkpoint**: US1 complete and demonstrable (quickstart §2 steps 1–2).

---

## Phase 4: User Story 2 - Unknown take-off orientation is never shown as ideal (Priority: P1)

**Goal**: sites without known orientation get no score and a visible "orientation unknown" notice.

**Independent Test**: `SITE_NO_ORIENTATION` with good wind from any direction is never "Excellent"/"Bon"/"Passable"; other checks still apply (SC-003).

### Tests for User Story 2 ⚠️ write first, see them fail

- [X] T026 [P] [US2] In `tests/weatherScoring.test.js`: for `SITE_NO_ORIENTATION` and `SITE_UNRECOGNISED_ORIENTATION` with complete in-limit forecasts from all 8 directions → `status: 'flyable'`, `orientationUnknown: true`, `score: null`, `reasonCode: 'ORIENTATION_UNKNOWN'`, `warning: true`, reason text "Orientation du décollage inconnue : à vérifier"; with night, rain, wind or gust out of limits → the corresponding unflyable outcome; a missing `windDir` alone does not make such a site incomplete
- [X] T027 [P] [US2] In `tests/services/sites_service.test.js`: sorting and `conditionScore` do not crash with `score: null`; sites with unknown orientation still count their flyable hours
- [X] T028 [US2] In `tests/e2e/sites_flow.spec.js`, add a scenario with a site without orientation in the mocked site list (route `**/sites_data.json` returning a copy of the fixture site with `orientations_vent` removed) and a complete in-limit forecast: the list card and the map popup show "Orientation du décollage inconnue : à vérifier", no score ("/100") and no "Excellent"/"Bon"/"Passable"; the marker is yellow without pulse (constitution Principle IV)
- [X] T029 [US2] Run `npx vitest run tests/weatherScoring.test.js tests/services/sites_service.test.js` and `npx playwright test tests/e2e/sites_flow.spec.js`; confirm T026–T028 fail

### Implementation for User Story 2

- [X] T030 [US2] In `js/weatherScoring.js`, after all checks pass, when `getSiteOrientations(site)` is empty return `{ status: 'flyable', flyable: true, orientationUnknown: true, score: null, reasonCode: 'ORIENTATION_UNKNOWN', warning: true, class: 'weather-flyable', icon: 'ri-compass-discover-line' }` with the catalogue text; never compute `scoreOrientation = 100` for unknown orientation; keep the wrong-orientation check on the shared `getSiteOrientations` result
- [X] T031 [US2] In `js/services/sites_service.js` `isForecastFlyable`, compute `bestOrientation` from `getSiteOrientations(site)` (no duplicate parsing)
- [X] T032 [US2] In `js/views/sites.js`, for `orientationUnknown` outcomes use the existing yellow `#eab308`, no pulse, show the notice text and no score in marker title, popup, list row, timeline bar title and table
- [X] T033 [US2] Run `npx vitest run tests/weatherScoring.test.js tests/services/sites_service.test.js` and `npx playwright test tests/e2e/sites_flow.spec.js`: T026–T028 pass

**Checkpoint**: US1 + US2 complete.

---

## Phase 5: User Story 3 - Thunderstorm risk is evaluated and presented as an estimate (Priority: P2)

**Goal**: CAPE is requested and evaluated against the sourced 1000 J/kg threshold; every verdict carries the reminder.

**Independent Test**: CAPE above/at/below 1000 and missing CAPE give storm-unflyable / normal / normal / incomplete; every verdict display shows the reminder (SC-007, SC-008).

### Tests for User Story 3 ⚠️ write first, see them fail

- [X] T034 [P] [US3] In `tests/weatherScoring.test.js`: `STORM_CAPE_THRESHOLD === 1000`; CAPE 1001 → unflyable `STORM_RISK` with text "Risque orageux (CAPE)"; CAPE 1000 and 999 → not storm; `cape: null` → incomplete with `missing` containing `'cape'`; update `COMPLETE_HOUR`-based fixtures and `REFERENCE_CASES` inputs to include a low `cape` (e.g. 100) without changing expected outputs
- [X] T035 [P] [US3] In `tests/services/sites_service.test.js`: the primary and secondary request URLs contain `cape` in `hourly=`; parsed hours carry `cape`
- [X] T036 [US3] In `tests/e2e/sites_flow.spec.js`: add `cape` to the mocked hourly data; assert the reminder "la décision vous appartient, vérifiez sur place" is visible once on the list card, in the map popup, above the favourites comparison table and next to the legend
- [X] T037 [US3] Run `npx vitest run tests/weatherScoring.test.js tests/services/sites_service.test.js` and `npx playwright test tests/e2e/sites_flow.spec.js`; confirm T034–T036 fail

### Implementation for User Story 3

- [X] T038 [US3] In `js/weatherScoring.js`, export `STORM_CAPE_THRESHOLD = 1000` with a comment citing "FFVL, Commissions Nationales Sécurité et Technique, « Canicule, vague de chaleur et vol libre », 2026-07-31" and the nuance from research R3; add `cape` to the required values and apply the check `cape > STORM_CAPE_THRESHOLD` in the order of data-model.md
- [X] T039 [US3] In `js/services/sites_service.js`, add `cape` to `hourly=` in the primary URL (around line 493) and the secondary URL (around line 334); parse it with `normalizeForecastValue(…, 'cape')` in both builders
- [X] T040 [US3] In `js/views/sites.js`, add the reminder line (catalogue key from T002, via `textContent`/`escapeHTML`) once per map popup, list card (weather block, also visible when details are expanded) and above the favourites comparison table, and next to the legend
- [X] T041 [US3] Run `npm test` and `npx playwright test tests/e2e/sites_flow.spec.js`: T034–T036 pass

**Checkpoint**: US1–US3 complete.

---

## Phase 6: User Story 4 - Notifications never rely on missing or unknown data (Priority: P2)

**Goal**: the notification function uses the same scoring module and never notifies from incomplete data or unknown orientation.

**Independent Test**: server evaluation on the shared fixtures matches the app on 100 % of cases and never yields a "becomes flyable" transition from incomplete data or unknown orientation (SC-005, SC-006).

### Tests for User Story 4 ⚠️ write first, see them fail

- [X] T042 [P] [US4] Create `tests/functions/shared_copy.test.js`: `functions/shared/weatherScoring.mjs`, `functions/shared/geo_utils.mjs`, `functions/shared/i18n.mjs` and `functions/shared/fr.mjs` equal their sources after the import-path rewrite done by the sync script; `functions/sites_data.json` equals `js/data/sites_data.json`
- [X] T043 [P] [US4] Create `tests/functions/notifications.test.js`: import the pure helpers exported by `functions/evaluate.mjs` (`buildHourlyForecast(openMeteoPayload, now)`, `shouldNotify(previousState, outcome)`); with the shared fixtures: an incomplete hour and an unknown-orientation site never lead to `shouldNotify === true`; an incomplete outcome is stored as `'unknown'` and a later flyable hour after `'unknown'` does not notify unless the previous known state was unflyable; for every `REFERENCE_CASES` input the server outcome `status` equals the app's
- [X] T044 [US4] Run `npx vitest run tests/functions/`; confirm `tests/functions/shared_copy.test.js` and `tests/functions/notifications.test.js` fail

### Implementation for User Story 4

- [X] T045 [US4] Create `scripts/sync_functions_shared.mjs` (Node, no dependency): copies `js/weatherScoring.js`, `js/utils/geo_utils.js`, `js/utils/i18n.js`, `js/i18n/fr.js` to `functions/shared/*.mjs`, rewriting relative import paths to the flat `./*.mjs` names; copies `js/data/sites_data.json` to `functions/sites_data.json`; add a header comment "GENERATED — do not edit, run scripts/sync_functions_shared.mjs"
- [X] T046 [US4] Add `"predeploy": ["node scripts/sync_functions_shared.mjs"]` to the functions entry of `firebase.json`; add an npm script `"sync:functions": "node scripts/sync_functions_shared.mjs"` in `package.json`; run it and commit the generated files
- [X] T047 [US4] Create `functions/evaluate.mjs`: `buildHourlyForecast` (Open-Meteo request now includes `cape`; values via `normalizeForecastValue`; `isDaytime` `null` when sunrise/sunset missing; same 30-min daylight margin as the app) and `shouldNotify` (notify only when `outcome.status === 'flyable' && !outcome.orientationUnknown && previousState === false`); state values stored: `true`, `false` or `'unknown'`
- [X] T048 [US4] In `functions/index.js`, remove the hand-written `isFlyable`, `degreesToCardinal` and value parsing; load `./evaluate.mjs` and `./shared/weatherScoring.mjs` with `await import()` inside the scheduled handler; use `evaluateSpotForecast` with the user's prefs (`limitWindMin/Max`, `limitGustDelta` mapped to `vMin/vMax/deltaRafaleMax`) and `shouldNotify`; keep the notification text unchanged (its wording is audit gap A3, separate spec)
- [X] T049 [US4] Add `functions/shared/`, `functions/evaluate.mjs` to the lint/format scope check (ensure `eslint.config.mjs` and `.prettierignore` treat `functions/shared/` as generated: ignored by lint/format, covered by the drift test)
- [X] T050 [US4] Run `npx vitest run tests/functions/` then `npm test`: T042–T043 pass

**Checkpoint**: all four stories complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T051 [P] Update `DOCUMENTATION.md`: scoring section (evaluation order, incomplete state, unknown orientation, CAPE threshold with FFVL source), strings catalogue (`js/i18n/fr.js`, `t()`), shared copy for `functions/` and the sync script; also fix the outdated typecheck paragraph and the references to `js/data/sites_data.js`, `debug_sites.js`, `test_logbook.js`, `test_scoring.js` (audit C9, touched documentation)
- [ ] T052 Run `npm run lint`, `npm run format:check`, `npm run typecheck` (config `eslint.config.mjs`, `.prettierrc.json`, `jsconfig.json`) and fix every reported issue in touched files
- [ ] T053 Run the full suites `npm test` (`vitest.config.js`) and `npm run test:e2e` (`playwright.config.js`), then `npm run build` (`vite.config.mjs`); all green (Principle IV — e2e not in CI yet, record the local run in the PR)
- [ ] T054 Follow `specs/001-honest-missing-weather/quickstart.md` §2 in the browser (AROME slider beyond +110 h, a site without orientation, reminder on each display, switch to GFS) in light and dark themes and at mobile width; attach screenshots to the PR
- [ ] T055 Run `/speckit-analyze` on `specs/001-honest-missing-weather/` and resolve any inconsistency before opening the pull request

---

## Dependencies & Execution Order

### Phase dependencies

- Phase 1 (Setup) → Phase 2 (Foundational) → user stories.
- **US1** (Phase 3) depends on Phase 2 only.
- **US2** (Phase 4) depends on Phase 2; touches the same functions as US1 in `js/weatherScoring.js` and `js/views/sites.js`, so run it **after US1** (sequential, same files).
- **US3** (Phase 5) depends on US1 (incomplete handling of `cape`) and on the reminder catalogue key (T002).
- **US4** (Phase 6) depends on US1–US3 (it ships the final scoring module to the server).
- Polish (Phase 7) after all stories.

### Within each story

Tests first → run and see them fail → implementation → run and see them pass.

### Parallel opportunities

- Phase 1: T001–T004 all [P] (different files).
- Phase 2: T005 and T006 [P] (same test file but independent blocks; merge carefully) before T007.
- US1 tests: T010, T011 (scoring tests) in parallel with T012, T013, T014 (service tests); T024 (CSS) in parallel with T017–T023.
- US2 tests: T026 ∥ T027 (T028 e2e after). US3 tests: T034 ∥ T035. US4 tests: T042 ∥ T043.
- T051 (documentation) in parallel with T052.

### Parallel example: User Story 1

```text
Together: T010 + T011 (tests/weatherScoring.test.js), T012 + T013 + T014 (tests/services/sites_service.test.js)
Then: T016 (confirm failures)
Together: T017 (js/weatherScoring.js) + T024 (css/sites.css)
Then: T018 → T019 → T020 (js/services/sites_service.js), T021 → T022 → T023 (js/views/sites.js)
```

---

## Implementation Strategy

### MVP first (User Story 1)

1. Phases 1–2.
2. Phase 3 (US1): this alone removes the verdicts shown today on every empty AROME hour and the "flyable with missing wind" case.
3. Stop and validate with quickstart §2 steps 1–2.

### Incremental delivery

1. US1 → validate (MVP).
2. US2 → validate (no more "Excellent" for unknown orientation).
3. US3 → validate (storm check live, reminder everywhere).
4. US4 → validate (server aligned).
5. Polish → one pull request for the whole feature (Spec Kit cycle), or one per story if preferred.

### Notes

- [P] = different files, no dependency on unfinished tasks.
- Commit after each task or logical group; Conventional Commits in English.
- Never weaken a test to make it pass; a failing regression test (T011) means the change altered complete-data behaviour and must be fixed.
