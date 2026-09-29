# Implementation Plan: Last Forecast Available Offline

**Branch**: `feat/offline-forecast` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

## Summary

Save each site's forecast (model, retrieval time, hours) to IndexedDB after every successful
download; when a download fails and nothing is in memory, restore them without past hours, with an
offline / service-unavailable notice, the spec 002 context line and staleness flag, and the model
comparison marked unavailable.

## Technical Context

**Language**: JavaScript ES modules · **Storage**: IndexedDB `keyval` store · **Testing**: Vitest
(storage mocked; happy-dom has no IndexedDB) and Playwright (real IndexedDB in Chromium and WebKit)
· **Constraints**: no new dependency; saving never delays display; storage failures are harmless.

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| I. UX / data integrity | PASS | Original model and retrieval time kept; past hours dropped; offline notice |
| II. Decision support | PASS | Staleness flag and reminder apply; comparison « indisponible » |
| IV. Test-first | PASS | Service tests (mocked storage) and e2e (real storage) first; e2e in CI |
| V. Offline-first | PASS | Closes B1 |
| VI. Privacy | PASS | Data stays on the device; public forecast data only |
| VIII. Layers | PASS | Storage helpers in `idb_storage.js`, logic in `SitesService`, notice in the view |

## Project Structure

```text
js/services/idb_storage.js     + setValues, getValuesByPrefix, deleteValues (keyval store)
js/services/sites_service.js   + saveForecastSnapshot, restoreForecastSnapshot, forecastSource;
                               restore on fetch failure; slider set-up shared
js/views/sites.js              offline notice; « Prévision indisponible hors ligne » on cards
js/i18n/fr.js                  new texts
tests/services/idb_storage.test.js, tests/services/sites_service.test.js, tests/e2e/sites_flow.spec.js
```

## Complexity Tracking

None.
