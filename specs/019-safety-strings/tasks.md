# Tasks: Safety Screen Texts in the Strings Catalogue

- [X] T001 Record `tests/views/safety_render.test.js` snapshots on the unchanged code
- [X] T002 [US2] Add `FR.safety` to `js/i18n/fr.js` with the exact current texts
- [X] T003 [US2] Read the texts from the catalogue in `js/views/safety.js` (`esc`, `rich`, `tl`); rebuild the exported checklists from it
- [X] T004 [US1] Run the snapshot test; accept only the whitespace change, proven identical once normalised; run `tests/views/safety.test.js`
- [X] T005 [US2] Merge the guard tests into `tests/views/inline_strings.test.js`; skip file paths in the shared check
- [X] T006 Regenerate `functions/shared/`, update `DOCUMENTATION.md` and the C8 status
- [X] T007 Run lint, format check, typecheck, `npm test`, `npm run test:e2e`
