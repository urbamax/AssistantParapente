# Tasks

- [X] T001 Write `tests/views/logbook_modal_scroll.test.js` (close moves the scroll to 106); see it fail
- [X] T002 Keep the logbook scroll position across `modal.close()` in `closeSessionModal` (js/views/logbook.js): CI still red
- [X] T002b Temporary CI diagnostic in the e2e test: the jump happens on `showModal()`; removed afterwards
- [X] T002c Remember the position when the dialog opens; restore it after `showModal()` and after `close()`
- [X] T003 Lint, format, typecheck, unit tests; e2e logbook tests on Chromium and WebKit macOS; WebKit Linux in CI
