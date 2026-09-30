# Implementation Plan: Deleted Equipment Stays Deleted After Cloud Sync

**Branch**: `fix/equipment-tombstones` | **Spec**: [spec.md](spec.md)

## Summary

Mirror the flight tombstones (`deleted_flights`) for equipment with a new LocalStorage key
`deleted_equipment`:

- `LogbookService.deleteEquipment` (`js/services/logbook_service.js`) appends the id to
  `deleted_equipment` (no duplicates, corrupted value treated as empty) before firing the cloud
  delete.
- `FirebaseAuthEngine.syncDataWithCloud` (`js/services/firebase_service.js`) processes these
  tombstones at the start of the "Sync Equipment" block: `deleteDoc` for each valid id, then
  resets the list to `[]`. A failing `deleteDoc` aborts the sync as for flights, so the list is
  kept for the next attempt. The local equipment list is also filtered by the tombstones, so an
  item still present locally cannot be re-uploaded.
- `exportAllData` adds `deleted_equipment` to the payload; `importAllData` restores it when it
  is an array.

Test seam: the sync loads the Firestore SDK through a dynamic import of a URL, which Vitest
cannot resolve. The engine gets a `_loadFirestore` property (defaulting to the existing loader)
used by `syncDataWithCloud`, so a test can supply an in-memory Firestore.

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| I. Data integrity | PASS | A deleted item no longer reappears; other items merge as before |
| IV. Test-first | PASS | Regression test in `tests/services/equipment_tombstones.test.js`, seen failing |
| V. Offline-first, no data loss | PASS | Deletions made offline are replayed on the next sync; backup keeps them |
| VIII. Layered architecture | PASS | Changes stay in the logbook and Firebase services |

## Complexity Tracking

None.
