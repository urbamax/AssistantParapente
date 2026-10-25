# Research: Logbook Courses

No open "NEEDS CLARIFICATION" in the technical context; the points below are design decisions taken
from reading the current code.

## R1 — How are several instructors stored?

- **Decision**: keep the field `moniteur`; its value is a list of names, or, on older sessions, a text.
  A single reader, `instructorsOf(session)`, turns both into a list. This is exactly what
  `accompagnateur` does today (`companionsOf`).
- **Rationale**: no migration; the sync already carries the field untouched; the form already has an
  add-and-remove list component for companions and pilots; one consistent shape for the three
  "people" fields.
- **Alternatives**: a new field `moniteurs` (two sources of truth to keep in sync, and a migration or
  dual reads); a joined text "A, B" (loses the names that contain a comma, cannot be edited as tags).
- **Known limit**: a device still running the previous version reads a list as text ("A,B") and
  could write that text back if it edits the session. The app updates itself (service worker) and
  companions already have the same limit; accepted.

## R2 — What is a course, and how are two sessions matched?

- **Decision**: a session belongs to a course when it has a school and a course name or a specialty
  (the form already drops both without a school). The course is identified by its name compared
  without case or surrounding spaces (`courseKey`). The displayed spelling is the one of the most
  recent session. Sessions with a specialty but no name form one "unnamed course".
- **Rationale**: no explicit course record exists and none is wanted; the history already treats a
  specialty alone as "Stage".
- **Alternatives**: a course id or date range stored on the session (needs a new UI and a migration);
  splitting a same-named course by year (guessing, not asked).

## R3 — Where does the pre-fill live?

- **Decision**: a new first step inside `applyLearnedDefaults`, which already decides which fields the
  pilot has touched (`touchedFields`), does nothing when editing, records the reason of each
  pre-filled field (`learnedFields`) and renders the explanation line. The step finds a reference
  session:
  1. the latest session of the course whose name is typed or picked (ticked course box, known name);
  2. otherwise, if the pilot has not touched the course, the nearest course session at the same place
     within three hours (same window as the pilots rule, `findNearbySession`).

  From the reference session it fills only untouched fields: school, specialty, instructors,
  companions, pilots (and, in case 2, ticks the course box and sets the name). The existing school /
  instructor / companion / pilots rules skip a field the course step has filled, and still apply to
  everything else.
- **Rationale**: one place for all pre-fill rules; same "never override the pilot" and "explain where
  it comes from" behaviour for free; the name-based case needs no new event, the existing `change`
  handler on learned fields re-runs the pass.
- **Alternatives**: a separate handler on the course name field (a second pass that could be
  overwritten by the first, and would need its own touched-tracking).
- **New touched keys**: the course box and name are `stage`, the specialty select is `specialite`;
  each is registered in `LEARNED_FIELD_IDS`.

## R4 — Course name suggestions

- **Decision**: a datalist under the course name field, filled in `populateDropdowns` from the
  logbook, most used first (recency-weighted like the other lists, `PilotHabits.rankByUse`),
  de-duplicated by `courseKey` and shown with the latest spelling.
- **Rationale**: same mechanism as schools, winch operators and the former instructor list.

## R5 — Instructor input and suggestions

- **Decision**: replace the text input `lb-moniteur` with the shared checklist (`renderChecklist`)
  named `moniteur`: chips with a remove button, an add field with suggestions, "typed but not added"
  names are added on save by the existing loop on `input[data-checklist]`. The suggestions are the
  instructors already recorded, most used first, so `rankByUse` accepts a list of values per
  session.
- **Rationale**: reuse, keyboard and mobile behaviour already tested for companions.
- **Impact**: element ids change (`lb-moniteur` → `lb-moniteur-new` / `lb-moniteur-group`); the form
  snapshot and `logbook_learning.test.js` are updated deliberately.

## R6 — Statistics and filter

- **Decision**: `courseStats(sessions)` in the module returns one entry per course (name, school of
  the latest session, specialty, flights, flight minutes, ground sessions, ground minutes, session
  count), most sessions first, ties by most recent. The statistics view renders a wide card with the
  same `equip-card` tiles as the schools block, each `data-action="filterHistoryByStat"` with
  `data-stat-type="stage"` and the course name; the unnamed course uses the type `stageUnnamed`
  (the filter needs a non-empty value, so its value is its label). `renderHistory` matches with
  `courseKey` so spelling differences do not matter.
- **Alternatives**: a sentinel value for the unnamed course (it would show up in the filter banner);
  extending the schools block (mixes two different groupings).

## R7 — Out of scope, noted

- Filtering the history by instructor, a breakdown by specialty, and exporting courses: not asked.
- Multi-file import of flights: its own specification.
