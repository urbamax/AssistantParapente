# Contract: Hosted Firebase SDK

## Page (`js/services/firebase_service.js`)

- `FIREBASE_VERSION = '12.19.0'` is the only version constant for the page.
- Modules are loaded with dynamic `import()` from `vendor/firebase-<FIREBASE_VERSION>/firebase-{app,auth,firestore,messaging}.js`, resolved against the page address, and only once Firebase consent is granted (unchanged trigger).
- A failed load is not memoised (unchanged `createModuleLoader`).

## Service worker (`sw.js`)

- Imports only same-origin scripts: `./js/firebase_config.js`, `./vendor/firebase-12.19.0/firebase-app-compat.js`, `./vendor/firebase-12.19.0/firebase-messaging-compat.js`.
- A failure to import never prevents the rest of the worker (cache, navigation) from running.
- When `IS_FIREBASE_ENABLED`, `onBackgroundMessage(payload)` shows `payload.notification.title` (default « Assistant Parapente ») with body `payload.notification.body` (default empty) and the app icon.

## Network (before consent)

- Page and service worker: 0 requests to `*.gstatic.com`, `*.googleapis.com`, `*.google.com`.

## CSP (`index.html`)

- `script-src` has no `https://www.gstatic.com`.
- `connect-src` includes `https://fcmregistrations.googleapis.com` and `https://firebaseinstallations.googleapis.com`.
