# Implementation Plan: Full Backup Survives an Unreadable Deletion List

**Branch**: `fix/export-corrupted-tombstones` | **Spec**: [spec.md](spec.md)

## Summary

Add a module helper `readTombstoneIds(key)` in `js/services/firebase_service.js`: parse the
LocalStorage value in a `try`, return `[]` when it is not an array, and keep only non-empty
string entries. Use it in `exportAllData` for `deleted_flights` and `deleted_equipment`, and in
the four tombstone reads of `syncDataWithCloud` (start and merge, flights and equipment).

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| I. Data integrity | PASS | The backup no longer fails because of one unreadable key; valid lists unchanged |
| IV. Test-first | PASS | `tests/services/export_tombstones.test.js`, seen failing |
| V. No data loss | PASS | The pilot can always save their data; the sync no longer deletes ids invented from a string |

## Complexity Tracking

None.
