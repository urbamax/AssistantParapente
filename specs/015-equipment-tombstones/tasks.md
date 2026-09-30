# Tasks: Deleted Equipment Stays Deleted After Cloud Sync

- [X] T001 Add a test seam `_loadFirestore` on `FirebaseAuthEngine`, used by `syncDataWithCloud` (`js/services/firebase_service.js`)
- [X] T002 Add `tests/services/equipment_tombstones.test.js`: delete an equipment item with a failing cloud delete, sync against an in-memory Firestore that still holds it, expect it gone locally and in the cloud; confirm it fails
- [X] T003 Record the id in `deleted_equipment` in `LogbookService.deleteEquipment` (`js/services/logbook_service.js`)
- [X] T004 Process `deleted_equipment` first in the equipment part of `syncDataWithCloud`, then clear it (`js/services/firebase_service.js`)
- [X] T005 Include `deleted_equipment` in `exportAllData` and restore it in `importAllData`, with a test
- [X] T006 Run lint, format check, typecheck, unit tests, end-to-end tests and build
