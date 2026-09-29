# Tasks: Map Framed on the Search Radius

**Tests**: REQUIRED (constitution Principle IV).

- [ ] T001 [US1] In `tests/e2e/sites_flow.spec.js`, add a scenario: saved favourite `sorgia-601` (≈ 600 km away), no position, radius 50 km; after the sites screen loads, `SitesView.state.map.getCenter()` is within 5 km of Boulogne-sur-Mer (50.7264, 1.6147), the map bounds do not contain the favourite, and the bounds contain the points 45 km north and south of Boulogne-sur-Mer
- [ ] T002 [US1] Run `npx playwright test tests/e2e/sites_flow.spec.js --project=chromium`; confirm T001 fails
- [ ] T003 [US1] In `js/views/sites.js`, add `fitMapToRadius()` (circle bounds around `SitesService.getEffectiveLocation()`, `padding: [20, 20]`, `isProgrammaticZoom` guard) and use it instead of the marker `fitBounds` in `initMap` and `updateMapMarkers` (keep `ignoreNextFitBounds`)
- [ ] T004 [US1] Run `npm test`, `npm run test:e2e` (Chromium + WebKit), `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run build` (configs in `playwright.config.js`, `vite.config.mjs`); all green
- [ ] T005 Check in the browser (`http://localhost:8001/?mode=SITES`) with and without a far favourite
