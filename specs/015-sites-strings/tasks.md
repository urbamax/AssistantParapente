# Tasks: Sites Screen Texts in the Strings Catalogue

- [X] T001 Record `tests/views/sites_render.test.js` snapshots on the unchanged code (14 states listed in spec.md)
- [X] T002 Move the inline-text check to `tests/helpers/inline_texts.js`, add the rules found necessary, keep `tests/views/logbook_strings.test.js` green
- [X] T003 [US2] Write `tests/views/sites_strings.test.js` (no inline text, every key exists); see it fail
- [X] T004 [US2] Add `FR.sites` to `js/i18n/fr.js` with the exact current texts
- [X] T005 [US2] Replace the texts in `js/views/sites.js` (including those the check cannot see: variable assignments, weekday arrays, level labels); T003 passes
- [X] T006 [US1] Run the snapshot test without update: identical; run existing sites tests and e2e
- [X] T007 Regenerate `functions/shared/` if needed; update `DOCUMENTATION.md` and the C8 status in the audit
- [X] T008 Run lint, format check, typecheck, `npm test`, `npm run test:e2e`
