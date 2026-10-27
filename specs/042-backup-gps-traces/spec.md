# Feature Specification: GPS Traces in the Local Backup

**Feature Branch**: `feat/backup-gps-traces`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "OK" to the follow-up of spec 041: export the GPS traces kept in IndexedDB too.

## Problem

The local backup (spec 041) copies the data stored in localStorage. The GPS trace (raw IGC text) of a
flight is kept in IndexedDB only, never in localStorage (quota), so a pilot who restores a backup on
a new device finds every flight in the logbook but none of its trace (no map, no analysis, no
recalculation). A pilot without an account has no other copy.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Keep my GPS traces in the backup (Priority: P1)

Exporting writes, next to the usual data, the trace of every flight that has one. Importing puts
them back into IndexedDB, so the flights open with their trace again.

**Acceptance Scenarios**:

1. **Given** flights with traces, **When** the pilot exports, **Then** the file holds one compressed
   trace per flight that has one, under `igc_traces`.
2. **Given** such a file on a device without these traces, **When** the pilot imports it, **Then** each
   trace is back in IndexedDB, identical to the original, and the message says how many were restored.
3. **Given** a file exported by spec 041 (no `igc_traces`), **Then** it imports as before.
4. **Given** a trace that cannot be decoded, **Then** it is skipped and counted in the message; the
   rest of the backup is restored.
5. **Given** a file whose `igc_traces` has an unexpected shape or encoding, **Then** the whole file is
   refused before anything is written (same rule as every other key).

### Edge Cases

- IndexedDB unavailable (private mode, old WebView): the export has no traces and the import skips them.
- A trace whose flight is not in the backup's logbook is not restored (no orphan data).
- The size limit of a file goes from 20 MB to 64 MB (compressed traces are about 50 KB per flight).

## Requirements *(mandatory)*

- **FR-001**: Export MUST include, for each logged flight that has a trace in IndexedDB, the trace
  compressed (`gzip-base64`, or `identity-base64` where the browser cannot compress), without loss.
- **FR-002**: Import MUST restore those traces into IndexedDB after validation, only for flights of
  the backup's logbook, and MUST report restored and unreadable counts.
- **FR-003**: Files without `igc_traces` MUST keep working; the file layout otherwise does not change.
- **FR-004**: A malformed `igc_traces` MUST refuse the whole file; a single undecodable trace MUST NOT
  stop the restore of the other data.

## Success Criteria *(mandatory)*

- **SC-001**: export, delete the trace, import restores it byte for byte (unit with a fake store, and
  Playwright with the real IndexedDB on Chromium and WebKit).
- **SC-002**: all unit tests, lint, types and `npm run verify` pass.
