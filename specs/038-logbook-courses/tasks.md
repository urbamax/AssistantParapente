# Tasks: Logbook Courses — Memory, Several Instructors, Statistics

**Input**: Design documents from `/specs/038-logbook-courses/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui.md, quickstart.md

**Tests**: REQUIRED (constitution IV: test-first, red before green). In every phase the test tasks come first and MUST be seen failing before the implementation tasks are started.

**Organization**: grouped by user story. Story order follows the dependencies, not only the priorities: US3 (instructors as a list) comes before US1 because the course pre-fill must carry all instructors.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 = known course re-used, US2 = course pre-filled from a close session, US3 = several instructors, US4 = courses in the statistics

## Phase 1: Setup

- [x] T001 Create the branch `feat/logbook-courses` from `main` and write the specification, plan and tasks in `specs/038-logbook-courses/` (committed only when the owner asks)

---

## Phase 2: Foundational (blocks every story)

**Purpose**: the pure rules of the feature and the texts, used by every story.

- [x] T002 [P] Write failing unit tests for the new module in `tests/services/logbook_courses.test.js`: `instructorsOf` (text, list, nothing, blanks and case-duplicates dropped, first spelling and order kept), `courseKey` (trimmed, lower-cased, `''` when no name), `isCourseSession` (needs `ecole` and a name or a specialty), `courseNames` (ranked by use, one entry per key, spelling of the most recent session), `latestOfCourse` (latest session of a course by key) and `preferPlace` (latest at a place, otherwise latest), `courseStats` (one entry per key, name/school/specialty of the most recent session, flights and ground sessions with minutes, `sessions` total, ordered by sessions then most recent, unnamed course entry with `key: ''`; the sum of `sessions` equals the number of course sessions)
- [x] T003 [P] Add a failing test in `tests/services/pilot_habits.test.js` that `rankByUse` counts every value when `valueOf` returns a list (same recency weight for the values of one session) and still ignores empty values
- [x] T004 Implement `js/services/logbook_courses.js` (pure functions, JSDoc types, imports with `.js`) until T002 passes: `instructorsOf`, `courseKey`, `isCourseSession`, `courseNames`, `latestOfCourse`, `preferPlace`, `courseStats`
- [x] T005 Make `PilotHabits.rankByUse` in `js/services/pilot_habits.js` accept a list of values per session until T003 passes
- [x] T006 Add the new texts to `js/i18n/fr.js` (`FR.logbook`): `form.learned.fields.stage` ("stage"), `form.learned.fields.specialite` ("spécialité"), `form.learned.reasons.course` ("comme ton stage"), `history.unnamedCourse` ("Stage sans nom"), `stats.courses` ("Stages"), `stats.courseShare` ("{count} sessions en stage sur {total} au total"), reword `form.instructorPlaceholder` for a list ("Nom du moniteur…"); then run `npm run sync:functions` so `functions/shared/fr.mjs` matches (`tests/functions/shared_copy.test.js`)

**Checkpoint**: T002–T003 green; no view changed yet.

---

## Phase 3: User Story 3 — Several instructors on a school session (Priority: P1)

**Goal**: instructors are an add-and-remove list; legacy single text keeps working.

**Independent Test**: add two instructors to a school session, save, reopen: both there; history lists both; a legacy `moniteur: 'Gilbert'` session opens with one chip and saves unchanged.

### Tests (write first, see them fail)

- [x] T007 [P] [US3] In `tests/views/logbook_courses_form.test.js` (new, same setup as `tests/views/logbook_stage_rescue.test.js`): two instructors added with the add field are saved as a list `['Gilbert', 'Marie']`, shown as chips on edit and listed in the history card; a name typed but not added is added on save; unticking the school box saves no instructor; a legacy `moniteur: 'Gilbert'` session opens with one chip and re-saves as `['Gilbert']` (regression, FR-007); the suggestions `#lb-moniteur-options` list the recorded instructors, most used first
- [x] T008 [US3] Adapt `tests/views/logbook_learning.test.js` (lines about `lb-moniteur`, `moniteurs-list`) to the list: the instructor is added through `lb-moniteur-new`, saved as a list, pre-filled as a chip for a new session of the same school (reason lines unchanged), and `moniteur` is `[]` without school

### Implementation

