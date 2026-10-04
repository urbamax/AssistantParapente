# Feature Specification: Deletions Made During a Sync Stay Deleted

**Feature Branch**: `fix/sync-deletion-race`

**Created**: 2026-10-04

**Status**: Implemented

**Input**: Owner request: add a test proving that a deleted flight does not reappear after a cloud sync (flights have tombstones, `deleted_flights`, but no sync test covered them). Writing that test exposed a gap: the sync reads the local logbook before reading the cloud, and re-reads the tombstones just before merging, but only filters the cloud copy with them. A flight (or an equipment item, spec 015) deleted while a sync is running is still in the local snapshot, so the merge writes it back; on the next sync its tombstone is gone and the item is re-uploaded to the cloud, so it comes back for good. This contradicts constitution Principles I and V.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A deleted flight does not come back after a sync (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a flight deleted while the cloud delete failed, **When** the next sync runs with the flight still in the cloud, **Then** it does not reappear locally and is deleted from the cloud.
2. **Given** the deletions have been completed, **When** a later sync runs, **Then** no deletion is replayed.
3. **Given** the cloud delete fails during the sync, **When** the sync ends, **Then** the pending deletion is kept for the next sync and the flight stays absent locally.

### User Story 2 - A deletion made while a sync is running is kept (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a sync is running, **When** the pilot deletes a flight before the merge, **Then** the merge does not bring it back, and the next sync deletes it from the cloud without re-uploading it.
2. **Given** a sync is running, **When** the pilot deletes an equipment item before the merge, **Then** the same holds for equipment.

## Requirements *(mandatory)*

- **FR-001**: The sync merge MUST exclude items whose id is in the pending deletion list read just before the merge, from both the local and the cloud copies, for flights and equipment.
- **FR-002**: Behaviour for items that are not deleted MUST be unchanged.

## Success Criteria *(mandatory)*

- **SC-001**: Tests for scenarios 1.1 to 1.3 pass and cover the flight tombstones.
- **SC-002**: The tests for User Story 2 fail without the fix and pass with it.
- **SC-003**: Existing sync, tombstone and export tests still pass.
