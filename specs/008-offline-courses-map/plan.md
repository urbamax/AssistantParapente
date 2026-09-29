# Implementation Plan: Opened Courses and Viewed Map Offline

**Branch**: `feat/offline-courses-map` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

## Summary

In `sw.js`: two runtime caches kept across app versions — `parapente-courses-v1` and
`parapente-tiles-v1` — excluded from the activation clean-up. Course PDFs (same origin, also when
opened as a navigation): network first; a full `200` response is stored under the URL without
anchor; a partial `206` response of a course not yet stored triggers one background full download;
offline, the stored full document is returned (also for Range requests), otherwise
`Response.error()` (never `index.html`). Map tiles (`server.arcgisonline.com`): cache first in the
tiles cache, storing only non-opaque successful responses, trimmed to 1 500 entries (oldest first).
Leaflet tile layer uses `crossOrigin: true` so responses are CORS, not opaque.

## Technical Context

Service worker (classic script, rewritten by the Vite build only for `CACHE_NAME` and the precache
list), Leaflet. Tests: Playwright with the service worker enabled (Chromium + WebKit); tile test
uses the real Esri tile server (external dependency, skipped only if unreachable).

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| I. UX | PASS | Opened courses and viewed map offline; no home page in place of a PDF |
| IV. Test-first | PASS | e2e written first and seen failing, run in CI |
| V. Offline-first | PASS | Closes B2 as the constitution words it (« courses already opened ») |
| VI. Privacy / third parties | PASS | No new third party; tiles already loaded from Esri; no prefetch (provider terms) |
| VII. No build | PASS | `sw.js` stays a plain script; build rewrite untouched |

## Complexity Tracking

None.
