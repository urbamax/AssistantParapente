# Implementation Plan: Honest Favourite-Site Notification

**Branch**: `fix/notification-wording` | **Spec**: [spec.md](spec.md)

## Summary

Add `buildNotification(site, weather, forecastTimeMs)` to `functions/evaluate.mjs` (pure), with
texts in `js/i18n/fr.js` (`notification.*`, copied to `functions/shared/fr.mjs` by the sync
script) and the hour formatted with `Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris' })`;
`functions/index.js` uses it. `buildHourlyForecast` also returns the forecast hour (`timeMs`).

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| II. Decision support | PASS | Closes A3: no « volable », source, hour, reminder |
| IV. Test-first | PASS | Unit tests on the builder first (server code: no e2e possible, FCM not emulated) |
| Language | PASS | Texts in the shared catalogue |

## Complexity Tracking

None.
