# Implementation Plan: Delete My Account and My Online Data

**Branch**: `feat/059-account-deletion` | **Spec**: [spec.md](spec.md)

## Summary

Client-side deletion in `FirebaseAuthEngine.deleteAccount(password)`: re-authenticate, pause sync,
delete every document under `users/{uid}`, reset the device ICE online state, then `deleteUser`.
A confirmation panel in the signed-in view of the Espace Synchro drives it. Rules allow the owner
to delete `access/*` and read/delete `pushState/*`.

## Technical Context

- Plain ES modules, Firebase JS SDK 12.19.0 hosted in `vendor/` (auth: `EmailAuthProvider`,
  `reauthenticateWithCredential`, `deleteUser`; Firestore: `collection`, `getDocs`, `doc`, `deleteDoc`).
- Sign-in is email + password only, so re-authentication asks for the password.
- Trace parts (`igcTraces/{flightId}_{0..11}`) have fixed ids: they are deleted by id for every
  logbook document (no download of up to 700 kB per part), then a final listing removes leftovers.
- Deletes run in chunks of 25 parallel `deleteDoc` calls.
- Order: re-auth → pause sync and wait for a sync in flight → delete subcollections → delete
  `users/{uid}` → reset ICE state → `deleteUser` (signs out; `onAuthStateChanged` updates the UI).
  Re-authenticating first means a wrong password deletes nothing.
- Testability: `_loadAuth` (like `_loadFirestore`) is injectable; `_getAuth`/`_getDb` hooks are not
  needed because the fake SDK ignores `auth`/`db`.

## Constitution Check

- I. UX/data integrity: explicit panel, irreversible warning, local data kept. OK.
- IV. Test first: Vitest (`tests/services/account_deletion.test.js`), rules emulator tests,
  Playwright (`tests/e2e/account_deletion.spec.js`, engine stubbed in the page: no real Firebase
  in e2e). OK.
- V. No data loss: local data untouched; sync paused so cloud deletion is not undone. OK.
- VI. Privacy: implements the right to erasure; rules stay owner-only. OK.
- VIII. `{ success, data, error }`; the modal is not a routed view, so its error state is the
  panel's alert with a « Réessayer » button (same pattern as the other auth errors). OK.
- Strings in the catalogues. OK.

## Deployment

Rules change: `npm run test:rules`, then deploy rules **before** the app is pulled on the Pi
(without them, deleting `access/profile` or listing `pushState` is refused and the deletion stops
with an error). No functions deploy.

## Complexity Tracking

None.
