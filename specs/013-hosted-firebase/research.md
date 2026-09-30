# Research: Hosted Firebase SDK

## R1. Where the files come from

- **Decision**: take `firebase-app.js`, `firebase-auth.js`, `firebase-firestore.js`, `firebase-messaging.js`, `firebase-app-compat.js` and `firebase-messaging-compat.js` from the root of the official npm package `firebase@12.19.0` (`npm pack`). No source maps.
- **Rationale**: checked on 2026-09-30: each of the six files is byte-identical (SHA-384) to `https://www.gstatic.com/firebasejs/12.19.0/<file>`, so the hosted copies are exactly what the app used from the CDN, at the version proposed by PR 43.
- **Alternatives**: downloading from gstatic directly (same bytes, but npm gives a signed, versioned package); bundling with Vite (would make a build mandatory, Principle VII).

## R2. The modular files import `firebase-app.js` from gstatic

- **Finding**: `firebase-auth.js`, `firebase-firestore.js` and `firebase-messaging.js` each start with `import {…} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"`. Hosted unchanged, they would still contact gstatic and, worse, load a second copy of the app module, so `getAuth(app)` would not find the app created from the hosted copy. `firebase-app.js` contains the gstatic address only as a logger / component name string (no request). The compat files contain no import.
- **Decision**: in the three files, rewrite exactly that one import specifier to `./firebase-app.js`. Record the SHA-384 of each hosted file **and** of the official file; the test checks the hosted hash, and that reversing the single rewrite gives the official hash (proving nothing else changed).
- **Alternatives**: an import map in `index.html` mapping the gstatic URL to the local file (keeps files untouched, but hides the redirection in HTML, depends on import-map support and still leaves a gstatic address in the loaded code); keeping gstatic after consent (rejected by the owner: C1 and one version for everything).

## R3. Loading path that works in source and in `dist/`

- **Decision**: in `firebase_service.js`, build the URL with `new URL('vendor/firebase-12.19.0/<file>', document.baseURI).href`, keep the dynamic `import()` behind consent as today. `FIREBASE_VERSION` stays the single constant; the directory name derives from it.
- **Rationale**: the page is always `index.html` at the site root (source and `dist/`), `vendor/` is copied as-is into `dist/` (`STATIC_PATHS`), and a non-literal `import()` is left alone by Vite. A path relative to the module (`import.meta.url`) would break once Vite bundles the module into `assets/`.

## R4. Service worker

- **Decision**: `importScripts('./vendor/firebase-12.19.0/firebase-app-compat.js', './vendor/firebase-12.19.0/firebase-messaging-compat.js')` at top level (still in the existing try/catch). A `FIREBASE_SDK_DIR` constant in `sw.js` holds the folder; a test checks it matches `FIREBASE_VERSION`.
- **Rationale**: `importScripts` must run during the worker's first evaluation, before consent can be known (a worker cannot read `localStorage`). Loading first-party files is not a third-party call (Principle VI); initialising compat messaging only registers push listeners, it makes no request until the page asks for a token (post-consent). The browser stores imported scripts with the worker, so they also work offline, unlike the CDN version.
- **Alternatives**: a module service worker with `firebase-messaging-sw.js` (bigger change, WebKit support of module workers and `importScripts` semantics differ); asking the page to post consent to the worker and loading later (not possible: late `importScripts` of new URLs throws).

## R5. Precache

- **Decision**: add the six hosted files to `CRITICAL_ASSETS` in `sw.js` (the build already precaches everything under `vendor/`).
- **Rationale**: Principle V (offline for everything): a consenting pilot opening the app offline still gets the account code; first-party only, ≈ 1.07 MB once per version.

## R6. Security policy (CSP)

- **Decision**: remove `https://www.gstatic.com` from `script-src`; keep `https://apis.google.com` (Google sign-in window, after consent); add `https://fcmregistrations.googleapis.com` and `https://firebaseinstallations.googleapis.com` to `connect-src`.
- **Rationale**: the FCM token request goes to those two hosts; they were missing, so alert activation could not succeed once the VAPID key is configured (today `FCM_VAPID_KEY` is empty, so the path is not reachable yet). Only contacted after consent and an explicit "enable alerts" click.

## R7. Seeing service worker requests in tests

- **Decision**: in Playwright 1.62, Chromium reports service worker network requests on the browser context (`context.on('request')`, `request.serviceWorker()`). The new e2e test enables the service worker (spec 009's test blocks it), waits until it controls the page, and fails on any request to `*.gstatic.com`, `*.googleapis.com` or `*.google.com` from page or worker. Chromium only (same limit as spec 008 for WebKit).
- **Complement**: `tests/core/sw_firebase.test.js` runs `sw.js` in a Node `vm` sandbox with a stub `importScripts`, `self` and `firebase`, and checks the imported URLs are all first-party and that the background-message handler shows the notification with the server's title and body.

## R8. PR 43

- **Decision**: close Dependabot PR 43 with a comment linking this feature once it is merged. Dependabot cannot update vendored files; `vendor/firebase-12.19.0/README.md` documents the manual update steps (pack, compare to CDN, rewrite, update hashes and version).