- [x] T009 [US3] In `js/views/logbook_checklists.js` `renderSchoolBlock`: replace the `lb-moniteur` input and `moniteurs-list` datalist by `renderChecklist('moniteur', [], this.getUsedValues('moniteur'), tt('form.instructorPlaceholder'))`
- [x] T010 [US3] In `js/views/logbook_form.js`: `populateDropdowns` fills `#lb-moniteur-options` from `PilotHabits.rankByUse(flights, instructorsOf)` (most used first) instead of `moniteurs-list`; `setFormType` keeps the list through a type switch (`getChecklistValues` / `setChecklistValues('moniteur', …)`); `submitForm` saves `moniteur: ecole ? this.getChecklistValues('moniteur') : []`; `editEntry` fills the chips from `instructorsOf(session)`
- [x] T011 [US3] In `js/views/logbook_history.js` show every instructor (`instructorsOf(session).join(', ')`, escaped) on the "Moniteur :" line
- [x] T012 [US3] In `js/views/logbook_learned.js` replace the instructor rule: reference = `preferPlace(sessionsOfTheSchoolWithInstructors, place)`, fill the chips with `instructorsOf(reference)` (reasons `instructorPlace` / `instructorLatest` unchanged), remove them when the school changes and they were pre-filled; `LEARNED_FIELD_IDS` loses `lb-moniteur` (the list reports through `onChecklistEdited('moniteur')`)
- [x] T013 [US3] Update the form snapshot with `npx vitest run tests/views/logbook_render.test.js -u` and review the diff (only the instructor field changes); run T007–T008 to green

**Checkpoint**: instructors work end to end, legacy data intact.

---

## Phase 4: User Story 1 — Re-use a known course in one gesture (Priority: P1)

**Goal**: picking a known course name fills school, specialty, instructors, companions and pilots from its latest session.

**Independent Test**: record a full course session, open a new form, tick school and course, pick the name: the five fields are filled and reported.

### Tests (write first, see them fail)

- [x] T014 [P] [US1] In `tests/views/logbook_courses_form.test.js`: `#stages-list` lists known course names, most used first, one per key (spelling of the most recent); picking a known name (any case) fills school (ticking the box), specialty, instructors, companions and pilots of the latest session of that course; the explanation line names the course; a field the pilot touched first (school, a pilot added, specialty changed) is left as entered; a latest session without companion adds none; a name not in the list pre-fills nothing; editing an existing session pre-fills nothing (FR-005)

### Implementation

- [x] T015 [US1] In `js/views/logbook_checklists.js` `renderSchoolBlock`: add `list="stages-list"` and `<datalist id="stages-list">` to `lb-stage-nom`; in `js/views/logbook_form.js` `populateDropdowns` fill it with `courseNames(flights)`
- [x] T016 [US1] In `js/views/logbook_learned.js`: register `'lb-stage-check'` and `'lb-stage-nom'` as learned field `stage` and `'lb-stage-specialite'` as `specialite` in `LEARNED_FIELD_IDS`; add the course step at the start of `applyLearnedDefaults` (research R3, case 1): when the course box is ticked and the typed name is a known course, take `latestOfCourse` of that name and fill only untouched fields (school via `setSchoolField`, specialty, instructors, companions, pilots), record `learnedFields` with reason `course`, and make the existing school / instructor / companion / pilots rules skip a field the course step filled; add `stage` and `specialite` to the field names used by `renderLearnedSummary`
- [x] T017 [US1] Check the specialty select and the name field handlers in `js/views/logbook.js` (the course box toggle must still show/hide `lb-stage-group`); run T014 to green

**Checkpoint**: the second session of a course needs only date and duration.

---

## Phase 5: User Story 2 — A session in a row of a course starts with the course ticked (Priority: P1)

**Goal**: a new session at the same place within 3 h of a course session opens with the course ticked and named.

**Independent Test**: record a course session; open a new form with the same place and a date within 3 h: school and course ticked, name and specialty set.

### Tests (write first, see them fail)

- [x] T018 [P] [US2] In `tests/views/logbook_courses_form.test.js`: same place and less than 3 h → course ticked, name, specialty, instructors, companions and pilots set, explanation line reason "session de moins de 3 h"; more than 3 h or another place → course box unticked; nearest session not a course → unticked; the pilot unticks the box or edits the name, then changes the date → choice kept; the course pre-filled for one place is removed when the pilot moves to a place with no close course session

### Implementation

- [x] T019 [US2] In `js/views/logbook_learned.js` add the second case of the course step (research R3, case 2): when the course is untouched and not editing, use `findNearbySession` on the course sessions (`isCourseSession`) to tick the school and course boxes and set name and specialty, then fill the other fields as in US1; remove a course this rule pre-filled when no close course session remains; run T018 to green

