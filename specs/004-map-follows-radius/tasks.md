# Tasks: Map Framed on the Search Radius

**Tests**: REQUIRED (constitution Principle IV).

- [X] T001 [US1] In `tests/e2e/sites_flow.spec.js`, add a scenario: saved favourite `sorgia-601` (≈ 600 km away), no position, radius 50 km; after the sites screen loads, `SitesView.state.map.getCenter()` is within 5 km of Boulogne-sur-Mer (50.7264, 1.6147), the map bounds do not contain the favourite, and the bounds contain the points 45 km north and south of Boulogne-sur-Mer
- [X] T001b [US1] In `tests/e2e/sites_flow.spec.js`, add a scenario without favourites: 5 s after the sites screen opens, and again after `page.setViewportSize` to a different size, `#radius-val-label` still reads « 50 km » and the map centre is within 5 km of Boulogne-sur-Mer (FR-004, SC-002)
- [X] T002 [US1] Run `npx playwright test tests/e2e/sites_flow.spec.js --project=chromium`; confirm T001 and T001b fail
- [X] T003 [US1] In `js/views/sites.js`, add `fitMapToRadius()` (circle bounds around `SitesService.getEffectiveLocation()`, `padding: [20, 20]`, `isProgrammaticZoom` guard) and use it instead of the marker `fitBounds` in `initMap` and `updateMapMarkers` (keep `ignoreNextFitBounds`); in `bindMapSync`, record the time of the pilot's gestures on the map container (`pointerdown`, `wheel`, `touchstart`, `keydown`) and ignore `moveend`/`zoomend` not preceded by a gesture within 1.5 s (FR-004)
- [X] T004 [US1] Run `npm test`, `npm run test:e2e` (Chromium + WebKit), `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build` (configs in `playwright.config.js`, `vite.config.mjs`); all green
- [X] T005 Check in the browser (`http://localhost:8001/?mode=SITES`) with and without a far favourite
