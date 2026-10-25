# Implementation Plan: Logbook Courses — Memory, Several Instructors, Statistics

**Branch**: `feat/logbook-courses` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/038-logbook-courses/spec.md`

## Summary

Make a school course (a "stage") a first-class thing the logbook remembers:

1. A new pure domain module, `js/services/logbook_courses.js`, owns every rule about courses and
   instructors: reading the instructors of a session (legacy text or list), identifying a course (name
   compared without case or surrounding spaces), ranking known course names, finding the reference
   session of a course, and aggregating course statistics.
2. The session form gets the course pre-fill inside the existing learned-defaults pass
   (`applyLearnedDefaults`): a known course name, or a course session close in time and place, brings
   back the school, specialty, instructors, companions and pilots the pilot has not touched.
3. The single instructor text field becomes an add-and-remove list (the existing checklist component
   already used for companions and pilots). The stored field keeps its name `moniteur`; it may hold the
   former text or a list, exactly like `accompagnateur` already does.
4. The statistics get a "Courses" block next to the schools block, clickable to filter the history.

No new dependency, no cloud change, no migration.

## Technical Context

**Language/Version**: JavaScript (ES modules, no build needed to run), JSDoc-typed (`tsc -p jsconfig.json`)

**Primary Dependencies**: none new (existing `PilotHabits`, `LogbookService`, checklist helpers)

**Storage**: unchanged. Sessions live in LocalStorage / IndexedDB and sync to Firestore as free-form
documents; `moniteur` may now be a list of strings instead of a string, `stageName` and
`stageSpecialty` are unchanged.

**Testing**: Vitest (jsdom) for the module and the views; Playwright for the end-to-end flow;
`npm run verify` before pushing (CI-faithful).

**Target Platform**: installable PWA, mobile and desktop browsers, offline-capable

**Project Type**: single web application (static ES modules)

**Performance Goals**: pre-fill and statistics are computed from the in-memory logbook (hundreds to a
few thousand sessions) in a single pass; no perceptible delay on opening the form or the statistics

**Constraints**: offline; no data loss on legacy sessions; UI text in `js/i18n/fr.js` (and its synced
copy for the Cloud Function); names rendered through `escapeHTML`; no inline handlers

**Scale/Scope**: one new service module, edits in 5 view/service files, 1 i18n section, tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|-----------|-------|--------|
| I. UX and data integrity | Legacy single instructor still shown and kept on save; nothing invented: every pre-filled value comes from a real session and is reported on the explanation line; the pilot can change all of it | Pass |
| II. Decision support | Not concerned (no weather or verdict) | N/A |
| III. Sourced theory | Not concerned | N/A |
| IV. Test-first | Tests written and seen failing first: unit tests of the module, view tests (form, history, statistics), one Playwright flow; a legacy-instructor regression test | Pass (tasks order tests first) |
| V. Offline-first, no data loss | Everything computed locally; sync carries fields as they are; no overwrite of data | Pass |
| VI. Privacy and security | No tracking; course and instructor names (user data) go through `escapeHTML` in every `innerHTML`; no new storage | Pass |
| VII. No mandatory build | Imports with `.js` extension; no new run-time file to list in `STATIC_PATHS`; no recent API without helper | Pass |
| VIII. Layered architecture | Rules in a service (`logbook_courses.js`), views only render and react; interactions via `data-action` (the statistics reuse `filterHistoryByStat`); no inline handlers | Pass |
| Language | New texts in the centralised strings (`FR.logbook`), then `npm run sync:functions` for the copy used by the Cloud Function | Pass |
| Workflow | Own branch, Conventional Commits, `DOCUMENTATION.md` updated (new module, instructor data shape) | Pass |

No violation, no Complexity Tracking entry needed. Re-checked after Phase 1: unchanged.

## Project Structure

### Documentation (this feature)

```text
specs/038-logbook-courses/
├── plan.md              # This file
├── research.md          # Phase 0: decisions and alternatives
├── data-model.md        # Phase 1: session fields and derived course
├── quickstart.md        # Phase 1: how to see it working
├── contracts/
│   └── ui.md            # Phase 1: form, history and statistics contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
js/
├── services/
│   ├── logbook_courses.js      # NEW — instructorsOf, courseKey/isCourse, ranked names,
│   │                           #       reference session, course statistics (pure)
│   └── pilot_habits.js         # rankByUse accepts a list of values per session
├── views/
│   ├── logbook_checklists.js   # instructors checklist in the school block; course names list
│   ├── logbook_learned.js      # course pre-fill step; instructors read as a list
│   ├── logbook_form.js         # read/save/edit instructors as a list; course names list
│   ├── logbook_history.js      # all instructors; "stage" / "stageUnnamed" history filters
│   └── logbook_stats.js        # "Courses" block
└── i18n/fr.js                  # new texts (form, history, stats, learned reasons)
functions/shared/fr.mjs         # generated copy (npm run sync:functions)

tests/
├── services/logbook_courses.test.js        # NEW
├── services/pilot_habits.test.js           # rankByUse with lists (existing file extended)
├── views/logbook_courses_form.test.js      # NEW — pre-fill and instructors
├── views/logbook_courses_stats.test.js     # NEW — block, filter, banner
├── views/logbook_learning.test.js          # adapted (instructor list)
├── views/__snapshots__/logbook_render.test.js.snap  # updated for the intended form change
└── e2e/logbook_courses.spec.js             # NEW

DOCUMENTATION.md                # module list and data shape
```

**Structure Decision**: single web project; the new rules go to `js/services/` as a pure module
(constitution VIII), the views keep rendering and events. The form continues the existing
base-class chain (`Sites → Checklists → Learned → IgcImport → Form → LogbookView`); no new class.

## Complexity Tracking

No constitution violation to justify.
