# Tasks: Site Coordinates Picker

- [X] T001 In `tests/utils/geo_utils.test.js`: `parseCoordinates` accepts decimal (comma/space separated, comma decimals with `;`), DMS with N/S/E/W, Google Maps `@lat,lon` links; rejects empty, unreadable and out-of-range input; `formatCoordinates` gives 5 decimals (FR-002, SC-002)
- [X] T002 In `tests/services/logbook_service.test.js`: `findLastCoordsForPlace` returns the latest session with coordinates for a case-insensitive name, `null` otherwise (FR-005)
- [X] T003 In `tests/e2e/logbook_coords.spec.js`: unknown place, open the map, click it → field filled; save → stored session has those `lat`/`lon`; paste coordinates → saved; invalid text → not saved (SC-001, FR-004)
- [X] T004 Run T001–T003; confirm they fail
- [X] T005 Implement `parseCoordinates` / `formatCoordinates` in `js/utils/geo_utils.js`
- [X] T006 Implement `LogbookService.findLastCoordsForPlace`
- [X] T007 Add texts to `js/i18n/fr.js`; coordinates block, map, save/edit/type-switch handling and release in `js/views/logbook.js`; register actions in `js/core/main.js`
- [X] T008 Run everything (`npm test`, `npm run test:e2e`, lint, format, typecheck, build); update `DOCUMENTATION.md`
