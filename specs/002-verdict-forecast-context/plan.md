# Implementation Plan: Forecast Context Next to Every Verdict

**Branch**: `feat/verdict-forecast-context` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-verdict-forecast-context/spec.md`

## Summary

Every verdict (map popup, site card, favourites table) gains a context line: model name,
retrieval time and — from Open-Meteo's per-model metadata — the model run time. Forecasts
retrieved more than 3 h ago are flagged with an « Actualiser » action. The second-model
comparison is fixed to compare the same hour as the one displayed and extended to every
displayed site. To keep request volume within Open-Meteo's limits, the radius defaults to 50 km
(max 200 km, « Illimité » removed), the filter always applies, and Boulogne-sur-Mer is the
reference position when no GPS or address is known. The misleading « Meteoblue » model option is
renamed to what it is: Open-Meteo's automatic multi-model selection.

## Technical Context

**Language/Version**: JavaScript ES2023 native modules (browser)

**Primary Dependencies**: Leaflet; Open-Meteo forecast API and model metadata endpoint
(`/data/{model}/static/meta.json`, CORS-enabled, no key); no new library

**Storage**: preferences in LocalStorage / Firestore (migration of `radiusLimit` and
`weatherModel`); forecasts and provenance in memory only (offline persistence is audit B1)

**Testing**: Vitest + happy-dom (unit, view helpers), Playwright (e2e, service worker blocked,
Open-Meteo mocked including metadata)

**Target Platform**: mobile and desktop browsers (PWA)

**Project Type**: web app (static SPA)

**Performance Goals**: default load ≤ ~300 Open-Meteo calls with both models (50 km); worst case
(200 km, Alps) ≤ ~1 600 calls; age labels refreshed every 60 s without re-rendering the list

**Constraints**: provider limits (≈600/min, 5 000/h, 10 000/day per IP); no build step; French
strings in the catalogue; spec 001 behaviour unchanged

**Scale/Scope**: `sites_service.js`, `sites.js`, `weather_config.js`, `index.html` (radius slider,
model options), `firebase_service.js` (defaults/migration), `i18n/fr.js`, `css/sites.css`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / rule | Status | How the plan complies |
|------------------|--------|-----------------------|
| I. UX and data integrity first | PASS | Source and age of every verdict shown; misleading model label fixed; bounded requests keep verdicts loading instead of failing with 429 |
| II. Decision support (NON-NEGOTIABLE) | PASS | Closes the A6 deviation of spec 001: forecast timestamp and model disagreement shown wherever a verdict is; the verdict itself is never changed by the comparison |
| III. Sourced content | PASS | No theory content; model run times come from the provider's own metadata |
| IV. Test-first (NON-NEGOTIABLE) | PASS | Tests first for provenance, staleness, per-hour agreement, geo filter/fallback, migrations, request sets, and each display; e2e run locally before merge (not in CI yet, audit B4) |
| V. Offline-first | PASS | No regression; staleness flag makes old in-memory data explicit. Offline persistence stays audit B1 |
| VI. Privacy and security | PASS | Fallback position is a constant, not user data; no new third party (same Open-Meteo host); texts escaped |
| VII. Web app, no build | PASS | Plain modules, no new dependency |
| VIII. Layered architecture | PASS | Provenance, agreement, location fallback and migrations in `SitesService` (pure helpers tested); view only renders |
| Language / devices / performance | PASS | Catalogue strings; context line wraps on mobile; request volume reduced vs today |

**Post-design re-check**: all gates pass; no Complexity Tracking entry needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-verdict-forecast-context/
├── spec.md
├── plan.md              # this file
├── research.md          # R1–R9
├── data-model.md
├── quickstart.md
├── contracts/ui-context.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
js/data/weather_config.js      # WEATHER_MODEL_INFO (label, metaModel, runLabel), DEFAULT_LOCATION,
                               # RADIUS (default 50, max 200), STALE_AFTER_MS
js/services/sites_service.js   # effective location + fallback; geo filter always applied, keeps
                               # favourites; provenance (fetchedAt from cache timestamp, runAt from
                               # metadata); forced refresh; secondary fetch = same sites, same hours,
                               # chunked/cached/cooldown; getModelAgreement(site, offset);
                               # migrateSitePrefs; best_match endpoint
js/services/firebase_service.js# default prefs (radius 50, model), migration on cloud merge
js/views/sites.js              # context line, staleness + refresh, agreement, Boulogne notice,
                               # radius label, 60 s age timer
js/i18n/fr.js                  # new texts
css/sites.css                  # context line, stale and disagreement styles (both themes)
index.html                     # radius slider 10–200 default 50; model option renamed
tests/services/sites_service.test.js, tests/views/sites_verdict.test.js,
tests/services/site_prefs_migration.test.js (new), tests/e2e/sites_flow.spec.js,
tests/fixtures/forecasts.js
DOCUMENTATION.md
```

**Structure Decision**: existing SPA layout; no new directory.

## Implementation Phases (input for /speckit-tasks)

1. **Foundations**: config constants and model info; strings; fixtures (metadata payload,
   two-model forecasts).
2. **US4 (P1) — bounded requests**: location fallback, always-on geo filter keeping favourites,
   radius 10–200 default 50, prefs migration (local + cloud), notice. Done first: it protects the
   quota that US3 will use more.
3. **US1 (P1) — model and age**: provenance, metadata fetch, context line on every display,
   `best_match` rename + migration.
4. **US2 (P1) — staleness**: 3 h flag, minute timer, forced refresh with failure reason.
5. **US3 (P2) — agreement per hour**: secondary fetch for the displayed set and full window,
   `getModelAgreement(site, offset)`, display on every verdict.
6. **Polish**: documentation, full checks, manual quickstart, `/speckit-analyze`.

## Complexity Tracking

No constitution violation to justify.
