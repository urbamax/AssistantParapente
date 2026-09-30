# Implementation Plan: Weather Labels of a Ground Handling Session

**Branch**: `fix/ground-handling-weather-labels` | **Spec**: [spec.md](spec.md)

## Summary

In `renderSessionWeatherHtml` (`js/views/logbook.js`), pass « Début » / « Fin » instead of
« Décollage » / « Atterrissage » when `session.type` is not `vol`.

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| IV. Test-first | PASS | Regression test in `tests/views/logbook_weather.test.js`, seen failing |
| Language | Noted | The two labels stay inline like the existing ones of this block; they move to `js/i18n/fr.js` when the block is reworked |

## Complexity Tracking

None.
