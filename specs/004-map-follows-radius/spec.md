# Feature Specification: Map Framed on the Search Radius

**Feature Branch**: `fix/map-follows-radius`

**Created**: 2026-09-29

**Status**: Draft

**Root cause (found while reproducing)**: the map/radius sync reacts to every `moveend`, including automatic ones (map resize, tiles, programmatic framing). After the map frames the markers, such an event recomputes the radius from the view corners (farther than the radius), the radius grows, more sites appear, the map re-frames wider — a loop that ends at 200 km, even without favourites. The owner correctly pointed out that favourites were not the cause.

**Input**: Owner report: « La carte ne semble pas être centrée sur les 50 km autour de Boulogne ». With favourite sites far away (kept visible by spec 002), the map zooms out to show every marker (e.g. the whole of France) instead of the search area.

**Related**: spec 002 (radius 50 km default, Boulogne-sur-Mer fallback, favourites always kept); constitution Principle I (UX first).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The map shows the search area (Priority: P1)

A pilot opening the sites screen sees the map framed on the circle of the search radius around the reference position (their GPS position, their address, or Boulogne-sur-Mer), whatever favourites they have elsewhere.

**Why this priority**: the map is the first thing the pilot sees; zooming out to a whole country hides the local sites and contradicts the « 50 km » shown next to it.

**Independent Test**: with no position and a favourite 600 km away, open the sites screen: the map centre is Boulogne-sur-Mer and the view covers about 50 km around it, not the favourite.

**Acceptance Scenarios**:

1. **Given** no position and radius 50 km, **When** the sites screen opens, **Then** the map is centred on Boulogne-sur-Mer and shows the 50 km circle.
2. **Given** favourite sites outside the radius, **When** the map is framed, **Then** they do not change the framing (their markers stay on the map).
3. **Given** the pilot changes the radius, sets a GPS position or an address, **When** the list is updated, **Then** the map is framed on the new circle.
4. **Given** the pilot pans or zooms the map by hand, **When** nothing else changes, **Then** the app does not re-frame the map against the pilot's action (existing map/radius sync unchanged).

### Edge Cases

- No site at all in the radius: the circle is framed anyway (empty area, no zoom to the world).
- A search query filtering the list: the map stays on the circle.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Automatic map framing MUST use the circle of the current radius around the reference position (GPS, address, or Boulogne-sur-Mer), never the extent of all markers.
- **FR-002**: Favourite sites outside the radius MUST remain visible as markers but MUST NOT influence the framing.
- **FR-004**: The radius MUST follow the map only after the pilot's own pan or zoom gesture (drag, wheel, pinch, zoom buttons, keyboard); map resizes, tile loading and automatic framing MUST NOT change it.
- **FR-003**: Framing MUST happen when the map is created and whenever the list of sites is re-rendered for a change of radius, position or filters, but not in response to the pilot's own pan/zoom.

## Success Criteria *(mandatory)*

- **SC-002**: Without any interaction, the radius stays at 50 km 5 seconds after the sites screen opens, including after a window resize.
- **SC-001**: In an automated browser check with no position, radius 50 km and a favourite > 500 km away, the map centre is within 5 km of Boulogne-sur-Mer and the visible area does not contain the favourite.

## Assumptions

- A small margin around the circle is acceptable so markers on the edge stay visible.
- The existing map-to-radius sync (the radius follows a manual zoom) is kept.
