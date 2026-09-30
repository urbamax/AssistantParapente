# Firebase JS SDK 12.19.0 (hosted copy)

Hosted by the app so that no request goes to www.gstatic.com (spec 013, constitution Principle VI).
Licence: Apache License 2.0 (`LICENSE`). Copyright Google LLC.

## Origin

Files taken from the root of the official npm package `firebase@12.19.0` (`npm pack firebase@12.19.0`).
Checked on 2026-09-30: each file is byte-identical to `https://www.gstatic.com/firebasejs/12.19.0/<file>`.

| File | Used by | Change |
|------|---------|--------|
| `firebase-app.js` | page (after consent) | none |
| `firebase-auth.js` | page (after consent) | app import rewritten |
| `firebase-firestore.js` | page (after consent) | app import rewritten |
| `firebase-messaging.js` | page (after consent) | app import rewritten |
| `firebase-app-compat.js` | service worker (`importScripts`) | none |
| `firebase-messaging-compat.js` | service worker (`importScripts`) | none |

The only change: in three files, `from"https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"`
becomes `from"./firebase-app.js"`, so that they share the hosted app module instead of loading a
second copy from gstatic. `tests/core/firebase_sdk.test.js` checks every file against the official
SHA-384 (after undoing that single rewrite).

## Updating to a new version

1. `npm pack firebase@<version>` and extract it.
2. Compare the six files with `https://www.gstatic.com/firebasejs/<version>/<file>`.
3. Create `vendor/firebase-<version>/` with the six files, this README and `LICENSE`; apply the same rewrite (with the new version in the address).
4. Update the official hashes and `VERSION` in `tests/core/firebase_sdk.test.js`, `FIREBASE_VERSION` in `js/services/firebase_service.js`, `FIREBASE_SDK_DIR` and the precache list in `sw.js`.
5. Remove the old folder and run all tests.
