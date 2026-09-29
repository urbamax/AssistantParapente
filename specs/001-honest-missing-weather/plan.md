# Implementation Plan: Honest Handling of Missing and Unknown Weather Data

**Branch**: `fix/honest-missing-weather-data` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-honest-missing-weather/spec.md`

## Summary

Stop turning missing forecast values and unknown take-off orientations into verdicts, and
activate the thunderstorm check. Forecast values are normalised to `number | null` when
parsed (no more `Math.round(null) → 0`), the pure scoring function returns a new `incomplete`
outcome listing every missing value, sites with unknown orientation get a flagged verdict with
no score, and CAPE is requested from Open-Meteo and evaluated against a documented threshold.
The same scoring module is copied into the notification function so app and server reach the
same outcome. Research showed the problem is not a corner case: with the default AROME model,
every hour after ~4.5 days is empty and currently shown as "Vent hors limites".

## Technical Context

**Language/Version**: JavaScript ES2023 as native ES modules (browser); Node 20 CommonJS for
`functions/`

**Primary Dependencies**: Leaflet (map), Open-Meteo forecast API (no key), Firebase Functions /
Cloud Messaging (server notifications); no new dependency

**Storage**: none new; equipment list read from LocalStorage by `SitesService` (moved out of the
scoring function)

**Testing**: Vitest + happy-dom (unit), Playwright (end-to-end, API mocked with `page.route`)

**Target Platform**: modern mobile and desktop browsers (installable PWA); Firebase Cloud
Functions (Node 20)

**Project Type**: web app (static SPA) + one scheduled cloud function

**Performance Goals**: no visible slowdown of the sites view; evaluation stays O(1) per
site-hour (~2 000 sites × up to 168 h, already evaluated today)

**Constraints**: source runnable without a build (Principle VII); pure scoring shared with
Node; French UI texts from a central catalogue; offline behaviour unchanged

**Scale/Scope**: 1 scoring module, 1 service, 1 view (sites), 1 CSS file, 1 cloud function,
~2 000 sites; no data migration

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / rule | Status | How the plan complies |
|------------------|--------|-----------------------|
| I. UX and data integrity first | PASS | Core purpose: no invented values, missing data shown as such, complete-data behaviour unchanged (regression suite) |
| II. Decision support (NON-NEGOTIABLE) | PASS | No verdict from missing data; reminder "la décision vous appartient, vérifiez sur place" on every verdict display (touched code brought into compliance, research R7). Model/time display (A6) deferred — see Complexity Tracking |
| III. Sourced content | PASS | CAPE threshold 1000 J/kg sourced from the FFVL article "Canicule, vague de chaleur et vol libre" (2026-07-31), cited in code and documentation, nuance recorded (research R3) |
| IV. Test-first (NON-NEGOTIABLE) | PASS | Tasks write failing tests first: scoring matrix, service aggregates, server evaluation, drift test, e2e incomplete-forecast scenario. E2E is not yet in CI (audit B4): run locally before merge and record it in the PR |
| V. Offline-first | PASS | No change to storage or caching |
| VI. Privacy and security | PASS | No new third party (same Open-Meteo host); all new text inserted with `textContent`/`escapeHTML` |
| VII. Web app, no mandatory build | PASS | Web source unchanged in nature; the copy script only prepares the separately deployed `functions/` package |
| VIII. Layered architecture | PASS | Scoring stays pure and stops reading storage (audit C5 fixed as touched code); service owns parsing and aggregates; view renders from codes |
| Language constraint | PASS | Touched strings move to new `js/i18n/fr.js`; colours chosen from codes, not text |
| Devices / accessibility | PASS | New state distinguishable by pattern and label, not colour alone; works in both themes |
| Workflow | PASS | Spec Kit cycle; dedicated branch; `DOCUMENTATION.md` updated (scoring, shared copy, strings module) |

**Post-design re-check (after Phase 1)**: all gates pass; the only deviations are listed in
Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-honest-missing-weather/
├── spec.md
├── plan.md              # this file
├── research.md          # R1–R7
├── data-model.md        # HourlyForecast, EvaluationOutcome, aggregates
├── quickstart.md        # validation guide
├── contracts/
│   ├── evaluation.md    # scoring functions shared with the server
│   └── ui-states.md     # display rules per outcome
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
js/
├── weatherScoring.js          # normalizeForecastValue, getSiteOrientations,
│                              # evaluateSpotForecast (incomplete / orientation unknown / CAPE),
│                              # STORM_CAPE_THRESHOLD; no storage access
├── utils/geo_utils.js         # unchanged, copied for the server
├── utils/i18n.js              # NEW: t(key, params)
├── i18n/fr.js                 # NEW: French catalogue (verdicts, missing values, reminder)
├── services/sites_service.js  # parse with normalizeForecastValue, request cape (primary +
│                              # secondary), isDaytime null, pass wings, aggregates
│                              # (completeHours, slots, filter), model agreement
└── views/sites.js             # render by status/reasonCode: marker, popup, list row,
                               # timeline bar, slots line, table, legend, reminder
css/sites.css                  # .weather-incomplete styles (marker, row, bar), both themes
functions/
├── index.js                   # use shared scoring, request cape, notify only on 'flyable'
│                              # with known orientation
├── evaluate.mjs               # NEW: buildHourlyForecast, shouldNotify (server helpers)
└── shared/                    # NEW, generated: weatherScoring.mjs, geo_utils.mjs, i18n.mjs, fr.mjs
scripts/sync_functions_shared.mjs  # NEW: copies the shared modules (+ checks sites_data copy)
firebase.json                  # predeploy hook running the sync script
tests/
├── weatherScoring.test.js     # extended: missing-value matrix, orientation, CAPE, regression
├── fixtures/forecasts.js      # NEW: shared fixtures (complete, incomplete, real AROME tail)
├── services/sites_service.test.js  # parsing, aggregates, filter, agreement
├── functions/notifications.test.js # NEW: server evaluation on shared fixtures
├── functions/shared_copy.test.js   # NEW: drift test (shared modules + sites_data)
└── e2e/sites_flow.spec.js     # new scenario: mocked forecast with null hours
DOCUMENTATION.md               # scoring rules, incomplete state, shared copy, strings module
```

