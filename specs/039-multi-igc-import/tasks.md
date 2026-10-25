# Tasks: Import Several Flights At Once

**Input**: Design documents from `/specs/039-multi-igc-import/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui.md, quickstart.md; spec 038 in place (branch cut from `feat/logbook-courses`)

**Tests**: REQUIRED (constitution IV). Tests first, seen failing, then the code.

## Format: `[ID] [P?] [Story] Description`

US1 = check and import a batch, US2 = edit rows with good starting values, US3 = trouble in the batch, US4 = sensor files.

## Phase 1: Setup

- [x] T001 Cut `feat/multi-igc-import` from `feat/logbook-courses` (done as requested by the owner; the specification, plan and tasks are not committed yet: commit only when the owner asks)
- [x] T002 [P] Add `tests/helpers/igc_fixture.js`: builds a small valid IGC text (date, start time, duration, take-off lat/lon, climb profile) so batches of several distinct flights can be made without large files; add one corrupted file content and one flight with a trace starting in the air; add `tests/helpers/sdf_fixture.js` building a Syride `.sdf` (8-byte header, 21-byte records per second) that follows a given generated trace (and a variant that does not); both self-tested in `tests/helpers/igc_fixture.test.js` against `LogbookService.parseIGC` and `SdfParser.matchesTrace`

## Phase 2: Foundational

- [x] T003 [P] Write failing tests `tests/services/logbook_service.test.js` (extend): `addFlights([...])` assigns ids, `updatedAt`, `syncPending`, normalises, sorts once, calls `saveFlights()` exactly once, returns the added flights, and on a `saveFlights()` failure removes them from memory again and returns `{ success: false }`
- [x] T004 Implement `LogbookService.addFlights(flights)` in `js/services/logbook_service.js` until T003 passes
- [x] T005 [P] Write failing tests `tests/services/logbook_defaults.test.js` for the pure `suggestDefaults(sessions, context)`: typeVol, techDecollage (incl. winch prior), voile / sellette (last used here, otherwise last), school, course (named and nearby, spec 038), instructors, companions, pilots (session less than 3 h away at the same place), each with its reason; **parity**: for several logbooks, the proposals equal what `LogbookView.applyLearnedDefaults()` puts in the form for the same site and time
- [x] T006 Implement `js/services/logbook_defaults.js` (`suggestDefaults`) from the rules in `js/views/logbook_learned.js`, reusing `PilotHabits` and `logbook_courses.js`, until T005 passes
- [x] T007 [P] Add the texts `FR.logbook.batch.*` in `js/i18n/fr.js` (title, progress, column headers, statuses and reasons, buttons, summary, messages, "appliquer à toutes", unpaired sensor reasons) then `npm run sync:functions`

**Checkpoint**: bulk add and shared defaults work and are tested; no UI yet.

## Phase 3: User Story 1 — Check and import a batch (P1) and User Story 3 — Trouble in the batch (P1)

(Built together: the row statuses are part of what a batch is.)

### Tests first

- [x] T008 [P] [US1] `tests/services/igc_batch_import.test.js` — `prepareRow(file)`: valid trace → row with `datetime`, `duree`, site from the nearest known site (500 m), `typeVol` suggested, statistics and `rawIgc`; two files → rows ordered by date; each row sees the rows before it (second flight at the same site within 3 h gets the pilots and course of the first); `buildFlight(row)` equals the flight `submitForm` stores for the same trace (compare objects: fields of research R7, no `altOffset`, `traceUpdatedAt` set, lat/lon of the first point)
- [x] T009 [P] [US3] same file — statuses: unreadable text → `unreadable` with a reason; trace too short or without GPS → `unreadable`; unsupported extension → `unsupported`; same flight twice in the batch (same file chosen twice, or two recorders: take-off within 5 min and 500 m) → one row kept, the other `duplicate` and not included, and the same one kept whatever the selection order; flight already in the logbook (take-off within 5 min and 500 m) → `known`, not included; existing flight without position → compared on site name, time alone never flags; two flights the same day from the same take-off more than 5 min apart → two separate rows; `validateRow`: missing datetime, site, wing or duration → `fix` with the field named; trace starting or ending in the air → warning
- [x] T010 [P] [US1] `tests/views/logbook_batch_import.test.js` — one file keeps the one-flight form; two or more open the dialog with one row per file; cancel adds nothing; closing after an edit asks to confirm; import adds the included rows once (double click adds once), closes the dialog, opens the history and reports "N vols ajoutés"; no file is missing from the table (N files → N rows or listed files); the import is blocked with the offending cells marked while a mandatory value is missing; a failing save keeps the rows and reports it
- [x] T011 [P] [US3] same file — statuses shown with their reason, unreadable/unsupported rows cannot be included, duplicate and known rows start unticked and can be ticked, remove-row works, summary counts "prêts / à vérifier / ignorés", names with `&` and `'` are escaped

