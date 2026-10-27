# Implementation Plan: Map Marker Jumps to Site Card

**Branch**: `fix/map-marker-jumps-to-card` | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)

## Summary

Wire the Leaflet marker `click` event in `js/views/sites_map.js` to `this.jumpToSiteCard(site.id)` instead of `this.spotSite(...)`, and add `id="site-card-${site.id}"` to the `.site-card` container rendered in `js/views/sites_list.js` so `jumpToSiteCard` can locate and highlight the card.

## Technical Context

JavaScript ES modules, Leaflet, Vitest (happy-dom). No new dependencies, storage, or cloud changes.

## Constitution Check

| Principle | Status |
|-----------|--------|
| I. UX and data integrity | Pass: clicking a marker directly brings the pilot to the site's information card with visual feedback (`.highlight-glow`) |
| IV. Test-first | Pass: covered by unit tests in `tests/views/sites_keep_scroll.test.js` and updated render snapshots |
| V–VIII | Not concerned (no storage, security, build, or architecture layer change) |

No violation.

## Project Structure

```text
js/views/sites_list.js                                # add id="site-card-${site.id}" on .site-card
js/views/sites_map.js                                 # call this.jumpToSiteCard(site.id) on marker click
tests/views/sites_keep_scroll.test.js                 # unit test for marker click -> jumpToSiteCard
tests/views/__snapshots__/sites_render.test.js.snap   # updated snapshots with site-card IDs
```
