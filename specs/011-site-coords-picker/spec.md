# Feature Specification: Place a Manually Entered Site on a Map

**Feature Branch**: `feat/site-coords-picker`

**Created**: 2026-09-30

**Status**: Implemented

**Input**: Owner request: « lors de l'ajout d'un site manuellement dans l'ajout, il serait intéressant de proposer de placer les coordonnées GPS dans une carte (Google par exemple), pour avoir les bonnes coordonnées ». Today a place typed in the logbook form that is not in the site database (e.g. a training field) has no coordinates: its weather cannot be fetched (except by geolocation for a session of the same day).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pick the place on a map (Priority: P1)

In the « Ajouter » tab (flight or ground handling), the pilot types a place that is not in the database, opens « Placer sur la carte », clicks the exact spot (topographic or satellite view), and saves. The session keeps these coordinates and its weather is fetched for them.

**Independent Test**: type an unknown place, open the map, click on it, save: the stored session has `lat`/`lon` equal to the clicked point, and the weather is requested for them.

**Acceptance Scenarios**:

1. **Given** the add form, **When** the pilot opens « Placer sur la carte », **Then** a map appears, centred on the typed site if it is known, on the already chosen point if any, otherwise on France.
2. **Given** the open map, **When** the pilot clicks (or drags the pin), **Then** the pin moves there and the coordinates field shows « lat, lon » with 5 decimals.
3. **Given** coordinates copied from Google Maps or elsewhere (« 50.68123, 1.59234 », degrees-minutes-seconds such as « 50°40'52.4"N 1°35'32.4"E », or a Google Maps link containing `@lat,lon`), **When** they are pasted in the coordinates field, **Then** the pin moves there (keyboard equivalent of the map).
4. **Given** chosen coordinates, **When** the session is saved, **Then** it stores them and its weather uses them (a GPS track still takes precedence for a flight).
5. **Given** a session with coordinates being edited, **When** the form opens, **Then** the field shows them; **When** the pilot removes the point and saves, **Then** the coordinates are removed.
6. **Given** a place already saved with coordinates in an earlier session and absent from the database, **When** the pilot types it again, **Then** its coordinates are proposed automatically.

### Edge Cases

- Unreadable or out-of-range text in the coordinates field: an error message is shown and the session is not saved.
- Switching between « Vol » and « Gonflage » keeps the chosen coordinates.
- Offline: the coordinates field works; the map shows the tiles already cached.
- No third party is contacted until the pilot opens the map (spec 009).

## Requirements *(mandatory)*

- **FR-001**: The flight and ground handling forms MUST offer « Placer sur la carte » next to the place field, opening an inline map (Leaflet, already bundled, same Esri tiles as the Sites map, plus a satellite layer from the same host).
- **FR-002**: Clicking the map or dragging the pin MUST set the coordinates; the coordinates field MUST accept decimal, degrees-minutes-seconds and Google Maps link formats.
- **FR-003**: Saved coordinates MUST be stored as `lat`/`lon` on the session and used for its weather; an imported GPS track overrides them.
- **FR-004**: Editing MUST show existing coordinates; emptying them MUST remove them on save; invalid text MUST block the save with a message.
- **FR-005**: For a place absent from the site database, the coordinates of the latest earlier session with the same name MUST be proposed.
- **FR-006**: The map MUST be created only on demand and released when the form is reset, re-rendered or the view unmounted.
- **FR-007**: User-facing texts MUST live in `js/i18n/fr.js`.

## Success Criteria *(mandatory)*

- **SC-001**: A session saved after a map click or a pasted coordinate stores those coordinates (e2e test).
- **SC-002**: The coordinate parser accepts the three formats and rejects out-of-range or unreadable input (unit tests).

## Assumptions

- Google Maps itself is not embedded: it needs an API key and would contact Google; the bundled Leaflet map with a satellite layer gives the same precision, and Google Maps coordinates can still be pasted.
- Coordinates are not added to the shared site database; they belong to the pilot's sessions.
