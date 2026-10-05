# Feature Specification: Logbook Keeps Its Position When the Session Dialog Closes

**Feature Branch**: `fix/webkit-keep-scroll`

**Created**: 2026-10-05

**Status**: Implemented; cause corrected after merge (see below)

**Input**: CI on `main` has failed since PR 111: the e2e test « saving an edited session keeps the position in the list » fails on WebKit Linux every time (expected scroll 572, received 106), while it passes on Chromium and on WebKit macOS.

## Cause

A first fix (keeping the position across `modal.close()`) did not change the CI result. A temporary CI diagnostic (scroll events, focus and every scrolling call, logged at each step) showed that on WebKit Linux the logbook jumps from 572 to 106 **while the dialog opens** (`showModal`), with no JavaScript scrolling call: the browser moves it. It does not happen every time (it passed on retry). The logbook then saved that wrong position when re-rendering after the save. The return of the focus on close can move it too.

## Correction (after merge)

The diagnosis above was wrong, and the code change did not fix CI: after the merge, `main` failed on Chromium **and** WebKit every time (565 → 102, 572 → 106). Playwright traces from CI and local runs show the list moves **before** the dialog opens, during Playwright's own `click()`:

- The router opens the logbook with a View Transition, then the screen slides in (`fadeIn`). While this runs, the page cannot be hit-tested (`elementsFromPoint` only returns `<html>`), so Playwright scrolls the list and retries.
- After `scrollIntoViewIfNeeded()`, the « Modifier » button of a tall card can sit under the fixed user menu (`.floating-user-menu`, top right); Playwright reports that the menu « intercepts pointer events », scrolls the list again and retries.

These scrolls are native (no JavaScript call), which is what the temporary diagnostic saw « during » the click. The app then rightly kept the position the list had when the dialog opened, which was no longer the one the test measured. With the test fixed, it passes with and without the T002/T002c code (checked by running the new test against the logbook view from before this spec); that code is kept as a harmless safeguard.

The test now waits for the arrival animation to end, puts the button in the middle of the list and clicks it with the mouse where it is displayed (`page.mouse.click`), like a pilot would.

## Requirements *(mandatory)*

- **FR-001**: The logbook MUST stay at the position it had when the session dialog opened: restored right after `showModal()` and after `close()`, whatever the browser does with the scroll or the focus.

## Success Criteria *(mandatory)*

- **SC-001**: Unit test reproducing the focus scroll (`tests/views/logbook_modal_scroll.test.js`, jump on open and on close): fails before, passes after.
- **SC-002**: CI e2e green on Chromium and WebKit Linux (`tests/e2e/logbook_keeps_view.spec.js`), and the test passes 100 times in a row locally (`--repeat-each=25`, both browsers).
