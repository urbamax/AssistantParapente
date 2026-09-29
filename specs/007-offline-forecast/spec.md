# Feature Specification: Last Forecast Available Offline

**Feature Branch**: `feat/offline-forecast`

**Created**: 2026-09-29

**Status**: Draft

**Input**: Constitution audit gap B1 (Principle V, offline-first). Forecasts are kept in memory only: after a reload or a restart without network (on take-off, in the mountains), the sites screen shows no forecast at all. The pilot should find the last downloaded forecast, clearly labelled with its retrieval time and as not current.

**Related**: Constitution v1.0.0 — Principles V (every feature usable offline, including « the last downloaded forecast, shown with its timestamp and flagged as not current ») and I/II (age of a forecast shown explicitly); spec 002 (context line, 3 h staleness flag, « Actualiser »); spec 001 (incomplete hours).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Last forecast after an offline restart (Priority: P1)

A pilot loaded the forecasts at home. On the take-off, without network, they open the app: the sites show the last downloaded forecast for the remaining hours, with its model and retrieval time, and a clear notice that the app is offline and the forecast may be outdated.

**Why this priority**: the constitution requires it; it is exactly when there is no network that the pilot needs the last information they had.

**Independent Test**: load the sites online, go offline, reload: verdicts appear for future hours, labelled with the original retrieval time, with an offline notice.

**Acceptance Scenarios**:

1. **Given** forecasts downloaded online, **When** the app is reopened offline, **Then** the sites show the last forecast for hours not yet past, with the original model and retrieval time (context line from spec 002).
2. **Given** the app is offline and shows a saved forecast, **When** the pilot looks at any verdict, **Then** a notice says the app is offline and the forecast was retrieved at {date/time}, and may be outdated.
3. **Given** a saved forecast older than 3 hours, **When** it is shown, **Then** the staleness warning of spec 002 applies as for any forecast.
4. **Given** hours of the saved forecast that are already past, **When** it is restored, **Then** they are not shown; the timeline starts at the current hour.
5. **Given** the network comes back, **When** the pilot refreshes or the app loads forecasts, **Then** fresh forecasts replace the saved ones and the offline notice disappears.

---

### User Story 2 - Honest about what is not available offline (Priority: P2)

A site that was never loaded (e.g. outside the radius at download time) shows no invented forecast offline; the model comparison (spec 002) is shown as unavailable offline.

**Acceptance Scenarios**:

1. **Given** a site without saved forecast, **When** offline, **Then** its card says the forecast is unavailable offline.
2. **Given** a saved forecast, **When** offline, **Then** the model comparison is « indisponible ».

### Edge Cases

- A saved forecast older than 8 days (the forecast window) has no future hour: nothing is shown for it, and it is removed from storage.
- The pilot changed model since the last download: the saved forecast keeps and shows its own model.
- Storage unavailable (private browsing, quota): the app works as today, without saved forecasts.
- Saving must not slow the display of fresh forecasts.

## Requirements *(mandatory)*

- **FR-001**: After each successful forecast download, the app MUST save, on the device, each site's forecast with its model and retrieval time.
- **FR-002**: When forecasts cannot be downloaded (offline or provider failure) and no forecast is loaded in memory, the app MUST restore the saved forecasts.
- **FR-003**: Restored forecasts MUST keep their original model and retrieval time, and MUST NOT include hours already past.
- **FR-004**: While a restored forecast is shown, the sites screen MUST display a notice stating that the app is offline (or that the service is unavailable) and when the forecast was retrieved.
- **FR-005**: Saved forecasts with no future hour MUST NOT be shown and MUST be removed.
- **FR-006**: The model comparison MUST be « indisponible » for restored forecasts.
- **FR-007**: A failure to save or read saved forecasts MUST NOT break the sites screen.

## Success Criteria *(mandatory)*

- **SC-001**: In an automated browser check (load online, reload offline), 100 % of sites loaded online show a verdict for the current hour offline, labelled with the original retrieval time and the offline notice.
- **SC-002**: 0 past hours are shown from a restored forecast.

## Assumptions

- The device's IndexedDB storage is used (the forecast of hundreds of sites over 8 days is too large for LocalStorage); it already holds the logbook.
- One saved forecast per site (the latest download); sites downloaded at different times keep their own retrieval times.
- Offline map tiles and courses (audit B2) are out of scope.
