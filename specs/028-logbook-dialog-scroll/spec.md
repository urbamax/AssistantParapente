# Feature Specification: Logbook Keeps Its Position When the Session Dialog Closes

**Feature Branch**: `fix/webkit-keep-scroll`

**Created**: 2026-10-05

**Status**: Implemented

**Input**: CI on `main` has failed since PR 111: the e2e test « saving an edited session keeps the position in the list » fails on WebKit Linux every time (expected scroll 572, received 106), while it passes on Chromium and on WebKit macOS.

## Cause

Closing a modal `<dialog>` gives the focus back to the element that had it before the dialog opened, and the browser scrolls the page to that element. WebKit on Linux focuses buttons on click (macOS Safari does not), so the focus returned to a control near the top of the logbook and the list jumped up; the logbook then saved and « restored » that wrong position.

## Requirements *(mandatory)*

- **FR-001**: Closing the session dialog MUST leave the logbook at the position it had behind the dialog, whatever element the browser gives the focus back to.

## Success Criteria *(mandatory)*

- **SC-001**: Unit test reproducing the focus scroll (`tests/views/logbook_modal_scroll.test.js`): fails before, passes after.
- **SC-002**: CI e2e green on WebKit Linux (the existing `tests/e2e/logbook_keeps_view.spec.js`).
