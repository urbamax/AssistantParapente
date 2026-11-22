# Tasks: Trap-Question Series in Training Mode

**Tests**: required (constitution IV): each test task is written and seen failing before its implementation.

## Phase 1: Foundational

- [x] T001 [P] Write `tests/services/trap_series.test.js`: `orderTrapSeries(questions, statsByCode, shuffle)` puts missed questions (stats with `total > correct` and `streak` 0) first, never-attempted next, the rest last; keeps every input question exactly once; uses the given shuffle inside each group; handles missing stats
- [x] T002 Implement `js/services/trap_series.js` (pure, no imports from views); make T001 pass; add it to `sw.js`
- [x] T003 [P] Write `tests/services/quiz_service_trap_series.test.js`: with `trapsOnly` on in TRAINING, `startSession` returns only questions with traps, within theme, missed first, capped at count; fewer than count → all of them; none → throws the catalogue message `quiz.dialogs.noTrapQuestion`; with `trapsOnly` off the draw path is unchanged; EXAM/REVISION/MASTERY ignore `trapsOnly`
- [x] T004 Add `trapsOnly: false` to `qcmConfig`, `setTrapsOnly(on)`, `hasQuestionTraps()` and the training branch in `js/services/quiz_service.js`; make T003 pass
- [x] T005 [P] Add strings to `js/i18n/fr.js` (`quiz.modes.labels.TRAINING_TRAPS`, `quiz.dialogs.noTrapQuestion`) and `js/i18n/fr_html.js` (`qcmSetupScreen.questionsAPiege`, `qcmSetupScreen.questionsAPiegeAide`); run `node scripts/sync_functions_shared.mjs`

## Phase 2: User Story 1 + 2 (P1, P2)

- [x] T006 [US1] Extend `tests/views/quiz_render.test.js` (fails first): the checkbox is visible in TRAINING and hidden in EXAM, REVISION, MASTERY; checking it calls `setTrapsOnly(true)`; disabled when `hasQuestionTraps()` is false; the series label reads « MODE ENTRAÎNEMENT · QUESTIONS À PIÈGE » when on
- [x] T007 [US1] Add the checkbox to `index.html` in `#training-options` after `#qcm-theme-group`; wire visibility in `updateModeUI`, the change handler and the label in `js/views/quiz.js`; style in `css/quiz.css`; make T006 pass
- [x] T008 [US1] Write `tests/e2e/quiz_trap_series.spec.js`: with the option on, a 5-question training series shows the « À lire de près » box after every answer; with no trap data the option is disabled

## Phase 3: Polish

- [x] T009 Manual: `enModeEntrainementOu` in `js/i18n/fr_html.js` and the same text in `components/manual_modal.html` (edit by hand, never Prettier-write that file); update any snapshot that changes
- [x] T010 Full `npx vitest run`, Prettier check, browser check of the setup (light/dark, 375 px), then the PR with `## Discord notice` and `## Discord guide`
