# Tasks: « Vos pièges » in the Quiz Statistics

**Tests**: required (constitution IV), each written and seen failing first.

## Phase 1: Data

- [x] T001 Build `scripts/build_trap_types.mjs` (audit 6 outputs + `trap-types/out/types.json` → `js/data/qcm_trap_types.json`, codes sorted, H/R/X excluded, types in the allowed list, choices = integer positions valid for the question) and generate the file
- [x] T002 [P] Write `tests/data/quiz_trap_types.test.js` (fails first without the file): every key a paragliding code; every entry `{ type, choices }` with an allowed type and positions within the question's choices; « autre » under 5 %; every code of `qcm_question_traps.json` present

## Phase 2: Counting and loading

- [x] T003 [P] Write `tests/services/trap_stats.test.js`: encounters and falls per type from encoded answer logs (negative touched choice ticked → fall; positive touched choice unticked → fall; all handled → encounter only), questions limited to the given list, sort by falls then rate, empty result without logs
- [x] T004 Implement `js/services/trap_stats.js`; make T003 pass; add to `sw.js`
- [x] T005 Load `qcm_trap_types.json` best-effort in `QuizService.loadOfficialData()`, add `getTrapTypes(code)`, `setTrapType(type)` and the type filter in the trap series; extend `tests/services/quiz_service_trap_series.test.js` first; add the file to `sw.js` and `STATIC_PATHS`

## Phase 3: Statistics section (US1) and training button (US2)

- [x] T006 Extend `tests/views/quiz_render.test.js` first: section lists met types sorted, « N chutes sur M », invitation without encounters, absent without type data; « S'entraîner » starts a series labelled with the type
- [x] T007 Strings in `js/i18n/fr.js` (section title, type names and descriptions, counts, invitation, button, label), `buildTrapStatsHtml` in `js/views/quiz_stats_html.js`, section and `startTrapTypeTraining` in `js/views/quiz_stats.js`, label in `js/views/quiz.js`, styles in `css/quiz.css`; make T006 pass
- [x] T008 Write `tests/e2e/quiz_trap_stats.spec.js`: with a seeded history, the section shows a type with its counts and its button starts a labelled series whose questions all show the box

## Phase 4: Polish

- [x] T009 Manual (catalogue + HTML, edited by hand), full suite, browser check (light/dark, phone), PR with Discord sections (guide field measured)
