# Implementation Plan: Sites Screen Texts in the Strings Catalogue

**Branch**: `feat/sites-strings` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

## Summary

Same method as spec 014. Snapshot the rendered sites screen before touching it
(`tests/views/sites_render.test.js`, 14 states, iframes and third-party addresses neutralised), move
every text of `js/views/sites.js` to `FR.sites` read through `tt` / `th` / `tl`, and keep the
snapshot identical. The inline-text check moves to `tests/helpers/inline_texts.js`, gains rules
for the patterns found in the sites view, and runs on both screens.

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| I. UX and data integrity | PASS | Snapshot identical; filters and preferences untouched |
| IV. Test-first | PASS | Snapshot recorded and guard seen failing first |
| VI. Security | PASS | Catalogue texts escaped; site texts still through `renderSiteText` |
| VII. No build | PASS | Plain modules |
| Language | PASS | C8 for the sites screen |

## Project Structure

```text
js/i18n/fr.js                          # FR.sites.{gps,weather,list,card,details,brief,comparator,maps,filters,places,misc}
js/views/sites.js                      # tt/th/tl
tests/helpers/inline_texts.js          # shared check (moved from spec 014, strengthened)
tests/views/logbook_strings.test.js    # uses the helper
tests/views/sites_strings.test.js      # new
tests/views/sites_render.test.js       # + snapshot
```

## Complexity Tracking

None.