**Checkpoint**: series of flights in a course need no manual course step.

---

## Phase 6: User Story 4 — Courses in the statistics (Priority: P2)

**Goal**: a "Stages" block in the statistics, clickable to filter the history.

**Independent Test**: sessions in two courses → block with the right counts → touch one → history filtered with banner.

### Tests (write first, see them fail)

- [x] T020 [P] [US4] In `tests/views/logbook_courses_stats.test.js` (new, same setup as `tests/views/logbook_stats_filter.test.js`): block shown only when a course session exists; one tile per course with flights and times, ground sessions and times, school, specialty; ordered most sessions first; same course in different case or with spaces is one tile; specialty without name → one "Stage sans nom" tile; tile counts add up to the course sessions; touching a tile sets the history filter `stage` (or `stageUnnamed`), the banner shows the course and the count, only its sessions are listed (case-insensitive match), and the filter can be cleared; names with `&` or an apostrophe are escaped and shown as written (title "Filtrer par …")

### Implementation

- [x] T021 [US4] In `js/views/logbook_stats.js` add the "Stages" card after the schools card, from `courseStats(LogbookService.getFlights())`, with `escapeHTML` on every name and `data-action="filterHistoryByStat"` tiles (`data-stat-type="stage"` / `"stageUnnamed"`, value = name / unnamed label), subtitle `stats.courseShare`, texts from `tt()`
- [x] T022 [US4] In `js/views/logbook_history.js` `renderHistory` add the filters `stage` (`isCourseSession` and `courseKey` equals the lower-cased value) and `stageUnnamed` (course session with no name); run T020 to green

**Checkpoint**: all four stories work independently.

---

## Phase 7: End-to-end, documentation and verification

- [x] T023 [P] Write `tests/e2e/logbook_courses.spec.js` (pattern of `tests/e2e/logbook_winch_field.spec.js`: GDPR consent init script, external requests aborted): add a course session with two instructors, open a second form, pick the course name and check the five fields and the explanation line, save, open the statistics, check the "Stages" tile and filter the history; a keyboard-only pass over the instructor add field (Enter adds a chip)
- [x] T024 [P] Update `DOCUMENTATION.md`: add `js/services/logbook_courses.js` to the services list, a short section on the `moniteur` data shape (text or list, `instructorsOf`) and on the course pre-fill order in "Pre-filling learned from the pilot"
- [x] T025 Update the user manual text in `index.html` and `js/i18n/fr_html.js` (the "Session encadrée par une école" line: "du moniteur" → "des moniteurs", and a sentence on stages remembered) keeping both catalogues identical (`tests/views/static_texts.test.js`)
- [ ] T026 Run `npm run lint`, `npm run format:check`, `npm run typecheck` (0 errors), `npx vitest run`, then `npm run verify` and read the final status line (memory: verify before pushing); fix anything it reports
- [ ] T027 Run `npm run test:e2e -- tests/e2e/logbook_courses.spec.js` on Chromium and WebKit, then `npm run verify:full`
- [ ] T028 When the owner asks: commit in small Conventional Commits (`feat(logbook): …`), push `feat/logbook-courses` and open the pull request (merge commit rule). Nothing is committed, pushed or deployed before that

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 (T002–T006) → Phase 3 (US3) → Phase 4 (US1) → Phase 5 (US2); Phase 6 (US4) depends only on Phase 2 and can run in parallel with Phases 3–5; Phase 7 last.
- US1 needs US3 (instructors as chips) and the module (T004). US2 builds on the course step of US1 (T016).
- Inside a story: tests first and seen failing, then implementation in the order listed (T009 → T010 → T011 → T012 for US3).
- `js/views/logbook_learned.js` is touched by T012, T016 and T019, `js/views/logbook_history.js` by T011 and T022, `js/views/logbook_checklists.js` by T009 and T015: those tasks are sequential, not [P].

## Parallel Opportunities

- T002 and T003 (different test files); T007 with T008 only after T004–T006 since both change the form tests (different files, so [P] for T007 alone).
- Phase 6 (T020 → T021 → T022) can be done by a second person while Phases 3–5 are in progress.
- T023 and T024 are independent of each other.

## Implementation Strategy

- **MVP**: Phases 1–3 (module + instructors) deliver the data-loss fix; add Phase 4 for the time saving the pilot asked for most; Phase 5 and 6 complete the request.
- Deliver in one pull request (the request is a single feature); commits per phase keep review easy.
- Out of scope, tracked separately: importing several flight files at once (own specification).
