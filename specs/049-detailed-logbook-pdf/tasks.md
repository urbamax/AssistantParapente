# Tasks: Detailed A4 Landscape Logbook PDF Report

1. [x] Write failing unit tests in `tests/services/logbook_export.test.js` covering: A4 landscape CSS without double body margin, header KPIs (separate flight/ground counts and durations, cumulative distance/gain/max altitude, period, wing breakdown), brevets summary block (`BI`/`BP`/`BPC`/`TREUIL` + `brevetPrepare`), exact session time vs `dateOnly` handling, full per-session metrics (`typeVol`, `techDecollage`, `priseTerrain`, `vache`, `altitudeMax`, `gain`, `altOffset` on `takeoffAlt`/`landingAlt`, `descent`, `distanceKm`, `freeDistanceKm`, `maxClimbRate`, `maxSpeedKmh`, `avgSpeedKmh`, `winch`, `sensorStats`, `instrument`), equipment (`voile`, `sellette`, `rescueDeployed`), school/stage/instructors/companions/winch-operator/pilots/exercises, recorded weather (`meteo`, `meteoAtterro`, `meteoAtterroSame`), XSS escaping on all fields, and non-mutation.
2. [x] Write failing view tests in `tests/views/logbook_export.test.js` verifying `exportLogbookPdf()` forwards `BrevetService.getBrevets()` and renders detailed session/brevet info in the printed HTML.
3. [x] Write failing Playwright E2E test assertions in `tests/e2e/logbook_exports.spec.js` covering detailed metrics, school/brevet info, wing summary, and brevet progression in the printed report.
4. [x] Add French labels under `logbook.export` in `js/i18n/fr.js` and run `npm run sync:functions`.
5. [x] Implement the A4 landscape detailed builder in `js/services/logbook_export.js` and update `js/views/logbook_history.js`.
6. [x] Update the manual description in `js/i18n/fr_html.js` & `index.html`, and update `DOCUMENTATION.md`.
7. [x] Run all verification checks (`vitest`, `lint`, `format:check`, `typecheck`, `build`, `playwright`).
