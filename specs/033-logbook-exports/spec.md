# Feature Specification: Logbook Exports (PDF report and IGC download)

**Feature Branch**: `feat/logbook-exports`
**Status**: Draft
**Related**: Constitution v1.0.0 — Principles V (offline-first, no data loss), VI (data stays on the device), VII (no mandatory build, no heavy dependency), VIII (views render, services compute).

## Problem

A pilot can keep a logbook and import IGC traces, but cannot get anything out of the app in a form
other tools accept: no printable summary of the logbook (FFVL-style flight summary) and no way to
get back the `.igc` file of a flight (needed to declare a flight on CFD or XContest).

## User Stories

1. **Download a flight's IGC trace.** From a flight card that has a trace, the pilot downloads the
   original `.igc` file, named after the date and the site (`2026-09-14_plaine-joux.igc`).
2. **Print or save the logbook as a PDF.** From the history, the pilot opens a printable A4
   summary (date, type, site, wing, duration, comment, totals) and uses the browser's
   "Save as PDF" or prints it.

## Requirements

- **FR-1**: The IGC button appears only on flights that have a stored trace, and downloads the
  stored trace byte for byte (no re-encoding of the flight).
- **FR-2**: The file name is `<YYYY-MM-DD>_<site-slug>.igc`; accents and punctuation are removed;
  a flight without site or date falls back to `trace`/`vol`.
- **FR-3**: The PDF report lists every session in chronological order and shows the total number
  of sessions and the total duration, flights and ground handling counted separately.
- **FR-4**: All user data in the report is escaped (Principle VI); no external request is made.
- **FR-5**: Both exports work offline and need no new dependency or build step: the report is an
  HTML document printed through the browser.
- **FR-6**: With an empty logbook, the report is not generated and the pilot gets a clear message.
- **FR-7**: User-facing texts live in `js/i18n/fr.js`.

## Out of Scope

- Filtering the report by period or by wing (possible later).
- Exporting a trace for flights imported without an IGC file.
