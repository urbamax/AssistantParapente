# Tasks: Quiz Statistics Filter Label Fixes

- [X] T001 [US1][US2] Add tests to `tests/views/quiz_render.test.js` (theme name with markup is escaped; « Thème : », « Détail : »); see them fail
- [X] T002 [US1] Build the filter label with `tq` (escaped) in `js/views/quiz.js`
- [X] T003 [US2] Fix the two texts in `js/i18n/fr.js`, regenerate `functions/shared/`, update the two snapshot lines
- [X] T004 Run lint, format check, typecheck, `npm test`, `npm run test:e2e`, `npm run build`
