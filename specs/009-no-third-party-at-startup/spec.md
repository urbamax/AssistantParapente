# Feature Specification: No Third-Party Request Before Consent

**Feature Branch**: `fix/privacy-third-parties`

**Created**: 2026-09-29

**Status**: Draft

## Clarifications

### Session 2026-09-29

- Q: How far to remove third-party requests at start-up? → A: Host everything in the app (owner followed the recommendation): fonts, icons, map library and logos.
- Q: Font? → A: Keep Inter, hosted in the app.
- Owner approved downloading: Inter (latin), Remix Icon 3.5.0, Leaflet 1.9.4, the club logo and the FFVL logo.

**Input**: Constitution audit gaps C2, C3, C4 (Principle VI). At start-up, before any consent, the app contacts five third-party servers (Google Fonts, jsDelivr, unpkg, WordPress, federation.ffvl.fr), each receiving the visitor's IP address. Five footer links open in a new tab without `rel="noopener noreferrer"`. A leftover Google Analytics identifier sits in the Firebase configuration.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Opening the app contacts no third party (Priority: P1)

A pilot opens the app for the first time. Until they give consent or use a feature that needs an external service (weather, map, address search, account), no request leaves for a third-party server.

**Independent Test**: load the home and sites pages with all non-app hosts blocked except those the feature itself needs; the page looks the same (fonts, icons, logos, map library) and no request to Google Fonts, jsDelivr, unpkg, WordPress or federation.ffvl.fr is made.

**Acceptance Scenarios**:

1. **Given** a first visit, **When** the home page loads, **Then** no request goes to fonts.googleapis.com, fonts.gstatic.com, cdn.jsdelivr.net, unpkg.com, wordpress.com or federation.ffvl.fr.
2. **Given** the sites page, **When** the map is displayed, **Then** the map library comes from the app itself (map tiles and weather still come from their providers, as today).
3. **Given** the app's look, **When** compared with before, **Then** fonts, icons, logos and map controls look the same.

### User Story 2 - Safe external links and no analytics identifier (Priority: P2)

1. **Given** the footer, **When** any link opens a new tab, **Then** it has `rel="noopener noreferrer"`.
2. **Given** the Firebase configuration, **When** read, **Then** it contains no Google Analytics identifier.

### Edge Cases

- The integrity (SRI) hashes of Leaflet and Remix Icon files must match the hashes already used in `index.html`, proving the hosted copies are the audited ones.
- Offline: the hosted files are available like any app file.

## Requirements *(mandatory)*

- **FR-001**: The app MUST NOT load any font, stylesheet, script or image from a third-party server at start-up.
- **FR-002**: Inter, Remix Icon 3.5.0, Leaflet 1.9.4 and the two logos MUST be served from the app, with their licence notices kept.
- **FR-003**: Hosted Leaflet and Remix Icon files MUST be identical to the versions previously loaded (same integrity hashes).
- **FR-004**: Every `target="_blank"` link MUST have `rel="noopener noreferrer"`.
- **FR-005**: The Firebase configuration MUST NOT contain a Google Analytics identifier.
- **FR-006**: The hosted files MUST be part of the offline app files (precache).

## Success Criteria *(mandatory)*

- **SC-001**: In an automated browser check, 0 requests to the five listed third-party hosts during home and sites page loads.
- **SC-002**: 0 `target="_blank"` links without `rel="noopener noreferrer"` in the app's HTML (automated check).

## Assumptions

- Weather (Open-Meteo), map tiles (Esri), address search (Nominatim), embedded maps (Windy…) and Firebase remain third-party by nature; they are used when the pilot uses those features, as today.
