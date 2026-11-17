# Feature Specification: Detailed A4 Landscape Logbook PDF Report

**Feature Branch**: `049-detailed-logbook-pdf`  
**Created**: 2026-11-17  
**Status**: In Progress  
**Extends**: `specs/033-logbook-exports/spec.md`, `specs/042-brevets-progression/spec.md`  
**User Request**: "exports carnet de vol pdf pas precis" — make the logbook PDF export complete, accurate, and richly detailed in A4 landscape format with a top summary & brevets block and full per-session metrics and context.

## Problem

The existing logbook PDF report (`buildLogbookReportHtml` in `js/services/logbook_export.js`) only prints a narrow 6-column table (date without time, Vol/Gonflage type, site, wing, duration, comment) and a single-line footer with combined session count and durations. Pilots cannot read:
- exact session times (`HH:MM`, omitted only for `dateOnly` FFVL imports),
- flight types (`Plouf`, `Thermique`, `Soaring`, `Restit`, `Cross`, `Treuil`), takeoff techniques, landing approaches, landed-out status (`vache`), or ground-handling exercises,
- altitudes (`altitudeMax`, `gain`, takeoff/landing altitudes adjusted for `altOffset`, elevation drop `takeoffAlt - landingAlt`, cumulative climb, winch release),
- distance (`distanceKm`, `freeDistanceKm`, `maxFromTakeoffKm`), vario (`maxClimbRate`, `maxSinkRate`, thermals), speeds (`maxSpeedKmh`, `avgSpeedKmh`), glide ratio, G-load (`sensorStats`), and instrument metadata,
- full equipment (`voile`, `sellette`, `rescueDeployed` / `rescueId`, `instrument`),
- school / training details (`ecole`, `brevetPrepare`, `stageName`, `stageSpecialty`, `moniteur`, `accompagnateur`, `treuilleur`, `pilotes`),
- recorded session weather (`meteo`, `meteoAtterro`, `meteoAtterroSame`),
- an accurate header summary separating flight counts vs ground-handling counts, cumulative distance/gain/climb/max altitude, wing hours breakdown, and FFVL certifications (`BI`, `BP`, `BPC`, `TREUIL`) status and progress.

## User Scenarios

1. **Top Summary & Brevets Header.** When the pilot clicks **Exporter en PDF**, the report opens in A4 landscape (`@page { size: A4 landscape; margin: 10mm; }`, without redundant double body margins) with a structured header containing:
   - report title, generation date, covered period (first to last session date),
   - global KPIs separating flight count & duration from ground-handling count & duration, total sessions, max altitude reached, cumulative gain, cumulative distance, longest flight, and school sessions count,
   - equipment breakdown (flights, ground sessions, and total hours per wing),
   - FFVL certifications (`Mes Brevets & Progression`) when any certification is configured or linked via `brevetPrepare` on school sessions, showing theory/practical validation details and linked training volumes.
2. **Full Per-Session Precision.** Every chronological row (`oldest -> newest`) displays dedicated metric columns (`Date & Heure`, `Type`, `Site / Lieu`, `Matériel`, `Durée`, `Alt. / Gain / Déniv.`, `Dist. / Vario / Vit.`, `Détails`) containing all non-empty recorded fields without inventing missing data (`—` when absent).
3. **Faithful Data & Security.**
   - `dateOnly` sessions (such as FFVL Excel imports) or date strings without time show only the date without inventing `00:00` or shifting across timezones.
   - `igcStats` absolute altitudes (`takeoffAlt`, `landingAlt`, `winch.releaseAlt`) apply `altOffset`, while `altitudeMax` (already stored with offset) does not double-apply it.
   - All user-provided strings are escaped with `escapeHTML()`; numeric fields are validated via `Number.isFinite` so invalid values cannot inject markup or produce `NaN`.
   - Everything works offline with zero external requests or third-party dependencies.

## Requirements

- **FR-1**: `buildLogbookReportHtml(flights, options)` accepts `{ generatedAt, brevets }` (backwards-compatible when `options` is omitted) and does not mutate `flights`.
- **FR-2**: `LogbookView.exportLogbookPdf()` passes `brevets: BrevetService.getBrevets()` to `buildLogbookReportHtml`.
- **FR-3**: The CSS uses `@page { size: A4 landscape; margin: 10mm; }` with `body { margin: 0; }` (no double margin), repeating `<thead>`, `break-inside: avoid` on rows and summary cards, and `print-color-adjust: exact`.
- **FR-4**: Chronological sorting handles both full ISO datetimes and date-only strings deterministically without timezone shifts on pure `YYYY-MM-DD` strings.
- **FR-5**: All UI labels live in `js/i18n/fr.js` under `logbook.export` (synced to `functions/shared/fr.mjs` via `npm run sync:functions`).
- **FR-6**: `js/i18n/fr_html.js` and `index.html` (`manualModal.exporterCarnet`) accurately describe the updated PDF report.

## Success Criteria

- Unit tests in `tests/services/logbook_export.test.js` and `tests/views/logbook_export.test.js` verify all columns, header KPIs, wing totals, brevets block, `altOffset` handling, `dateOnly` handling, XSS escaping, and non-mutation.
- Playwright E2E tests in `tests/e2e/logbook_exports.spec.js` verify the printed report contains detailed session metrics, equipment, school/brevet context, and summary totals.
- `lint`, `format:check`, `typecheck`, `vitest`, `build`, and Playwright E2E pass.
