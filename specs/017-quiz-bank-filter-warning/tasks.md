# Tasks: No "Unregistered action" Warning on the Quiz Bank Theme Filter

- [X] T001 [US1] Write `tests/views/quiz_bank_filter.test.js`: with `AppEvents.init()`, the real `#bank-theme-filter` markup from `index.html` and the quiz screen's `change` listener, pick "Météo"; expect one render with "Météo" and no warning; see it fail
- [X] T002 [US1] Write `tests/e2e/quiz_bank.spec.js`: on `/?mode=QCM_BANK`, pick "Météo" then "Tous les thèmes"; expect only Météo questions, then all again, and no warning; see it fail
- [X] T003 [US1] Remove `data-action="renderQcmBank"` from `#bank-theme-filter` in `index.html`; T001 and T002 pass
- [X] T004 Check in the browser: filter works, no warning
- [X] T005 Run lint, format check, typecheck, `npm test`, `npm run test:e2e`, `npm run build`
