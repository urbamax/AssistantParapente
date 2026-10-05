# Tasks: Static HTML Texts Keyed to the Strings Catalogue

- [X] T001 Annotate index.html and the components with data-i18n / data-i18n-html / data-i18n-<attribute> (attributes only, generated once)
- [X] T002 Add the 579 texts to `FR.html` in `js/i18n/fr.js`; regenerate `functions/shared/`
- [X] T003 Write `tests/views/static_texts.test.js` (every text keyed, identical to the catalogue); check it fails on an unkeyed text
- [X] T004 Add `applyStaticTexts` in `js/utils/i18n_dom.js` with its tests (not wired)
- [X] T005 Update DOCUMENTATION.md and close C8 in the audit; run lint, format, typecheck, unit tests (e2e in CI)