**Structure Decision**: existing single-SPA layout plus the existing `functions/` package; the
only new directories are `js/i18n/`, `functions/shared/` (generated) and `tests/fixtures/`,
`tests/functions/`.

## Implementation Phases (input for /speckit-tasks)

1. **Foundations**: strings catalogue + `t()`; fixtures; failing tests for the scoring contract.
2. **US1 (P1)**: normalisation at parse time; `incomplete` outcome; aggregates; UI states; e2e.
3. **US2 (P1)**: orientation detection; flagged verdict without score; UI.
4. **US3 (P2)**: request CAPE everywhere; sourced threshold constant (1000 J/kg, FFVL); storm
   reason; reminder line on every verdict display.
5. **US4 (P2)**: sync script + predeploy; server uses shared module; notification rule; drift
   and server tests.
6. **Polish**: `DOCUMENTATION.md`; quickstart run; lint/format/typecheck; full test suites.

## Complexity Tracking

| Deviation | Why needed | Simpler alternative rejected because |
|-----------|------------|--------------------------------------|
| Principle II (touched code) partially deferred: forecast model, forecast time and model disagreement are not added next to every verdict here | Tracked as audit gap A6 with its own specification; mixing it in would roughly double this change and delay the safety fix for missing data | Doing everything at once delays fixing verdicts that are wrong today on every load (research R1) |
| Generated copy of scoring modules in `functions/shared/` | Firebase deploys `functions/` alone; one implementation is required for FR-012 | Two implementations drift (today's situation); a workspace package adds tooling for two files |
