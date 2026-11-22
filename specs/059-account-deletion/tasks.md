# Tasks: Delete My Account and My Online Data

- [X] T001 [US1] Rules emulator tests: owner deletes `access/profile`, reads/deletes `pushState/*`, cannot write them; other pilot cannot (`tests/firestore_rules/firestore_rules.test.js`); see them fail
- [X] T002 [US1] Update `firestore.rules` (and its header) until T001 passes; update `tests/core/firestore_rules_paths.test.js`
- [X] T003 [US1][US2] Vitest `tests/services/account_deletion.test.js`: full deletion, order (re-auth before any delete, deleteUser last), wrong/empty password deletes nothing, network error keeps sync paused, `requires-recent-login`, cancel resumes sync, ICE state reset, sync skipped while deleting; see it fail
- [X] T004 [US1][US2] Implement `deleteAccount`, `openDeleteAccount`, `cancelDeleteAccount`, `confirmDeleteAccount`, sync pause in `js/services/firebase_service.js`
- [X] T005 [US1] Panel markup in `index.html`, styles, strings in `js/i18n/fr.js` and `js/i18n/fr_html.js`, action wiring
- [X] T006 [US1] Playwright `tests/e2e/account_deletion.spec.js` (stubbed engine): open, cancel, wrong password error, success shows signed-out view and keeps the local logbook
- [X] T007 Manual (`manualModal.ellesSontHebergeesSur`) and privacy policy (`components/legal_modals.html` §4) + content tests
- [ ] T008 `npm run test:rules`, `npm run verify:full`, deploy rules, open the PR with `## Discord notice` / `## Discord guide`
