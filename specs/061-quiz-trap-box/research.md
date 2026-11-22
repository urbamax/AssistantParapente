# Research: Question-Trap Box (061)

## Where the correction is rendered

- **Decision**: insert the box at the five places that build an answered question's correction: `js/views/quiz.js` (training/revision/perfecting feedback after an answer, around `optionExplanations(original)` in the answer handler; finished-exam review of wrong answers; question bank items), `js/views/quiz_stats.js` (error review), `js/views/quiz_stats_html.js` (`buildQuestionAnswersHtml`, detailed list).
- **Rationale**: these are exactly the callers of `optionExplanations()`, i.e. every view that shows a question's per-choice correction.
- **Alternatives considered**: the errors workshop and revision axes (`quiz_axes_html.js`) show a single choice's line per item; a question-level box would be out of place there, so they are excluded explicitly.

## Exam in progress

- **Decision**: no special code: in exam mode the answer handler goes straight to the next question and renders no feedback; the box only lives in feedback/review markup.
- **Rationale**: FR-003 is guaranteed by placement; an end-to-end test checks it.

## Data file and loading

- **Decision**: `js/data/qcm_question_traps.json`, an object `{ "A12B": ["…", "…"], … }`, fetched with a stable URL in `QuizService.loadOfficialData()` next to `question_course_mapping.json`, best-effort (failure → `{}`), and exposed by `getQuestionTraps(code)` returning a frozen array (empty when none).
- **Rationale**: same pattern as the course mapping; keeps `qcm_ffvl.csv` and the explanations CSV untouched; only the learner-facing sentences ship (the audit's internal fields stay in the kit).
- **Alternatives considered**: a column in the explanations CSV (would mix two kinds of content and complicate the per-choice split); embedding in a JS module (cache-busting and size in the app bundle).

## Rendering and escaping

- **Decision**: pure helper `readCloselyHtml(sentences)` in `js/views/quiz_read_closely.js` returning `''` for an empty list, else an `<aside class="quiz-read-closely" role="note" aria-label="…">` with a title row (eye icon + « À lire de près ») and one `<p>` per sentence (or a list when there are several), each sentence passed through `escapeHTML()`.
- **Rationale**: one place for markup and escaping (principle VI); testable without the DOM.
- **Alternatives considered**: `annotateAcronyms` on the sentences (they rarely contain acronyms; kept out to stay simple).

## Building the data

- **Decision**: a small Node script reads the audit file (`~/quiz-audit-kit/audit6/pieges_encarts.json`, outside the repo), keeps only `encart` strings in order, validates them with the same rules as the data test, and writes the JSON (sorted keys, 2-space indent, trailing newline, Prettier-clean).
- **Rationale**: reproducible regeneration when sentences are edited.

## Offline and build

- **Decision**: add the JSON to the service worker pre-cache list (`sw.js`, next to `question_course_mapping.json`) and to `STATIC_PATHS` in `vite.config.mjs`.
- **Rationale**: principles V and VII.
