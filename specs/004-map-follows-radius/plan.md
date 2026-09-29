# Implementation Plan: Map Framed on the Search Radius

**Branch**: `fix/map-follows-radius` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

## Summary

Replace the two automatic `fitBounds` on all markers (`initMap`, `updateMapMarkers` in
`js/views/sites.js`) with `fitMapToRadius()`: bounds of the circle `radiusLimit` km around
`SitesService.getEffectiveLocation()` (Leaflet `LatLng.toBounds(diameter in metres)`), with the
existing `isProgrammaticZoom` guard so the map/radius sync does not react to it.

## Technical Context

JavaScript ES modules, Leaflet (already loaded); tests: Playwright (Leaflet is not loaded in
Vitest/happy-dom, so the framing is verified end-to-end); no new dependency.

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| I. UX first | PASS | Map shows the search area announced by the radius label |
| IV. Test-first | PASS | e2e written first and seen failing |
| VI–VIII | PASS | View-only change, no new data or dependency |

## Complexity Tracking

None.
