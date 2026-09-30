# Implementation Plan: Weather Labels of a Ground Handling Session

**Branch**: `fix/ground-handling-weather-labels` | **Spec**: [spec.md](spec.md)

## Summary

In `renderSessionWeatherHtml` (`js/views/logbook.js`), pass « Début » / « Fin » instead of
« Décollage » / « Atterrissage » when `session.type` is not `vol`; the four labels live in
`js/i18n/fr.js`.

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| IV. Test-first | PASS | Regression test in `tests/views/logbook_weather.test.js`, seen failing |
| Language | PASS | The four row labels move to `js/i18n/fr.js` (`weather.row*`) |

## Complexity Tracking

None.
