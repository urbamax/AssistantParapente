# Implementation Plan: Deletions Made During a Sync Stay Deleted

**Branch**: `fix/sync-deletion-race` | **Spec**: [spec.md](spec.md)

## Summary

- New `tests/services/flight_tombstones.test.js`, built on the shared in-memory Firestore
  (`tests/fixtures/fake_firestore.js`): failed cloud delete, no replay, failure during the sync,
  and a deletion made while the sync reads the cloud.
- Same mid-sync deletion test for equipment in `tests/services/equipment_tombstones.test.js`.
- In `syncDataWithCloud` (`js/services/firebase_service.js`), the local copy is filtered with
  `deletedFlightsSet` / `deletedEquipSet` when filling the merge map, as the cloud copy already is.

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| I. Data integrity | PASS | A deleted item no longer comes back; other items merge as before |
| IV. Test-first | PASS | Mid-sync deletion tests seen failing before the fix |
| V. No data loss | PASS | Merge rule unchanged for non-deleted items |

## Complexity Tracking

None.
