# Contract: Logbook Strings

- Every key read by `js/views/logbook.js` exists in `FR.logbook` (an unknown key would show the key itself: covered by the snapshot).
- `js/views/logbook.js` contains no inline user-facing text (guard test).
