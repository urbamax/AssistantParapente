# Tasks: Logbook Screen Texts in the Strings Catalogue

**Tests**: required (Constitution IV).

## Phase 1: Foundational

- [X] T001 Write `tests/views/logbook_render.test.js` (happy-dom, fake time 2026-09-30T10:00): fixtures for a flight (IGC stats, techDecollage, voile, sellette, comment, meteo + meteoAtterro, baliseId, rawIgc), a ground handling session (exercises), equipment (voile with red date and hours alerts, sellette with orange alerts, archived accessory); snapshot `innerHTML` of `renderHistory`, `renderStats`, `renderEquipment` (full and empty), `renderForm` (vol and gonflage), `editEntry` / `resetForm` button texts, `editEquipment` / `resetEquipmentForm` texts, `_setupAltitudeCheck` (normal and negative landing), `renderSessionWeatherHtml` (with and without meteo), `forceWeatherRefresh` error block, `fetchWeatherForSession` failure block, `showTrace` error block, `deleteEntry` / `deleteEquipment` confirm messages, `_processIgcFile` messages (file label, place names, parse error alert); record the snapshot on the current code

## Phase 2: User Story 2 - Translatable from one place (P1)

- [X] T002 [US2] Write `tests/views/logbook_strings.test.js` (node): scan `js/views/logbook.js` as described in plan.md; see it fail and list the inline texts
- [X] T003 [US2] Add `FR.logbook.{form,igc,history,stats,equipment,weather,messages}` to `js/i18n/fr.js` with the exact current texts
- [X] T004 [US2] Replace inline texts in `js/views/logbook.js` with `t()` / `tt()` (form, IGC, history, stats, equipment, weather, messages); keep stored values; T002 passes

## Phase 3: User Story 1 - Same logbook (P1)

- [X] T005 [US1] Run `tests/views/logbook_render.test.js` without updating the snapshot: identical; run existing logbook tests (`tests/views/logbook_*.test.js`, e2e `logbook_*.spec.js`)

## Phase 4: Polish

- [X] T006 Note progress on C8 in `.specify/audits/2026-09-29-constitution-audit.md` and `DOCUMENTATION.md`
- [X] T007 Run lint, format check, typecheck, `npm test`, `npm run test:e2e`
