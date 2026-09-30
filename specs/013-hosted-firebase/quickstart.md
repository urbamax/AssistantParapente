# Quickstart: Hosted Firebase SDK

## Automated

```bash
npx vitest run tests/core/firebase_sdk.test.js tests/core/sw_firebase.test.js
npx playwright test tests/e2e/privacy.spec.js --project=chromium
npm test && npm run test:e2e && npm run build
```

Expected: all green; `dist/vendor/firebase-12.19.0/` holds the six files.

## Manual (local, `static-server-nocache` on port 8001)

1. Fresh profile (or DevTools > Application > Clear site data). Open http://localhost:8001, **refuse** everything. DevTools > Network, include the service worker (Application > Service workers > "Network requests"): no request to gstatic.com / googleapis.com / google.com.
2. Accept online sync: Network shows `vendor/firebase-12.19.0/firebase-app.js`, `-auth.js`, `-firestore.js` from localhost, nothing from gstatic. Sign in, add a flight: it syncs.
3. Offline (DevTools > Network > Offline), reload: the app opens; the console shows no Firebase import error from the service worker.
4. Alerts (only once `FCM_VAPID_KEY` is set): enable alerts, close the tab, send a test message from the Firebase console: a notification appears with the sent title and text.
