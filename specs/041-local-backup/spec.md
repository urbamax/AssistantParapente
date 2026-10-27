# Feature Specification: Local Backup Without an Account

**Feature Branch**: `feat/local-backup-no-account`

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Pilots who do not want an account must be able to export all their data to a file and import it back when they want (new device, cleared browser), without ever connecting to Firebase."

## Problem

A full export / import already exists, but it lives in `FirebaseAuthEngine` and its two buttons are
only shown in the signed-in view of the "Espace Synchro" dialog. A pilot who refuses the Firebase
consent (or simply has no account) sees only "Consentement requis" there: they cannot save their
logbook, equipment and statistics, and lose everything if the browser data is cleared. The import
also finishes with a cloud sync and silently does nothing when `window.FirebaseAuthEngine` is absent.
The app's RGPD rule requires consent for Firebase, not for a file the pilot saves on their own device.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Save my data to a file without an account (Priority: P1)

From the "Espace Synchro" dialog or from the privacy options, whatever the consent state, the pilot
touches "Exporter" and receives `parapente_backup_<date>.json` with all their data.

**Independent Test**: with the Firebase consent refused and nobody signed in, export; the file holds
the logbook, equipment, QCM statistics, exam history, preferences, level, theme and pending deletions.

**Acceptance Scenarios**:

1. **Given** no account and the Firebase consent refused, **When** the pilot touches "Exporter",
   **Then** a file is downloaded and no request is sent to Firebase.
2. **Given** QCM statistics carrying fields added by a later version (for example `recent`), **When**
   exported and imported, **Then** every field is preserved.

### User Story 2 - Restore my data from a file (Priority: P1)

The pilot touches "Importer", picks a backup file, confirms the overwrite, and finds their data again.

**Acceptance Scenarios**:

1. **Given** a valid backup, **When** the pilot picks it and confirms, **Then** the data it contains
   replaces the local data and the app reloads on the restored data.
2. **Given** the pilot declines the confirmation, **Then** nothing is changed.
3. **Given** a file that is not a backup, from a future major version, damaged (a known key with an
   unexpected shape), or empty, **Then** an explanatory message is shown, nothing is asked and nothing
   is changed.
4. **Given** nobody is signed in, **Then** the import sends nothing to the cloud. **Given** a signed-in
   pilot, the restored data goes up with the usual merge sync.
5. **Given** files exported by earlier versions (no version field), **Then** they are accepted.
6. **Given** the "Statistiques" consent is refused, **Then** the QCM statistics and exam history of
   the file are not restored (they would be erased at the next consent change) and the pilot is told.

### Edge Cases

- A file carrying roles (`parapente_access`), a route or a sync date: roles, the exporting device's
  last route and its last sync date are never restored.
- A file bigger than 20 MB is refused without being read.
- Text in the file (a flight site name with markup) is stored as data and never interpreted.
- GPS traces stored in IndexedDB are not part of the file (same limit as before).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Export and import MUST be usable without an account and without Firebase consent, from
  the "Espace Synchro" dialog and from the privacy options.
- **FR-002**: Export and import MUST NOT contact Firebase. Only after a restore by a signed-in
  pilot, the existing silent cloud sync runs.
- **FR-003**: The file format MUST stay compatible with files already exported (same layout, `_meta`
  with `appName`); files of any 1.x version or without version are accepted.
- **FR-004**: Import MUST validate the file (`_meta.appName`, version, shape of each known key) before
  writing anything, MUST write nothing when any known key is malformed, and MUST never evaluate content.
- **FR-005**: Import MUST ask for confirmation before overwriting, then reload the app so that all
  views restart on the restored data.
- **FR-006**: `QCM_STATS` and every other known key MUST be copied whole: no field is filtered or
  rewritten.
- **FR-007**: Roles (`parapente_access`) MUST never be exported or restored.

## Success Criteria *(mandatory)*

- **SC-001**: export, wipe, import restores the logbook and statistics with the Firebase consent
  refused and no request to a Google host (Playwright, Chromium and WebKit).
- **SC-002**: all unit tests, lint, types and `npm run verify` pass.

## Assumptions

- A page reload after the restore is acceptable and is the safest way to refresh every view and
  service (an in-memory copy of the preferences could otherwise overwrite the restored data).
