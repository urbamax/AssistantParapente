# Tasks: Last Forecast Available Offline

**Tests**: REQUIRED (constitution Principle IV).

## Phase 1: Storage helpers

- [X] T001 [P] In `tests/services/idb_storage.test.js` (fallback block, IndexedDB unavailable): `setValues([...])` resolves without throwing, `getValuesByPrefix('forecast:')` resolves `[]`, `deleteValues(['x'])` resolves
- [X] T002 Run `npx vitest run tests/services/idb_storage.test.js`; confirm T001 fails
- [X] T003 Implement `setValues(entries)` (one `readwrite` transaction on `keyval`, entries `{ key, value }`), `getValuesByPrefix(prefix)` (getAll + filter on `key`), `deleteValues(keys)` in `js/services/idb_storage.js`, with the existing unsupported / error fallbacks; run T001

## Phase 2: User Story 1 - Last forecast after an offline restart (P1)

- [X] T004 [P] [US1] In `tests/services/sites_service.test.js` (mock `IDBStorageService.setValues/getValuesByPrefix/deleteValues` with `vi.spyOn` on the default export used by the service): after a successful `fetchWeatherForSites`, `saveForecastSnapshot` (awaited in the test) writes one record per site `{ key: 'forecast:{id}', value: { siteId, modelKey, fetchedAt, forecasts } }`; when a fetch fails with nothing in memory, `fetchWeatherForSites` restores saved records: forecasts start at the current hour (past hours dropped), `getForecastProvenance(id)` returns the saved model and `fetchedAt`, `state.forecastSource === 'saved'`, the result has `restored: n`; records with no future hour are deleted; a rejected storage call does not throw and leaves forecasts empty; a later successful fetch sets `forecastSource === 'live'`
- [X] T005 [P] [US1] In `tests/e2e/sites_flow.spec.js`: load the sites with mocked Open-Meteo (6 complete hours) and a radius of 200 km, wait for the save, reload with every Open-Meteo request aborted (`route.abort('internetdisconnected')`): the AUTEUIL card shows a verdict, its context line with the original « récupérée à », and `#offline-forecast-notice` is visible with « prévision enregistrée sur l’appareil »
- [X] T006 [US1] Run the two files; confirm T004–T005 fail
- [X] T007 [US1] In `js/services/sites_service.js`: `saveForecastSnapshot()` (deferred call after success, errors logged), `restoreForecastSnapshot(now)` (drop past hours by local time string, delete empty records, rebuild `weatherForecasts` and `forecastProvenance`, clear secondary forecasts, reset `forecastOffset` to 0 and enable the slider through a shared `_setupForecastSlider(hoursCount)`), `state.forecastSource` (`'live'` / `'saved'`); call restore in every failure return of `fetchWeatherForSites` when no forecast is in memory, and include `restored` in the result
- [X] T008 [US1] In `js/views/sites.js` + `js/i18n/fr.js`: `#offline-forecast-notice` at the top of the list when `forecastSource === 'saved'`: « Hors ligne — prévision enregistrée sur l’appareil, récupérée le {date} à {heure} ; elle peut être dépassée. » (or « Service météo indisponible — … » when `navigator.onLine`); `handleWeatherFetchResult` renders restored forecasts like a success (no error banner) but without loading the model comparison
- [X] T009 [US1] Run `npm test` and `npx playwright test tests/e2e/sites_flow.spec.js --project=chromium`; all pass

## Phase 3: User Story 2 - Honest about what is missing (P2)

- [X] T010 [P] [US2] In `tests/views/sites_verdict.test.js`: with `forecastSource === 'saved'`, a site without forecast shows « Prévision indisponible hors ligne »; the model agreement of a restored site is « indisponible »
- [X] T011 [US2] Run it; confirm it fails; implement the card text in `js/views/sites.js`; run it again

## Phase 4: Polish

- [X] T012 Update `DOCUMENTATION.md` (offline forecast: storage, restore rules, notice)
- [X] T013 Run lint, format, typecheck, `npm test`, `npm run test:e2e` (Chromium + WebKit), `npm run build` (configs `eslint.config.mjs`, `playwright.config.js`, `vite.config.mjs`); all green
