# Data Model: Hosted Firebase SDK

No stored user data changes.

## Hosted SDK file

| Field | Description |
|-------|-------------|
| path | `vendor/firebase-12.19.0/<name>.js` |
| role | `page` (modular ES module, loaded after consent) or `worker` (compat classic script, `importScripts`) |
| officialSha384 | SHA-384 (base64) of the file in `firebase@12.19.0` / on gstatic |
| hostedSha384 | SHA-384 of the hosted file (equals `officialSha384` when unchanged) |
| rewrite | none, or `https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js` → `./firebase-app.js` |

Validation: reversing `rewrite` on the hosted bytes gives `officialSha384`; the version in the path equals `FIREBASE_VERSION` in `js/services/firebase_service.js` and the folder in `sw.js`.
