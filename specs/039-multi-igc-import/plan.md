# Implementation Plan: Import Several Flights At Once

**Branch**: `feat/multi-igc-import` (from `feat/logbook-courses`) | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/039-multi-igc-import/spec.md`

## Summary

Selecting or dropping two or more flight files opens one editable table (one row per flight) instead of the
one-flight form. Each row starts from its trace and from the pilot's learned habits, is edited in place, and
all included rows are added in one confirmed action. Nothing is added before that.

Technical approach: a pure service for reading files into rows and building the stored flights
(`igc_batch_import.js`), a pure service for the starting values shared with the form's habit rules
(`logbook_defaults.js`, kept in step with the form by a parity test), one new view for the table dialog, and a
bulk `LogbookService.addFlights()` so a batch saves and syncs once. The one-flight import is unchanged.

## Technical Context

**Language/Version**: JavaScript (ES modules, runs without a build), JSDoc-typed (`tsc -p jsconfig.json`)

**Primary Dependencies**: none new (`IGCParser` through `LogbookService.parseIGC`, `SdfParser`, `PilotHabits`,
`logbook_courses.js` from spec 038, `SitesService`)

**Storage**: unchanged (LocalStorage / IndexedDB, Firestore sync); flights and traces are stored as for a
single import

**Testing**: Vitest (jsdom) for services and the dialog; Playwright for the end-to-end flow; igc fixtures in
`tests/fixtures/`; `npm run verify` before pushing

**Target Platform**: installable PWA, mobile and desktop, offline-capable

**Project Type**: single web application

**Performance Goals**: 30 files of ~400 KB read and tabulated in a few seconds without freezing the page
(yield between files); one `saveFlights()` for the whole batch

**Constraints**: offline; no new third-party call (reverse geocoding is the one already used by the single
import, one request at a time, only when online); names escaped; no inline handlers; texts in `fr.js`

**Scale/Scope**: 2 new services, 1 new view, edits to `logbook_igc_import.js`, `logbook_service.js`,
`index.html` (dialog), `main.js` (actions), `fr.js`, `sw.js`; tests

## Constitution Check

| Principle | Check | Status |
|-----------|-------|--------|
| I. UX and data integrity | Nothing added before confirmation; no file silently dropped (every file has a row or a listed reason); a flight imported equals one added by the form (compared by test); duplicates flagged, never silently skipped | Pass |
| II / III | Not concerned | N/A |
| IV. Test-first | Services and dialog tests written and seen failing first; a parity test (form vs batch defaults) and an equivalence test (form vs `buildFlight`); one Playwright flow | Pass |
| V. Offline-first, no data loss | Works offline (site left "to fill" when no place name); one bulk save; failure leaves rows in the table and memory unchanged; existing flights never modified | Pass |
| VI. Privacy and security | Traces stay in the browser; only the existing reverse-geocode call is made, and only online; all names through `escapeHTML`; no inline handlers | Pass |
| VII. No mandatory build | `.js` extensions, no new run-time file outside `sw.js` precache / `STATIC_PATHS` as required; no new recent API without helper | Pass (to check: `File.text()` through a `FileReader` fallback) |
| VIII. Layered architecture | Rules in services returning `{ success, data, error }`, a view that only renders; `data-action` dispatch registered in `main.js`; the dialog releases listeners on close | Pass |
| Language | Texts in `FR.logbook.batch`, then `npm run sync:functions` | Pass |
| Workflow | Own branch from the 038 branch, Conventional Commits, `DOCUMENTATION.md` updated | Pass |

One tracked risk, not a violation: the form's habit rules and `suggestDefaults` are two code paths for the
same rules until the form is moved onto the function. The parity test is the mitigation (Complexity Tracking).

## Project Structure

### Documentation (this feature)

```text
specs/039-multi-igc-import/
├── plan.md  research.md  data-model.md  quickstart.md  tasks.md
├── contracts/ui.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
js/
├── services/
│   ├── igc_batch_import.js     # NEW — prepareRow, duplicate rules, validateRow, buildFlight, pairing .sdf
│   ├── logbook_defaults.js     # NEW — pure suggestDefaults(sessions, context) = the form's habit rules
│   └── logbook_service.js      # addFlights(flights): one save for the batch
├── views/
│   ├── logbook_batch_import.js # NEW — the table dialog (render, edit, apply to others, import)
│   └── logbook_igc_import.js   # _processFiles: two or more flight files → batch dialog
├── core/main.js                # register the dialog's actions
└── i18n/fr.js                  # FR.logbook.batch.* (+ functions/shared/fr.mjs by sync)
index.html                      # <dialog id="logbook-batch-modal"> and its static texts (fr_html.js)
sw.js                           # precache the new modules

tests/
├── services/igc_batch_import.test.js     # NEW
├── services/logbook_defaults.test.js     # NEW (incl. parity with the form)
├── services/logbook_service.test.js      # addFlights (existing file extended)
├── views/logbook_batch_import.test.js    # NEW
├── e2e/logbook_batch_import.spec.js      # NEW
└── fixtures/                             # existing .igc files, one corrupted file added
```

**Structure Decision**: single web project; same base-class chain for the logbook view, the dialog is its own
view object like the existing modals.

## Complexity Tracking

| Item | Why Needed | Simpler Alternative Rejected Because |
|------|------------|--------------------------------------|
| `suggestDefaults` duplicates the form's habit rules until the form is migrated | Rows have no DOM; the rules must give the same proposals | Rewriting the form onto it now is a large change to a screen reworked in 038; the parity test keeps both honest |
