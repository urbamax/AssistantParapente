# Tasks: Menus Act on Change Only; Working "Forgot Password"

- [X] T001 [US1] Write `tests/core/form_control_actions.test.js`: with `AppEvents.init()`, clicking a `<select data-action>` does not run the action, changing it runs it once with the value; the same with `SitesView.setupEventListeners()` for `changeSortMode`; see it fail
- [X] T002 [US2] In the same file: `FirebaseAuthEngine.forgotPassword()` calls `resetPassword` with the typed email, and shows an error alert when the field is empty; see it fail
- [X] T003 [US1] Skip `SELECT`/`INPUT`/`TEXTAREA` in the click delegation of `js/core/events.js` and `SitesView._clickHandler`
- [X] T004 [US1] Remove leftover `data-args` (`this.value`, `document.getElementById(...)`) from `index.html`
- [X] T005 [US2] Add `FirebaseAuthEngine.forgotPassword()`; T001 and T002 pass
- [X] T006 Add Playwright checks (level kept after opening the menu and reloading; sort menu), seen failing without the fix
- [X] T007 Drop unknown `sortMode` and `weatherModel` in `migrateSitePrefs` (values already corrupted on pilots' devices); test in `tests/services/site_prefs_migration.test.js`, seen failing
- [X] T008 Check in the browser; run lint, format check, typecheck, `npm test`, `npm run test:e2e`, `npm run build`
