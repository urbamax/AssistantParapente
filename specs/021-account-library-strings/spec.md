# Feature Specification: Account Messages and Library Texts in the Strings Catalogue

**Feature Branch**: `feat/account-manual-strings`

**Created**: 2026-09-30

**Status**: Draft

**Input**: Constitution audit gap C8, next screens after specs 014, 015 and 019: the account messages shown by `js/services/firebase_service.js` (sign-in, sign-up, password reset, cloud sync, weather alerts, backup export and import, header titles) and the course library (`js/views/manual.js`). The owner asked to migrate every remaining screen.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Same messages for the pilot (Priority: P1)

A pilot signing in, syncing, enabling alerts, exporting or importing a backup, or browsing the course library reads exactly the same messages as before.

**Independent Test**: every account message in the catalogue is found word for word in the previous code (automated comparison: 40 of 40); the library renders (sorted by category, level, title, and "no result") are recorded before the change and identical after it.

### User Story 2 - Translatable from one place (Priority: P1)

**Independent Test**: the shared inline-text check (with a new rule for `showAlert` / `showStatus` messages) finds nothing in both files, and every key exists.

### Edge Cases

- Error codes returned to the calling code (`'Not logged in'`, `'Missing VAPID key'`…) are never shown to the pilot: they stay in the code as data.
- Level codes (`BI`, `BP`…), the default category `Autre` and `GENERAL` are data.
- Developer tooling: Vitest now ignores `.claude/**` (other sessions' worktrees were picked up by local runs and failed on their own unfinished work).
- Accents: checked, none missing.

## Requirements *(mandatory)*

- **FR-001**: Every account message and library text MUST come from the catalogue (`FR.account`, `FR.library`).
- **FR-002**: Wording MUST be unchanged (automated comparison with the previous code; library snapshots).
- **FR-003**: Error codes returned to code MUST stay unchanged.
- **FR-004**: The shared inline-text check MUST cover both files.

## Success Criteria *(mandatory)*

- **SC-001**: 0 inline user-facing texts in the five migrated files.
- **SC-002**: 40 / 40 account messages identical to the previous code; library snapshots identical.
- **SC-003**: All existing tests pass.

## Assumptions

- The account messages depend on Firebase and are moved mechanically (each literal copied as is into the catalogue and replaced in place by its key), which guarantees the same wording in the same place; spec numbers 016–020 were taken by parallel work.
