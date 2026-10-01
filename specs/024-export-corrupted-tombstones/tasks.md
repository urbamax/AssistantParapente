# Tasks: Full Backup Survives an Unreadable Deletion List

- [X] T001 Add `tests/services/export_tombstones.test.js`: export with unreadable and non-list deletion lists, and a sync with a string list; confirm they fail
- [X] T002 Add `readTombstoneIds` and use it in `exportAllData` and in `syncDataWithCloud` (`js/services/firebase_service.js`)
- [X] T003 Run lint, format check, typecheck, unit tests, end-to-end tests and build
