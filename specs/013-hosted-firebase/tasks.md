# Tasks: Hosted Firebase SDK, Loaded Only After Consent

**Input**: Design documents from `specs/013-hosted-firebase/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/hosted-sdk.md, quickstart.md

**Tests**: required (Constitution IV, test-first): each test task is written and seen failing before its implementation task.

## Phase 1: Setup

- [X] T001 Download `firebase@12.19.0` with `npm pack` into the scratchpad, check each of the six files (`firebase-app.js`, `firebase-auth.js`, `firebase-firestore.js`, `firebase-messaging.js`, `firebase-app-compat.js`, `firebase-messaging-compat.js`) is byte-identical to `https://www.gstatic.com/firebasejs/12.19.0/<file>`, and record each official SHA-384 (base64) for T003

## Phase 2: Foundational

- [X] T002 Write `tests/core/firebase_sdk.test.js` (Vitest, node environment): for each hosted file in `vendor/firebase-12.19.0/`, hosted SHA-384 matches the recorded value; reversing the single rewrite (`./firebase-app.js` → `https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js`, only in the import of auth, firestore and messaging) gives the official SHA-384; `vendor/firebase-12.19.0/LICENSE` exists; run it and see it fail (folder missing)
- [X] T003 Create `vendor/firebase-12.19.0/` with the six files; in `firebase-auth.js`, `firebase-firestore.js` and `firebase-messaging.js` rewrite exactly the one `from"https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"` specifier to `./firebase-app.js`; add `LICENSE` (Apache License 2.0 full text) and `README.md` (origin, version, the single rewrite, update steps); fill the hashes in T002's test and see it pass

## Phase 3: User Story 1 - No Google server contacted without consent (P1) 🎯 MVP

**Goal**: neither the page nor the service worker contacts a Google host before consent.
**Independent Test**: T004 and T005 pass.

- [X] T004 [P] [US1] Write `tests/core/sw_firebase.test.js` (Vitest, node): run `sw.js` in a `node:vm` sandbox with stubs for `self` (addEventListener, registration.showNotification), `importScripts` (records URLs and defines `firebase`, `FIREBASE_CONFIG`, `IS_FIREBASE_ENABLED` as needed), `caches`, `fetch`, `location`; assert every imported URL is relative (same origin), none contains `gstatic`, and the compat files are `./vendor/firebase-12.19.0/firebase-app-compat.js` and `./vendor/firebase-12.19.0/firebase-messaging-compat.js`; with `IS_FIREBASE_ENABLED = false`, `firebase.initializeApp` is never called; see it fail
- [X] T005 [P] [US1] Add to `tests/e2e/privacy.spec.js` a test with the service worker allowed (Chromium only, skip on WebKit as in spec 008): consent refused under `parapente_gdpr_consent` (`version: 2026`), record `context.on('request')` (page and service worker), open `/`, wait for the worker to control the page, open `/?mode=SITES`, wait for network idle; expect 0 URLs matching `gstatic.com|googleapis.com|google.com`; see it fail on the current `sw.js`
- [X] T006 [US1] In `sw.js`, add `const FIREBASE_SDK_DIR = './vendor/firebase-12.19.0/';` and import the two compat files from it (same try/catch, comment updated); add the six hosted files to `CRITICAL_ASSETS`; T004 and T005 pass
- [X] T007 [US1] In `index.html` CSP, remove `https://www.gstatic.com` from `script-src`

## Phase 4: User Story 2 - Sync and notifications keep working (P1)

**Goal**: consenting pilots get the SDK from the app, version 12.19.0; sign-in, sync and background alerts work.
**Independent Test**: T008–T010 pass; quickstart manual steps 2–4.

- [X] T008 [P] [US2] Extend `tests/core/sw_firebase.test.js`: with `IS_FIREBASE_ENABLED = true`, the handler given to `onBackgroundMessage` calls `self.registration.showNotification` with `payload.notification.title` (default « Assistant Parapente » when missing), body `payload.notification.body` (default empty) and icon `./img/icons/icon-192x192.png`; an `importScripts` that throws does not stop the rest of `sw.js` (install listener still registered)
- [X] T009 [P] [US2] Extend `tests/core/firebase_sdk.test.js`: `FIREBASE_VERSION` in `js/services/firebase_service.js` is `12.19.0` and equals the version in `FIREBASE_SDK_DIR` of `sw.js` and the `vendor/` folder name; no `gstatic.com/firebasejs` address remains in `js/`, `sw.js` or `index.html`; see it fail
- [X] T010 [US2] In `js/services/firebase_service.js`, set `FIREBASE_VERSION = '12.19.0'` and build the loader URLs as `new URL(\`vendor/firebase-${FIREBASE_VERSION}/<file>\`, document.baseURI).href` (comment: resolved against the page so it works in source and `dist/`); loaders and consent gating unchanged; T009 passes
- [X] T011 [US2] In `index.html` CSP, add `https://fcmregistrations.googleapis.com https://firebaseinstallations.googleapis.com` to `connect-src` (alert token request, after consent)
- [X] T012 [US2] Check in a browser (`static-server-nocache`, port 8001) with sync accepted: the three modular files load from `vendor/firebase-12.19.0/`, Firebase initialises without console error; with sync refused, no request to a Google host

## Phase 5: User Story 3 - Hosted SDK files are the genuine ones (P2)

**Goal**: integrity of the hosted SDK is enforced by tests (closes C1).
**Independent Test**: changing one byte of a hosted file makes `tests/core/firebase_sdk.test.js` fail and name the file.

- [X] T013 [US3] Temporarily change one byte of `vendor/firebase-12.19.0/firebase-auth.js`, confirm the test fails naming the file, then restore it

## Phase 6: Polish & Cross-Cutting

- [X] T014 [P] Update the comment in `vite.config.mjs` (the Firebase SDK is hosted in `vendor/`, copied as-is); run `npm run build` and check `dist/vendor/firebase-12.19.0/` holds the six files and `dist/sw.js` imports them
- [X] T015 [P] Update `DOCUMENTATION.md` (hosted Firebase, update procedure) and mark C1 as fixed in `.specify/audits/2026-09-29-constitution-audit.md`
- [X] T016 Run lint, format check, typecheck, `npm test`, `python3 -m unittest`, `npm run test:e2e` (Chromium and WebKit, including offline tests of specs 007/008)

## Dependencies

- T001 → T002 → T003 → all stories.
- US1 (T004–T007) and US2 (T008–T012) are independent after T003; US3 (T013) needs T003.
- Polish after all stories.

## Parallel Opportunities

- T004 and T005 (different files); T008 and T009 (different files); T014 and T015.

## Implementation Strategy

MVP = Phase 1–3 (privacy gap closed). Then US2 (version and loading path), US3 (integrity proof), polish. One PR for the whole feature; PR 43 closed after merge.
