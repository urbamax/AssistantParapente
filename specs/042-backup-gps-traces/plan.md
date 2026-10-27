# Implementation Plan: GPS Traces in the Local Backup

**Branch**: `feat/backup-gps-traces` | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

## Summary

`backup_service.js` reads each logbook flight's trace through `IDBStorage` (`getTrace`, then the
`flights` store as fallback), compresses it with the existing `trace_codec` (one part, no Firestore
size limit), and stores it under `igc_traces`. `parseBackup` validates the key; the new async
`applyBackupTraces` decodes and writes each trace with `IDBStorage.saveTrace`. `exportBackup` becomes
async; `backup_ui.js` reports the counts after the usual restore.

## Constitution Check

| Principle | Status |
|-----------|--------|
| GDPR consent | Pass: same local file, nothing leaves the device |
| Data integrity | Pass: validation before writing, lossless codec, only flights of the backup |
| Test-first | Pass: unit tests with a fake IndexedDB store, Playwright round trip on the real one |

No violation.

## Project Structure

```text
js/services/backup_service.js, js/core/backup_ui.js, js/i18n/fr.js
tests/services/backup_traces.test.js (new), tests/core/backup_ui.test.js, tests/e2e/local_backup.spec.js
```
