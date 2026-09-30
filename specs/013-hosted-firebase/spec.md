# Feature Specification: Hosted Firebase SDK, Loaded Only After Consent

**Feature Branch**: `feat/hosted-firebase`

**Created**: 2026-09-30

**Status**: Draft

**Input**: Constitution audit gap C1 (Firebase SDK loaded from a CDN without integrity check) and a gap found while reviewing Dependabot PR 43: the service worker (`sw.js`) loads the Firebase SDK from www.gstatic.com at install time, for every visitor, before any consent (Principle VI). Spec 009's network test did not see it because it only watches the page's requests, not the service worker's. The owner chose to host the SDK in the app at version 12.19.0 instead of merging PR 43 (10.12.0 → 12.19.0 on the CDN).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - No Google server contacted without consent (Priority: P1)

A pilot opens the app and refuses online sync (or has not chosen yet). Neither the page nor the app's background worker contacts a Google server to download the Firebase SDK. Their IP address is never sent to Google because of a feature they did not accept.

**Why this priority**: it is a constitution breach (Principle VI) affecting every visitor, on every first visit and every app update.

**Independent Test**: load the app with sync refused, let the background worker install and activate, and record every request made by the page and by the worker: none goes to www.gstatic.com or any other Google host.

**Acceptance Scenarios**:

1. **Given** a first visit with no consent, **When** the app loads and its background worker installs, **Then** no request goes to www.gstatic.com (or any Google host).
2. **Given** sync refused, **When** the pilot uses the app (quiz, courses, sites, logbook), **Then** no request goes to a Google host.
3. **Given** a new app version, **When** the background worker updates, **Then** it still makes no request to a Google host.

---

### User Story 2 - Sync and notifications keep working for consenting pilots (Priority: P1)

A pilot who accepted online sync signs in, syncs their logbook and progress, and receives weather alerts for their favourite sites, exactly as before, now with the SDK served by the app itself at version 12.19.0.

**Why this priority**: hosting the SDK must not break the account, sync or alerts that pilots rely on (Principle I).

**Independent Test**: with sync accepted, check that the SDK files load from the app's own address, that sign-in and sync start, and that the background worker can display an alert received while the app is closed.

**Acceptance Scenarios**:

1. **Given** sync accepted, **When** the account features start, **Then** the SDK files come from the app itself, version 12.19.0.
2. **Given** a signed-in pilot, **When** they add a flight, **Then** it syncs as before.
3. **Given** alerts enabled and the app closed, **When** an alert arrives, **Then** a notification is shown with the title and text sent by the server.

---

### User Story 3 - Hosted SDK files are the genuine ones (Priority: P2)

The owner can trust that the SDK files served by the app are exactly the official 12.19.0 release, and any accidental or malicious change is caught by the automated checks.

**Why this priority**: closes audit gap C1 (no integrity check on Firebase).

**Independent Test**: the automated test suite fails if any hosted SDK file differs from the recorded fingerprint of the official release.

**Acceptance Scenarios**:

1. **Given** the hosted SDK files, **When** the tests run, **Then** each file matches its recorded fingerprint.
2. **Given** one byte changed in a hosted SDK file, **When** the tests run, **Then** they fail and name the file.
3. **Given** the app's code, **When** searched, **Then** no Firebase SDK address on www.gstatic.com remains, and a single version number is used everywhere.

### Edge Cases

- Pilot offline when the background worker installs: the worker must still install and keep serving the app offline (specs 007 and 008 unchanged).
- Firebase disabled in the configuration: nothing Firebase-related is loaded or started, as today.
- Consent withdrawn after sync was accepted: the app stops sync as today; no new Google request is triggered by the SDK loading.
- Existing pilots whose browser already holds the old worker: the update replaces it cleanly and the old CDN addresses are no longer used.
- The sign-in window itself (Google sign-in) necessarily talks to Google: allowed, since the pilot explicitly chose to sign in after accepting sync.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST NOT load the Firebase SDK from www.gstatic.com or any other third-party server, neither from the page nor from the background worker.
- **FR-002**: The background worker MUST NOT contact any third-party server before consent to online sync; loading SDK files from the app's own address is allowed.
- **FR-003**: The Firebase SDK files needed by the app (app, authentication, database, messaging) and by the background worker (app and messaging, in the form a classic worker can load) MUST be served by the app, at version 12.19.0, with the SDK licence notice kept.
- **FR-004**: The SDK version MUST be defined once for the page code; the background worker MUST use the same version, and a test MUST fail if they differ.
- **FR-005**: Each hosted SDK file MUST have a recorded fingerprint checked by the automated tests (integrity).
- **FR-006**: The page's security policy MUST no longer allow scripts from www.gstatic.com.
- **FR-007**: An automated browser test MUST record the background worker's requests as well as the page's, and fail on any request to a Google host before consent.
- **FR-008**: Sign-in, sync and background alerts MUST keep working for pilots who accepted sync.
- **FR-009**: Offline behaviour (app shell, saved forecast, opened courses, displayed map areas) MUST NOT regress.
- **FR-010**: The build output (`dist/`) MUST contain the hosted SDK files like the other hosted libraries.

### Key Entities

- **Hosted SDK file**: a Firebase SDK file served by the app; has a path, the SDK version and a recorded fingerprint.

## Success Criteria *(mandatory)*

- **SC-001**: In an automated browser check covering page and background worker, 0 requests to a Google host during a first visit without consent, including worker install and activation.
- **SC-002**: 100 % of hosted SDK files match their recorded fingerprint; changing any one of them makes the tests fail.
- **SC-003**: 0 occurrences of the Firebase CDN address in the app's code.
- **SC-004**: All existing automated tests (unit and browser) still pass, including the offline ones.

## Assumptions

- Version 12.19.0 is the one proposed by Dependabot PR 43; PR 43 will be closed with a comment pointing to this feature.
- The SDK files are taken from the official `firebase` package published on npm for 12.19.0 (the same files the CDN serves).
- The Cloud Function (`functions/`) uses its own server-side Firebase packages and is out of scope.
- Google sign-in, Firestore and messaging servers remain third-party by nature; they are only contacted after the pilot accepts sync, as today.
- A real push notification cannot be sent in the automated tests; the background alert path is checked by a unit test of the worker's handler and a manual check listed in the quickstart.
