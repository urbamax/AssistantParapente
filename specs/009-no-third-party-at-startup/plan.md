# Implementation Plan: No Third-Party Request Before Consent

**Branch**: `fix/privacy-third-parties` | **Spec**: [spec.md](spec.md)

## Summary

Vendor Inter (latin variable woff2, `css/fonts.css`), Remix Icon 3.5.0 (css + woff2) and Leaflet
1.9.4 (css, js, images) under `vendor/` with their licences, logos under `img/logos/`; `index.html`
loads them locally (integrity attributes dropped for same-origin files: the build bundles CSS, and
the copies are proven identical to the audited ones by a hash test); CSP tightened (no Google
Fonts / jsDelivr, no logo hosts); footer links get `noopener noreferrer`; the FFVL buttons use the
hosted logo instead of the FFVL favicon; `measurementId` removed; `vendor` added to `STATIC_PATHS`
and to the dev precache list. The lazily loaded 3D engine (unpkg, on user click) is unchanged.

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| VI. Privacy / security | PASS | Closes C2, C3, C4: no third-party request at start-up; SRI replaced by hash tests for same-origin copies |
| V. Offline | PASS | Fonts, icons and Leaflet are app files (precached) |
| IV. Test-first | PASS | Static tests and an e2e network test first, seen failing |
| VII. No build required | PASS | Plain files; Leaflet stays a classic script |

## Complexity Tracking

None.
