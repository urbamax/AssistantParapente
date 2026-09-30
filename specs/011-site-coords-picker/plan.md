# Implementation Plan: Place a Manually Entered Site on a Map

**Branch**: `feat/site-coords-picker` | **Spec**: [spec.md](spec.md)

## Summary

`parseCoordinates(text)` and `formatCoordinates(lat, lon)` pure functions in
`js/utils/geo_utils.js` (decimal, DMS, `@lat,lon` links, range check).
`LogbookService.findLastCoordsForPlace(name)` returns the latest session coordinates for a place
name. In `js/views/logbook.js`: a coordinates block under the place field of both forms (button,
status line, hidden panel with text field, map container and « Retirer le point »); a Leaflet map
created on demand with topo and satellite Esri layers and a draggable `divIcon` pin (no image
assets); an `input` listener syncing text field → pin; `submitForm` stores `lat`/`lon` (before the
IGC track, which still overrides), removes them when emptied during an edit, and blocks the save on
invalid text; `editEntry` and `setFormType` restore the field; the map is removed in
`renderForm`, `resetForm` and `unmount()`. Actions registered in `js/core/main.js`. Texts in
`js/i18n/fr.js` under `logbook.coords`.

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| IV. Test-first | PASS | Unit tests (parser, service) and e2e test first |
| V. Offline-first | PASS | Text field works offline; tiles go through the existing tile cache |
| VI. Privacy | PASS | Tiles only after the pilot opens the map; same host already allowed by the CSP |
| VII. No build | PASS | Leaflet already vendored |
| VIII. Layers | PASS | Parsing in utils, lookup in service, map released in `unmount()` |
| Language | PASS | Texts in `js/i18n/fr.js` |
| Accessibility | PASS | The coordinates field is the keyboard equivalent of the map |

## Complexity Tracking

None.
