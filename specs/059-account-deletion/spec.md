# Feature Specification: Delete My Account and My Online Data

**Feature Branch**: `feat/059-account-deletion`

**Created**: 2026-11-22

**Status**: Draft

**Input**: Manual audit (spec 058): the manual promised deletion « depuis l'Espace Synchro », but
no such button exists; a pilot can only ask the publisher. GDPR (Art. 17) gives every user a right
to erasure. Owner decision (2026-11-22): deletion runs in the app (client side), not in a Cloud
Function.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - A signed-in pilot deletes their account and all their online data (Priority: P1)

In the Espace Synchro, a signed-in pilot opens « Supprimer mon compte ». A confirmation panel
says what will be deleted (logbook, GPS traces, equipment, quiz statistics, preferences, online
ICE sheet, weather alerts, the account itself), that it cannot be undone, and that the data on
this device stays (they can export it first, or clear the site data in the browser to remove it
too). The pilot types their password and confirms. The app deletes every online document under
`users/{uid}`, then the Firebase Auth account, and the pilot is signed out.

**Independent Test**: sign in, open the panel, confirm with the password: no document is left
under `users/{uid}`, the account no longer exists, the modal shows the signed-out view, and the
logbook on this device is unchanged.

**Acceptance Scenarios**:

1. **Given** a signed-in pilot, **When** they open « Supprimer mon compte », **Then** the panel lists what is deleted, says it is irreversible and that local data stays, and asks for the password.
2. **Given** the panel, **When** the pilot confirms with the right password, **Then** all documents of every subcollection (`logbook`, `igcTraces`, `equipment`, `stats`, `preferences`, `ice`, `access`, `pushState`) and `users/{uid}` are deleted, then the Auth account, and the signed-out view shows a confirmation.
3. **Given** the panel, **When** the pilot cancels, **Then** nothing is deleted and sync resumes.
4. **Given** the panel, **When** the password is empty or wrong, **Then** nothing is deleted and a French error asks for the right password.

### User Story 2 - A failure never leaves the pilot stuck or half-synced (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a network error during deletion, **When** it fails, **Then** a French error says the deletion is incomplete and offers « Réessayer » (same password field); automatic sync stays paused until the pilot retries or cancels, so it does not re-upload what was just deleted.
2. **Given** Firebase answers `auth/requires-recent-login` to the account deletion, **Then** the error asks the pilot to type their password again and retry (the app always re-authenticates first, so this is a fallback).
3. **Given** a deletion in progress, **Then** the automatic 30-second sync and the reconnect sync do not run.

## Requirements _(mandatory)_

- **FR-001**: The signed-in view of the Espace Synchro MUST offer « Supprimer mon compte », which opens a confirmation panel (no deletion on the first click).
- **FR-002**: The panel MUST state what is deleted, that it is irreversible, and that data on this device stays unless the pilot clears it.
- **FR-003**: Deletion MUST re-authenticate with the password first (`reauthenticateWithCredential`), so the later `deleteUser` does not hit `auth/requires-recent-login`.
- **FR-004**: Deletion MUST delete every document of every subcollection of `users/{uid}` that the app or the Cloud Function writes, including trace parts, then `users/{uid}`, then the Auth account (`deleteUser`).
- **FR-005**: `firestore.rules` MUST let the owner (and only the owner) delete `access/*` and read and delete `pushState/*`; writing them stays forbidden to the client.
- **FR-006**: Automatic sync MUST be paused from the start of a deletion until it succeeds (signed out) or the pilot cancels.
- **FR-007**: `deleteAccount` MUST return `{ success, data, error }`; the panel MUST show French errors from the catalogue with a retry.
- **FR-008**: After success, the device-side ICE online-backup state MUST be reset (the online copy no longer exists) and local data MUST otherwise stay untouched.
- **FR-009**: All new UI strings MUST live in the French catalogues (`js/i18n/fr.js`, `js/i18n/fr_html.js`).

## Success Criteria _(mandatory)_

- **SC-001**: After a successful deletion, 0 documents remain under `users/{uid}` (unit test on the fake Firestore) and the Auth account is deleted.
- **SC-002**: With a wrong password, 0 documents are deleted.
- **SC-003**: Rules tests on the emulator: the owner deletes `access/profile` and `pushState/*`, another pilot cannot, nobody can write them.

## User Manual Impact _(mandatory)_

- **Sections checked**: Général, « Vos données restent les vôtres » (`manualModal.ellesSontHebergeesSur`); Mon compte / Espace Synchro paragraphs of the same card; privacy policy (`components/legal_modals.html`, §4 retention and §5 rights).
- **Updates required**: the manual says how to delete the account from the Espace Synchro and that local data stays; the privacy policy says the same instead of « en nous contactant ».
- **Discord guide (`#guide-utilisation`)**: replace the sentence on deletion in the « Vos données restent les vôtres » part with the new one.

## Release Announcement _(mandatory)_

- **Availability**: All users with an account.
- **Discord notice**: yes (in the PR).

## Out of Scope

- A button that clears all local data on this device (follow-up).
- Deletion through a Cloud Function (rejected by the owner: no functions deploy).
