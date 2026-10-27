# Feature Specification: Map Marker Jumps to Site Card

**Feature Branch**: `fix/map-marker-jumps-to-card`

**Created**: 2026-10-27

**Status**: Implemented

**Input**: User description: "Cliquer sur un spot sur la carte de sites dois nous emmener a l'endroit dans la page où se trouve la \"carte\" du site avec ses infos"

## Problem

On the Sites screen, clicking a site marker on the Leaflet map currently calls `spotSite(...)`, which scrolls back to the top of the map view and switches the map mode to Windy. Meanwhile, `SitesListBase.jumpToSiteCard(siteId)` already exists to scroll smoothly to `#site-card-${siteId}` and apply the `.highlight-glow` animation, but:
1. The marker click handler calls `this.spotSite(...)` instead of `this.jumpToSiteCard(site.id)`.
2. The `.site-card` elements rendered in `SitesListBase.renderList()` are missing the `id="site-card-${site.id}"` attribute required by `jumpToSiteCard`.

As a result, clicking a spot on the map does not take the pilot to the corresponding site card in the list below.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Jump from map marker to site card (Priority: P1)

The pilot clicks a site marker on the Leaflet map of the Sites screen. The page smoothly scrolls to the corresponding site card in the list below and briefly highlights it so the pilot can immediately read the site's weather and details.

**Why this priority**: Core navigation flow requested by the user between the overview map and the detailed site cards.

**Independent Test**: Render the Sites map markers and site cards, click a marker, and verify that the corresponding `#site-card-<id>` element is scrolled into view and receives the `highlight-glow` class.

**Acceptance Scenarios**:

1. **Given** the Sites screen with active sites rendered on the Leaflet map and in the list, **When** the pilot clicks a site marker on the map, **Then** the page scrolls smoothly to `#site-card-${site.id}` (`block: 'center'`) and highlights the card with `.highlight-glow`.
2. **Given** a site card in the list, **When** the pilot clicks the "Spot It" button on the card itself, **Then** `spotSite(...)` still scrolls to the top map view and loads the embedded maps for that site (unchanged).

### Edge Cases

- The clicked marker belongs to a site beyond the 50-card render limit or not currently in the DOM: `jumpToSiteCard` checks `if (target)` safely and does nothing without throwing.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each rendered `.site-card` element in `SitesListBase.renderList()` MUST carry `id="site-card-${site.id}"`.
- **FR-002**: Clicking a marker on the Leaflet map (`SitesMapBase.updateMapMarkers()`) MUST call `this.jumpToSiteCard(site.id)`.
- **FR-003**: The "Spot It" button on site cards MUST continue to call `spotSite(...)` as before.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Clicking a map marker scrolls to `#site-card-${site.id}` with `{ behavior: 'smooth', block: 'center' }` and adds `.highlight-glow`.
- **SC-002**: All unit tests, snapshots, lint, format check, and typecheck pass.
