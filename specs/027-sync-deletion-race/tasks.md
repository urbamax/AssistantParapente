# Tasks: Deletions Made During a Sync Stay Deleted

- [X] T001 Add `tests/services/flight_tombstones.test.js` (failed cloud delete, no replay, failure during sync, deletion during sync); the mid-sync case fails
- [X] T002 Add the mid-sync deletion test for equipment in `tests/services/equipment_tombstones.test.js`; it fails
- [X] T003 Filter the local copy with the tombstones re-read before the merge, for flights and equipment (`js/services/firebase_service.js`)
- [X] T004 Run lint, format check, typecheck, unit tests, end-to-end tests and build
