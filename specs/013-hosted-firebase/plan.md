# Implementation Plan: Hosted Firebase SDK, Loaded Only After Consent

**Branch**: `feat/hosted-firebase` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/013-hosted-firebase/spec.md`

## Summary

Vendor the six Firebase 12.19.0 browser files taken from the official npm package (identical,
byte for byte, to the CDN copies) under `vendor/firebase-12.19.0/`, with the Apache 2.0 licence.
The three modular files that import `firebase-app.js` from www.gstatic.com get that single import
rewritten to `./firebase-app.js`; a hash test proves each hosted file is the official one (or the
official one plus that single rewrite). `js/services/firebase_service.js` loads the modular files
from the app (resolved against the page address so the built `dist/` works too) and still only
after consent; `sw.js` loads the two compat files from the app with `importScripts`, so the
service worker contacts no third party. CSP drops www.gstatic.com and adds the two FCM hosts that
token registration needs (post-consent only). A Chromium e2e test records page **and** service
worker requests and fails on any Google host before consent; a unit test runs `sw.js` in a
sandbox to check its imported scripts and background-message handler. Dependabot PR 43 is then
closed.

## Technical Context

**Language/Version**: JavaScript (ES2022 modules for the page, classic script for `sw.js`)
**Primary Dependencies**: Firebase JS SDK 12.19.0 (vendored browser bundles), Vite (optional build)
**Storage**: N/A (no data change)
**Testing**: Vitest (node environment for file hashes and the `sw.js` sandbox), Playwright (Chromium for service worker network events)
**Target Platform**: Modern browsers, mobile and desktop; served as source tree or `dist/`
**Project Type**: Web app without mandatory build
**Performance Goals**: No start-up cost for visitors without consent beyond first-party files; hosted files ≈ 1.07 MB (precached, same origin)
**Constraints**: No third-party request before consent (Principle VI); source tree must run without build (VII); offline must not regress (V)
**Scale/Scope**: 6 vendored files, 2 edited runtime files (`firebase_service.js`, `sw.js`), `index.html` CSP, build config comment, tests, docs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Note |
|-----------|--------|------|
| I. UX and data integrity | PASS | Sign-in, sync and background alerts unchanged for consenting pilots |
| II. Decision support | N/A | No weather verdict involved |
| III. Sourced content | N/A | No theory content |
| IV. Test-first | PASS | Hash test, version-agreement test, `sw.js` sandbox test and SW-aware e2e test written first and seen failing |
| V. Offline-first | PASS | Hosted files precached; `importScripts` from the app works offline, unlike the CDN |
| VI. Privacy and web security | PASS | Closes C1 (integrity) and the service-worker pre-consent call; CSP tightened (gstatic removed) |
| VII. No mandatory build | PASS | Plain files under `vendor/`; paths resolved at runtime work in source and `dist/` |
| VIII. Layered architecture | PASS | Loading stays in the service layer (`firebase_service.js`) |

Post-design re-check: PASS (no change).

## Project Structure

### Documentation (this feature)

```text
specs/013-hosted-firebase/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── hosted-sdk.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
vendor/firebase-12.19.0/
├── firebase-app.js              # official, unchanged
├── firebase-auth.js             # official, app import rewritten to ./firebase-app.js
├── firebase-firestore.js        # official, app import rewritten to ./firebase-app.js
├── firebase-messaging.js        # official, app import rewritten to ./firebase-app.js
├── firebase-app-compat.js       # official, unchanged (service worker)
├── firebase-messaging-compat.js # official, unchanged (service worker)
├── LICENSE                      # Apache License 2.0
└── README.md                    # origin, version, the single rewrite, how to update
js/services/firebase_service.js  # FIREBASE_VERSION = '12.19.0', loads from vendor/
sw.js                            # importScripts from ./vendor/firebase-12.19.0/, precache list
index.html                       # CSP: no gstatic; FCM hosts in connect-src
vite.config.mjs                  # comment update only (vendor/ already copied)
tests/core/firebase_sdk.test.js  # hashes, single rewrite, version agreement, no CDN address
tests/core/sw_firebase.test.js   # sw.js in a vm sandbox: imported scripts + background handler
tests/e2e/privacy.spec.js        # + page and service worker requests, no Google host
DOCUMENTATION.md
```

**Structure Decision**: same pattern as spec 009 (`vendor/<lib>-<version>/` + hash test).

## Complexity Tracking

None.
