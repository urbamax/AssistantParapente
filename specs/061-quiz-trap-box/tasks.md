# Tasks: Question-Trap Box in the Quiz Correction

**Input**: Design documents from `/specs/061-quiz-trap-box/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/trap-box-ui.md, quickstart.md

**Tests**: required by the constitution (principle IV, test-first): every test task is written and seen failing before its implementation task.

**Organization**: grouped by user story (US1 training correction, US2 other correction views).

## Phase 1: Setup

- [x] T001 Create `scripts/build_question_traps.mjs`: read the audit file given as argument (`{code: [{element, ou, choix, encart}]}`), keep only the `encart` strings in order, drop codes starting with H, R or X, validate each sentence (non-empty, trimmed, ends with « . », fewer than 140 characters, no verdict word, no address to the learner, no « ; », no straight « " »), and write `js/data/qcm_question_traps.json` with sorted keys, 2-space indent and a trailing newline
- [x] T002 Run `node scripts/build_question_traps.mjs ~/quiz-audit-kit/audit6/pieges_encarts.json` and check the result has 567 keys and 694 sentences in `js/data/qcm_question_traps.json`; run Prettier on it

## Phase 2: Foundational (blocking prerequisites)

- [x] T003 [P] Write `tests/data/quiz_question_traps.test.js` (fails first: file absent): every key is an existing code of `js/data/qcm_ffvl.csv` not starting with H, R or X; each value is an array of 1 to 3 strings; each sentence is trimmed, ends with « . », is fewer than 140 characters, matches none of the verdict words « juste(s), faux, fausse(s), vrai(e)(s), correct(e), exact(e), inexact(e), bonne réponse, à tort, piège », none of the address forms « tu, toi, ton, ta, tes, vous, votre, vos » nor imperatives such as « repérez », « regarde », and contains no « ; » and no straight « " »
- [x] T004 [P] Write `tests/services/quiz_service_traps.test.js` (fails first): with `fetch` mocked, `QuizService.loadOfficialData()` loads `js/data/qcm_question_traps.json`; `getQuestionTraps('A92V')` returns the sentences in order; an unknown code returns an empty frozen array; a failed or non-ok fetch of the traps file still loads the questions and `getQuestionTraps` returns an empty array
- [x] T005 Load the traps JSON best-effort in `QuizService.loadOfficialData()` (stable URL `${basePath}/js/data/qcm_question_traps.json`, fetched with the other quiz files, failure → `{}`) and add `getQuestionTraps(code)` in `js/services/quiz_service.js`; make T004 pass
- [x] T006 [P] Add `./js/data/qcm_question_traps.json` to the pre-cache list in `sw.js` (next to `question_course_mapping.json`) and to `STATIC_PATHS` in `vite.config.mjs`
- [x] T007 [P] Add `quiz.question.readClosely` as `readCloselyTitle: 'À lire de près'` and `readCloselyAria: 'À lire de près : ce qui rend cette question délicate'` in `js/i18n/fr.js`, then run `node scripts/sync_functions_shared.mjs` to update `functions/shared/fr.mjs`
- [x] T008 [P] Write `tests/views/quiz_read_closely.test.js` (fails first): `readCloselyHtml([])`, `null` and `undefined` return `''`; one sentence gives one `<aside class="quiz-read-closely" role="note">` with the title from the catalogue and one paragraph; three sentences give three paragraphs in order; `<`, `>`, `&` and quotes in a sentence are escaped
- [x] T009 Create `js/views/quiz_read_closely.js` exporting `readCloselyHtml(sentences)` per `contracts/trap-box-ui.md` (escape with `escapeHTML()` from `js/core/security.js`, strings via the quiz translation helper); make T008 pass
- [x] T010 [P] Add the `.quiz-read-closely`, `.quiz-read-closely-title` and `.quiz-read-closely-text` styles in `css/quiz.css` with theme tokens (light and dark), a left accent border distinct from the « Piège récurrent » banner, wrapping text and no horizontal overflow at 375 px

## Phase 3: User Story 1 - See the question's trap after answering (Priority: P1) 🎯 MVP

**Goal**: in training, revision and perfecting modes, the correction shows the box above the explanations after an answer.

**Independent Test**: answer a question with a trap: the box appears; before answering: no box in the page; a question without a trap: no box.

- [x] T011 [P] [US1] Extend the existing view test of the answer feedback (the one covering `optionExplanations` in `js/views/quiz.js`, under `tests/views/`) so it fails first: after an answer to a question with traps, the feedback contains `.quiz-read-closely` with the sentences; for a question without traps, no `.quiz-read-closely`; before the answer, the question screen contains none
- [x] T012 [US1] In `js/views/quiz.js`, in the answer feedback (where `optionExplanations(original)` is called and `feedbackDiv.innerHTML` is set), prepend `readCloselyHtml(QuizService.getQuestionTraps(original.code))` to the feedback in both branches (per-choice explanations and whole explanation); make T011 pass
- [x] T013 [P] [US1] Write `tests/e2e/quiz_read_closely.spec.js`: in training mode, before answering a question that has traps the page contains no `.quiz-read-closely` and none of its sentences; after answering it is visible with its title; for a question without traps it is absent; during a mock exam no `.quiz-read-closely` ever appears

## Phase 4: User Story 2 - Same box in the other correction views (Priority: P2)

**Goal**: finished-exam review, question bank, statistics error review and detailed list show the same box.

**Independent Test**: finish a mock exam and open its review: questions with traps show the box; open a question in the bank: the box shows with its explanation.

- [x] T014 [P] [US2] Extend the views tests covering the exam results review and the question bank (`tests/views/`) so they fail first: a reviewed or opened question with traps contains `.quiz-read-closely`; one without traps does not
- [x] T015 [US2] In `js/views/quiz.js`, add `readCloselyHtml(...)` above the per-choice explanations in the finished-exam review of wrong answers and inside the opened question-bank item, above the explanation; make T014 pass
- [x] T016 [P] [US2] Extend the statistics views tests (`tests/views/`) so they fail first: the error review in `js/views/quiz_stats.js` and the content of `buildQuestionAnswersHtml` in `js/views/quiz_stats_html.js` contain the box for a question with traps and not otherwise
- [x] T017 [US2] Add `readCloselyHtml(...)` in `js/views/quiz_stats.js` (above each reviewed question's explanations) and at the top of `buildQuestionAnswersHtml` in `js/views/quiz_stats_html.js`; make T016 pass
- [x] T018 [US2] Covered by view tests instead (`tests/views/quiz_render.test.js`: end-of-series review and exam history review); a full 30-question exam in e2e would only slow the suite

## Phase 5: Polish & cross-cutting

- [x] T019 Update the manual in `js/i18n/fr_html.js`: in `cEstLeModePar` (Mode Entraînement) add one sentence describing the « À lire de près » box (after the answer, names what makes the question tricky, distinct from the « Piège récurrent » banner); in `accessibleDepuisLeMenu` (4. La Banque de Questions) mention that the box appears with the explanations; update any manual test or snapshot this changes
- [x] T020 Run `npx prettier --check`, `npx vitest run` (including `tests/views/inline_strings.test.js` and the snapshots under `tests/views/__snapshots__/`), and update snapshots only where the box is the expected change
- [x] T021 Follow `quickstart.md` manually in the browser preview (light/dark themes, 375 px width) and take a screenshot of the box
- [ ] T022 Open the pull request with `## Discord notice` (the notice from the spec) and `## Discord guide` (the manual sentence to mirror in `#guide-utilisation`); the pre-push hook runs `npm run verify`

## Dependencies & Execution Order

- Setup (T001–T002) → Foundational (T003–T010) → US1 (T011–T013) → US2 (T014–T018) → Polish (T019–T022).
- T005 needs T002 (data) and T004 (test); T009 needs T007 (strings) and T008 (test); T012 needs T005, T009, T010; US2 needs the same foundations, not US1's code.

## Parallel Opportunities

- T003, T004, T006, T007, T008, T010 touch different files and can run together.
- In US2, T014 and T016 (tests) in parallel, then T015 and T017 (different files).

## Implementation Strategy

- MVP: Phases 1–3 (training correction with the box), which already delivers the feature to most learners.
- Then US2 for consistency in the other views, then the manual and the PR.
