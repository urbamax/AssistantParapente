# Feature Specification: Opened Courses and Viewed Map Offline

**Feature Branch**: `feat/offline-courses-map`

**Created**: 2026-09-29

**Status**: Draft

## Clarifications

### Session 2026-09-29

- Q: Which courses are kept offline? → A: Only the courses already opened; nothing is downloaded in advance (99 MB in total).
- Q: Which map is kept offline? → A: The map areas already displayed, with a size limit (no pre-download of an area: not allowed by the tile provider's terms).

**Input**: Constitution audit gap B2 (Principle V: « courses already opened » usable offline). Course PDFs deliberately bypass the service worker and are not kept; map tiles are requested without CORS, so the browser receives opaque responses that the app never stores; and every new version of the app deletes all its stored data except the new version's own files.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A course opened once stays readable offline (Priority: P1)

A pilot opened a course (from the library or a quiz « Voir dans le cours » link) with network. Later, without network, opening the same course shows it, at the same page link.

**Independent Test**: open a course PDF online, go offline, open it again: it is displayed.

**Acceptance Scenarios**:

1. **Given** a course opened once online, **When** it is opened offline, **Then** the full document is shown.
2. **Given** a course never opened, **When** it is opened offline, **Then** the browser shows its normal « no connection » error — never the app's home page in place of the document.
3. **Given** a new version of the app is installed, **When** the pilot goes offline, **Then** previously opened courses are still available.

### User Story 2 - The map areas already viewed stay visible offline (Priority: P2)

A pilot looked at the map around their area with network. Offline, the same areas of the map are displayed; areas never viewed stay blank.

**Independent Test**: display the map online, go offline, reload: the same map area is drawn.

**Acceptance Scenarios**:

1. **Given** map areas displayed online, **When** the pilot is offline, **Then** those areas are drawn.
2. **Given** many areas viewed over time, **When** the storage limit is reached, **Then** the oldest areas are dropped first and the app keeps working.
3. **Given** a new version of the app, **When** it is installed, **Then** stored map areas are kept.

### Edge Cases

- A course opened only partially by the reader (page by page): the whole document is stored once so it opens fully offline.
- Storage full or unavailable: courses and map behave as today (online only).
- Nothing is downloaded in advance: storage only grows with what the pilot actually opens or views.

## Requirements *(mandatory)*

- **FR-001**: A course document opened with network MUST be stored on the device in full and served offline, including when opened with a page anchor.
- **FR-002**: A course never opened MUST NOT be downloaded in advance.
- **FR-003**: When a course cannot be served (never opened, offline), the app MUST NOT show its home page in place of the document.
- **FR-004**: Map areas displayed with network MUST be stored and drawn offline.
- **FR-005**: Stored map areas MUST be limited in number; the oldest are removed first.
- **FR-006**: Stored courses and map areas MUST survive the installation of a new app version.

## Success Criteria *(mandatory)*

- **SC-001**: In an automated browser check, a course opened online is served offline in full (status success, full size).
- **SC-002**: In an automated browser check, map areas displayed online are available offline.
- **SC-003**: The number of stored map areas never exceeds the limit.

## Assumptions

- Map limit: 1 500 areas (≈ 35 MB at ≈ 23 KB each), enough for the pilot's region at several zoom levels.
- The tile provider (Esri) allows cross-origin access, so stored areas are normal (non-opaque) responses.
