# Tasks

- [X] T001 Write `tests/views/logbook_modal_scroll.test.js` (close moves the scroll to 106); see it fail
- [X] T002 Keep the logbook scroll position across `modal.close()` in `closeSessionModal` (js/views/logbook.js): CI still red
- [X] T002b Temporary CI diagnostic in the e2e test: the jump happens on `showModal()`; removed afterwards
- [X] T002c Remember the position when the dialog opens; restore it after `showModal()` and after `close()`
- [X] T003 Lint, format, typecheck, unit tests; e2e logbook tests on Chromium and WebKit macOS; WebKit Linux in CI
- [X] T004 After merge: CI still flaky on the first WebKit attempt; cause: Playwright's own scroll before click(); the e2e test dispatches the click (20/20 local runs on Chromium and WebKit)
- [X] T005 Traces: the covering element is the fixed user menu; the arrival animation also blocks hit-testing; the dispatched click passes without the T002/T002c code (100/100 local runs)
