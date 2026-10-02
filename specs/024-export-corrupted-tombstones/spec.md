# Feature Specification: Full Backup Survives an Unreadable Deletion List

**Feature Branch**: `fix/export-corrupted-tombstones`

**Created**: 2026-10-01

**Status**: Implemented

**Input**: Follow-up to spec 015. The full backup (`exportAllData`) reads the lists of pending flight and equipment deletions (`deleted_flights`, `deleted_equipment`) from LocalStorage without any guard. If one of them is not valid JSON, the export throws and the pilot gets no backup at all, although every other piece of data is readable. The cloud sync reads the same lists with a guard but accepts any valid JSON value: a list stored as a string would be walked character by character and each character sent to the cloud as an id to delete.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The backup always downloads (Priority: P1)

A pilot exports a full backup. Even if a pending deletion list is damaged in the browser storage, the backup file is produced with all their flights, equipment, quiz data and preferences.

**Independent Test**: store an unreadable value in each deletion list, export, and check that a backup file is produced with the logbook data and empty deletion lists.

**Acceptance Scenarios**:

1. **Given** a deletion list that is not valid JSON, **When** the pilot exports a backup, **Then** the backup is downloaded and contains all other data, with that list empty.
2. **Given** a deletion list that is valid JSON but not a list (an object, a string, a number), **When** the pilot exports a backup, **Then** that list is exported empty.
3. **Given** valid deletion lists, **When** the pilot exports a backup, **Then** they are exported unchanged.

### User Story 2 - The sync never deletes ids made up from a damaged list (Priority: P2)

**Acceptance Scenarios**:

1. **Given** a deletion list stored as a string such as `"abc"`, **When** the cloud sync runs, **Then** nothing is deleted from the cloud because of it.

### Edge Cases

- Entries that are not non-empty strings are dropped when the list is read (they cannot be ids).

## Requirements *(mandatory)*

- **FR-001**: Reading a pending deletion list MUST yield a list of string ids; an unreadable or non-list value MUST be treated as empty.
- **FR-002**: The full backup MUST be produced even when a deletion list is unreadable.
- **FR-003**: The cloud sync MUST read the deletion lists with the same rule.
- **FR-004**: Behaviour with valid lists MUST be unchanged.

## Success Criteria *(mandatory)*

- **SC-001**: A unit test exporting with an unreadable deletion list fails without the fix and passes with it.
- **SC-002**: Existing export, import, sync and tombstone tests still pass.

## Assumptions

- An unreadable list carries no usable id, so treating it as empty loses nothing that could be recovered (Principle I: no invented data).