### Implementation

- [x] T011b [P] [US1] `tests/services/igc_batch_import.test.js` — **independence (FR-014, SC-006)**: `prepareRow` is a pure function of one file (same text → same row, calling it for file A then B then A gives identical A rows; the form's `currentRawIgc`, `currentIgcStats`, `currentSensorStats`, `currentTraceInfo`, `currentTraceData` stay untouched); the same selection in every permutation and with renamed files yields the same rows, statuses, pairing and flags (display order by date); rows read concurrently (all promises started together) do not mix; a trace's statistics, site, altitude and `rawIgc` in a row never come from another file
- [x] T012 [US1] `js/services/igc_batch_import.js`: `prepareRow`, `rowsFromFiles` (reads files in order with a yield between files and a progress callback, then orders by date and fills starting values with `suggestDefaults` over logbook + earlier rows), duplicate rules (research R5), `validateRow`, `buildFlight`; returns `{ success, data, error }` objects; until T008–T009 pass
- [x] T013 [US1] `index.html`: `<dialog id="logbook-batch-modal">` (title, progress line, table container, unpaired sensor list, footer buttons) with `data-i18n` keys in `js/i18n/fr_html.js`; precache the new modules in `sw.js`
- [x] T014 [US1] `js/views/logbook_batch_import.js`: render the table (contracts/ui.md), include/remove, status badges and reasons, live validation, summary and import button, live region, confirm on close, import (disable button, `addFlights`, close, history tab, message, weather fetch per added flight through the existing `fetchWeatherForSession`), release listeners on close; register actions in `js/core/main.js`; escape every name with `escapeHTML`
- [x] T015 [US1] `js/views/logbook_igc_import.js`: `_processFiles` sends two or more flight files (and any `.sdf`) to the batch dialog; one file keeps the current path; update `tests/views/logbook_learning.test.js` only if it relies on the old "first file wins" behaviour; T010–T011 green

**Checkpoint**: a batch of valid, corrupted and duplicate files imports correctly.

## Phase 4: User Story 2 — Edit each row (P1)

### Tests first

- [x] T016 [P] [US2] `tests/views/logbook_batch_import.test.js` (extend): editing date, site, duration, wing, harness, type, course or pilots changes only that row and marks the field edited; a "Autre" wing opens a free text; picking a known course fills that row's school, specialty, instructors, companions and pilots without replacing edited fields; "Appliquer à toutes" on wing, harness, type, course, pilots copies the first included row's value to the rows not edited in that column and never to edited ones; the row status updates live (a filled wing turns `fix` into `ready`)
- [x] T017 [P] [US2] `tests/services/igc_batch_import.test.js` (extend): `applyToOthers(rows, column, sourceRowId)` and `applyCourse(row, name, sessions)` as pure functions

### Implementation

- [x] T018 [US2] `igc_batch_import.js`: `applyToOthers`, `applyCourse` (uses `latestOfCourse`, same untouched-field rule as 038); `logbook_batch_import.js`: editable cells (datetime, site with suggestions, number, selects from the equipment, course with `#stages-list`-like suggestions, pilots tags), the "Appliquer à toutes" actions; T016–T017 green
- [x] T019 [US2] Reverse geocoding for rows without a known site: after the table is shown, one request at a time, only online, row shows "recherche du lieu…" then the name, or stays "à renseigner"; a pilot edit of the site cancels the lookup for that row; test with `LogbookService.reverseGeocode` mocked

## Phase 5: User Story 4 — Sensor files (P2)

- [x] T020 [P] [US4] Tests in `tests/services/igc_batch_import.test.js` with the generated fixtures of T002 and `tests/fixtures/syride-winch-flight.igc` + `.sdf`: (a) the `.sdf` is paired with the matching row and `buildFlight` stores `sensorStats` (`source: 'sdf'`, `gMax`, release G for a winch); (b) **four flights from the same take-off on the same day, each with its own `.sdf`, selected in shuffled order and with swapped file names**: every flight gets exactly its own sensor data (compare each flight's `gMax` with its generator's); (c) an orphan `.sdf` (matches no trace) is listed "not attached" with a reason and nothing is saved from it; (d) a `.sdf` matching two traces (two near-identical flights) is attached to neither and listed ambiguous; a trace matching two `.sdf` likewise; (e) a `.sdf` alone gives the existing message; (f) the same results for every permutation of the selection
- [x] T021 [US4] `igc_batch_import.js` `pairSensors` by content (research R1c) with `SdfParser.alignToTrace` / `matchesTrace` and the pre-check; the view shows the attachment on the row and the unpaired / ambiguous list; T020 green

## Phase 6: Polish, end-to-end and verification

- [x] T022 [P] `tests/e2e/logbook_batch_import.spec.js` (pattern of `tests/e2e/logbook_courses.spec.js`): select three generated `.igc` files with their `.sdf` in shuffled order, an orphan `.sdf`, a duplicate and a corrupted file → each flight keeps its own sensor data after import; select three generated `.igc` files plus a corrupted one → table with four rows, corrupted row unincludable; edit one wing and add a pilot; import; the logbook shows three flights with "Voir la trace"; select them again → "déjà dans le carnet", unticked; keyboard-only pass; a phone-width pass (rows readable, import reachable)
- [x] T023 [P] `DOCUMENTATION.md`: services `igc_batch_import.js`, `logbook_defaults.js`, the batch dialog, `addFlights`, duplicate rule, parity test; manual text in `index.html` + `js/i18n/fr_html.js` ("importer plusieurs vols")
- [ ] T024 (partly done: lint, format, typecheck, unit tests, e2e of the feature and build pass; `npm run verify` needs a commit and a clean tree) `npm run lint`, `npm run format:check`, `npm run typecheck`, `npx vitest run`, e2e on Chromium and WebKit with one worker, `npm run build`; then `npm run verify` once the working tree is committed, reading the final status line
- [ ] T025 When the owner asks: push the branch and open the pull request (after spec 038's pull request is merged, or stacked on it)

## Dependencies & Execution Order

- Phase 1 → Phase 2 (T003–T007) → Phase 3 → Phase 4 → Phase 5 → Phase 6. T002 before any test that builds flights.
- T012 needs T004 and T006; T014 needs T012–T013; T018 needs T014. T019 and the `.sdf` work (T021) are independent of each other.
- Parallel: T002, T003, T005, T007; T008–T011 (different files except T010/T011 which share one); T020 with T016–T017.

## Implementation Strategy

- **MVP**: Phases 1–3 (import a batch with the starting values, statuses and validation, edit through the generic cells of T014 limited to wing and pilots) — then Phase 4 for the full editing set and apply-to-others, Phase 5 for sensors.
- Decisions to confirm with the owner before T018 and T012 are frozen: the "apply to others" action, the duplicate thresholds (5 min, 500 m), instructors/companions as columns (spec, "Decisions to confirm").
