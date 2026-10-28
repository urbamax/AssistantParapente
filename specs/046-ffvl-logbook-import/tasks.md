# Tasks: Import the FFVL Intranet Logbook (Excel)

Tests first, seen failing, then the code (constitution IV).

- [x] T001 Tests then `js/services/xlsx_reader.js`: minimal `.xlsx` reader (zip container, shared / inline strings, numbers, empty cells, size cap, not-a-zip error); fixture builder `tests/helpers/xlsx_fixture.js`
- [x] T002 Tests then `js/services/ffvl_logbook_import.js`: header lookup (any column order, accents), date / duration / dénivelé parsing, site resolution, statuses (ready, invalid, imported, similar), row keys, `buildFlight`
- [x] T003 Tests then `LogbookService`: `addFlights(flights, now)`, `deleteFlights(ids)`, `importBatches()`, `undoImport(batchId)`, `updateFlight` clears `dateOnly` when the time changes
- [x] T004 Texts `FR.logbook.ffvl.*` in `js/i18n/fr.js`, `data-i18n` label of the history button in `js/i18n/fr_html.js`, then `npm run sync:functions`
- [x] T005 Tests then view `js/views/logbook_ffvl_import.js` + dialog in `index.html` + actions in `js/core/main.js`: choose file, review, import, feedback
- [x] T006 Tests then history: "Importé FFVL" mark, date-only display, list of imports with "Annuler cet import"; stats ignore an empty flight type
- [x] T007 Playwright `tests/e2e/logbook_ffvl_import.spec.js`: import, re-import flags, cancel
- [x] T008 Manual (user guide) paragraph, then `npm run verify`
