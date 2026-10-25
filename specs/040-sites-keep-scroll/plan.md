# Implementation Plan: Sites Screen Keeps Its Scroll Position

**Branch**: `fix/sites-keep-scroll` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

## Summary

`SitesView.filterByTag` and `SitesView.filterByType` (`js/views/sites.js`) end with
`screen.scrollTo({ top: 0, behavior: 'smooth' })`. Removing those two calls is the fix; `scrollToTop`
(the back-to-top button) is a separate method and stays.

## Technical Context

JavaScript ES modules, Vitest (happy-dom). No dependency, storage or cloud change.

## Constitution Check

| Principle | Status |
|-----------|--------|
| I. UX and data integrity | Pass: removes an unwanted jump, data untouched |
| IV. Test-first | Pass: regression test written first, seen failing |
| V–VIII | Not concerned (no storage, security, build or layering change) |

No violation.

## Project Structure

```text
js/views/sites.js                       # remove the two scrollTo calls
tests/views/sites_keep_scroll.test.js   # regression test (new)
```
