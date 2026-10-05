# Feature Specification: Logbook Keeps Its Position When the Session Dialog Closes

**Feature Branch**: `fix/webkit-keep-scroll`

**Created**: 2026-10-05

**Status**: Implemented; cause corrected after merge (see below)

**Input**: CI on `main` has failed since PR 111: the e2e test « saving an edited session keeps the position in the list » fails on WebKit Linux every time (expected scroll 572, received 106), while it passes on Chromium and on WebKit macOS.

## Cause

A first fix (keeping the position across `modal.close()`) did not change the CI result. A temporary CI diagnostic (scroll events, focus and every scrolling call, logged at each step) showed that on WebKit Linux the logbook jumps from 572 to 106 **while the dialog opens** (`showModal`), with no JavaScript scrolling call: the browser moves it. It does not happen every time (it passed on retry). The logbook then saved that wrong position when re-rendering after the save. The return of the focus on close can move it too.

## Follow-up (after merging PR 114)

PR 114's CI was green only on retry: the first WebKit attempt still ended at 106. The jump between the click on « Modifier » and the dialog was made by Playwright itself: before a normal `click()`, it scrolls the page when it judges the button hidden (here by the fixed navigation bar), which depends on Linux fonts and heights and never happens for a pilot. The e2e test now sends the click with `dispatchEvent('click')`, like it already did for the save. The application fix of PR 114 stays: it keeps the position against real jumps on open and on close.

Playwright traces from CI and local runs add two details. The element covering the button is the fixed user menu (`.floating-user-menu`, top right). Playwright also scrolls while the logbook arrives: during the router's View Transition and the screen's `fadeIn` slide, the page cannot be hit-tested (`elementsFromPoint` only returns `<html>`). With the click dispatched, the test passes with and without the PR 114 application code. That code is a safeguard; no jump was ever seen without Playwright.

## Requirements *(mandatory)*

- **FR-001**: The logbook MUST stay at the position it had when the session dialog opened: restored right after `showModal()` and after `close()`, whatever the browser does with the scroll or the focus.

## Success Criteria *(mandatory)*

- **SC-001**: Unit test reproducing the focus scroll (`tests/views/logbook_modal_scroll.test.js`, jump on open and on close): fails before, passes after.
- **SC-002**: CI e2e green on Chromium and WebKit Linux (`tests/e2e/logbook_keeps_view.spec.js`), and the test passes 100 times in a row locally (`--repeat-each=25`, both browsers).
