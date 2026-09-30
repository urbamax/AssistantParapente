# Feature Specification: Deleted Equipment Stays Deleted After Cloud Sync

**Feature Branch**: `fix/equipment-tombstones`

**Created**: 2026-09-30

**Status**: Implemented

**Input**: Owner report: deleted flights are protected against reappearing after a cloud sync (a local list of deleted ids, `deleted_flights`, is applied first by the sync and removed from the cloud). Equipment has no such protection: deleting an item only removes it locally and fires the cloud delete without waiting. If that cloud delete has not finished or failed silently (offline, sign-in not ready), the next sync merge downloads the item again from the cloud and it reappears in the pilot's logbook. This contradicts constitution Principle V (sync merges without losing data) and Principle I (data integrity).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A deleted wing does not come back (Priority: P1)

A pilot deletes a piece of equipment (for example an old wing) while offline or before their account is fully signed in. Later, the app syncs with the cloud. The deleted equipment does not reappear in the logbook, and it is removed from the cloud copy too.

**Independent Test**: delete an equipment item while the cloud delete fails, run a sync whose cloud data still contains the item, and check that the item is absent locally and from the cloud afterwards.

**Acceptance Scenarios**:

1. **Given** an equipment item that the pilot deleted while the cloud delete failed, **When** the next sync runs and the cloud still holds the item, **Then** the item does not reappear in the local equipment list and is deleted from the cloud.
2. **Given** the sync has completed the pending deletions, **When** a later sync runs, **Then** no deletion is replayed (the pending list is empty).
3. **Given** other equipment items, local or cloud-only, **When** the sync runs, **Then** they are merged exactly as before (nothing else is lost or removed).
4. **Given** a backup exported while some equipment deletions are still pending, **When** that backup is restored, **Then** the pending deletions are restored too, so the next sync still removes them from the cloud.

### Edge Cases

- If the cloud deletion fails during the sync, the pending list is kept so the next sync retries.
- An invalid entry in the pending list (not a non-empty string) is ignored, as for flights.
- A corrupted pending list in storage is treated as empty and does not break deletion or sync.
- Deleting the same item twice records it once.

## Requirements *(mandatory)*

- **FR-001**: Deleting an equipment item MUST record its id in a local list of pending equipment deletions, persisted across reloads.
- **FR-002**: The cloud sync MUST process pending equipment deletions before merging equipment: delete each one from the cloud, then clear the list once all deletions succeeded.
- **FR-003**: A deleted equipment item MUST NOT be brought back into the local list by the sync merge.
- **FR-004**: The full backup MUST include the pending equipment deletions, and restoring a backup MUST restore them.
- **FR-005**: Behaviour for flights and for non-deleted equipment MUST be unchanged.

## Success Criteria *(mandatory)*

- **SC-001**: A unit test that deletes an equipment item with a failing cloud delete, then syncs with the item still in the cloud, fails without the fix and passes with it.
- **SC-002**: Existing logbook, equipment and sync tests still pass.

## Assumptions

- The mechanism mirrors the existing flight deletion list (`deleted_flights`), stored in LocalStorage under its own key.
- The immediate cloud delete on deletion is kept; the pending list is the safety net when it does not complete.
