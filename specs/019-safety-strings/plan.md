# Implementation Plan: Safety Screen Texts in the Strings Catalogue

**Branch**: `feat/safety-strings` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

## Summary

Snapshot the safety screen first (`tests/views/safety_render.test.js`, 5 groups of states), then
move its texts to `FR.safety`. The exported checklists are rebuilt from the catalogue (ids and
colour levels stay in code). HTML texts go through `esc()` or `rich()` (escape, then restore
`<strong>` only); plain texts through `tl()`. The three per-screen guard tests merge into
`tests/views/inline_strings.test.js` (one row per migrated screen); the shared check learns to
skip file paths.

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| I. UX | PASS | Snapshot identical (whitespace-normalised) |
| III. Sourced content | PASS | FFVL texts kept word for word, sources unchanged |
| IV. Test-first | PASS | Snapshot recorded on the unchanged code |
| V. Offline | PASS | Catalogue is a precached module, as before |
| VI. Security | PASS | Everything escaped, only `<strong>` restored |
| Language | PASS | C8 for the safety screen |

## Complexity Tracking

None.
