# Tasks: No "Unregistered action" Warning on Sites Controls

- [X] T001 [US1][US2] Write `tests/views/sites_actions.test.js`: with `AppEvents.init()` and `SitesView.setupEventListeners()`, click a view action (`toggleDropdown`), a service action (`toggleFilterFavoritesOnly`) and change a select (`changeSortMode`); expect one call each and no warning; an unknown action still warns; see it fail
- [X] T002 [US1] Add `markHandled(event)` to `js/core/events.js` and skip the fallback for marked events
- [X] T003 [US1] Mark handled events in `SitesView._clickHandler` and `_changeHandler`; T001 passes
- [X] T004 Check in the browser: no warning, "Active maps" menu opens and closes
- [X] T005 Add a Playwright check (`tests/e2e/sites_flow.spec.js`, Spec 016), seen failing without the fix; run lint, format check, typecheck, `npm test`, `npm run test:e2e`, `npm run build`
- [ ] T006 After merge: delete the local branch `worktree-fix-sites-action-delegation` (not checked out in any worktree)
