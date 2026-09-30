# Tasks: No "Unregistered action" Warning on Quiz and Equipment Controls

- [X] T001 [US1][US3] Write `tests/views/quiz_actions.test.js`: with `AppEvents.init()` and the quiz click listener, click a quiz-only action (`QuizsetThemeSort`, `toggle-option`, `quiz-voice-cancel`): one call, no warning; click `setQcmMode`, `setQcmCount`, `setMasteryTarget`: the setting applies once; an unknown action still warns; see it fail
- [X] T002 [US2] In the same file, change the four real equipment selects from `index.html` with `AppEvents.init()`: no warning; see it fail
- [X] T003 [US1] `QuizView.handleClick` calls `AppEvents.markHandled(e)` for handled actions; remove the duplicate `setQcmMode`/`set-mode`, `setQcmCount`/`set-count`, `setMasteryTarget`, `goBack` cases
- [X] T004 [US2] Remove `data-action="document_getElementById"` and its `data-args` from the four equipment selects in `index.html`; T001 and T002 pass
- [X] T005 Add Playwright checks (quiz statistics sort, equipment "Other" field) with no warning, seen failing without the fix
- [X] T006 Update `DOCUMENTATION.md` (quiz screen follows the sites exception)
- [X] T007 Check in the browser; run lint, format check, typecheck, `npm test`, `npm run test:e2e`, `npm run build`
