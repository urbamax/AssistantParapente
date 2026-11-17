# Implementation Plan: Detailed A4 Landscape Logbook PDF Report

**Branch**: `049-detailed-logbook-pdf` | **Date**: 2026-11-17 | **Spec**: [spec.md](spec.md)

## Technical Context

- **Pure Report Builder**: `js/services/logbook_export.js` (`buildLogbookReportHtml(flights, { generatedAt, brevets })`) stays pure with zero DOM or Storage access. It reuses `instructorsOf` and `companionsOf` from `js/services/logbook_courses.js`, `BREVET_CODES`, `PROGRESSION_CHAIN`, `brevetSummary`, `hasAnyBrevetData`, `normalizeBrevetsMap` from `js/services/brevet_service.js`, `degreesToCardinal` from `js/utils/geo_utils.js`, `formatDateOnly`, `formatDuration`, `parseDateToMs` from `js/utils/date_utils.js`, `escapeHTML` from `js/core/security.js`, and `t` from `js/utils/i18n.js`.
- **View Wiring**: `js/views/logbook_history.js` (`exportLogbookPdf`) passes `{ brevets: BrevetService.getBrevets() }` to `buildLogbookReportHtml`.
- **Strings & Documentation**: `js/i18n/fr.js` (`logbook.export.*`), `functions/shared/fr.mjs` (via `npm run sync:functions`), `js/i18n/fr_html.js` + `index.html` (`manualModal.exporterCarnet`), and `DOCUMENTATION.md`.

## Constitution Check

- **Principle I (Data Integrity)**: `dateOnly` and date-only strings omit time; `altOffset` applied strictly once to raw `igcStats` altitudes (`takeoffAlt`, `landingAlt`, `winch.releaseAlt`) and never re-added to `altitudeMax`; missing data rendered as `—` without inventing values.
- **Principle IV (Test-First)**: Extend `tests/services/logbook_export.test.js`, `tests/views/logbook_export.test.js`, and `tests/e2e/logbook_exports.spec.js` first and observe them fail before implementing.
- **Principle VI (Privacy & XSS)**: Every user/external string escaped with `escapeHTML()`, numeric fields validated with `Number.isFinite`, zero external network requests in generated HTML.
- **Principle VII (Zero Mandatory Build)**: Pure ES modules with `.js` extensions, no new dependencies.
- **Language Constraint**: All user-facing French labels reside in `js/i18n/fr.js` (and `fr_html.js`/`index.html` for the manual).

## Structure

- `specs/049-detailed-logbook-pdf/{spec,plan,tasks}.md`
- `js/i18n/fr.js` + `functions/shared/fr.mjs`
- `js/services/logbook_export.js`
- `js/views/logbook_history.js`
- `js/i18n/fr_html.js` + `index.html`
- `tests/services/logbook_export.test.js`, `tests/views/logbook_export.test.js`, `tests/e2e/logbook_exports.spec.js`
- `DOCUMENTATION.md`
