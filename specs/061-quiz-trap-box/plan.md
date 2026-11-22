# Implementation Plan: Question-Trap Box in the Quiz Correction

**Branch**: `feat/061-quiz-trap-box` | **Date**: 2026-11-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/061-quiz-trap-box/spec.md`

## Summary

After an answer, the quiz correction shows a box titled « À lire de près » listing the 1 to 3 sentences that name what makes the question tricky. The sentences (694, for 567 questions) come from audit 6 and ship in a new data file keyed by question code. `QuizService` loads it best-effort with the other quiz data and exposes `getQuestionTraps(code)`; a pure helper renders the box; five rendering points already build an answered question's correction and insert it above the choice explanations. Nothing is rendered before an answer, and the mock exam shows no correction while in progress (answering goes straight to the next question), so the box never appears there.

## Technical Context

**Language/Version**: JavaScript ES modules (browser), Node 20 for tests and scripts

**Primary Dependencies**: none new (vanilla views, Remix Icon already loaded)

**Storage**: static JSON file `js/data/qcm_question_traps.json`, fetched at run time and pre-cached by the service worker

**Testing**: Vitest (data, service, helper, views), Playwright (end-to-end)

**Target Platform**: PWA in mobile and desktop browsers, offline-capable

**Project Type**: web application (static PWA)

**Performance Goals**: no visible delay in the correction; one extra ~70 KB JSON fetched once with the quiz data

**Constraints**: offline (service worker pre-cache + `STATIC_PATHS`), no build-only features, escaped output, strings in the i18n catalogue

**Scale/Scope**: 567 questions, 694 sentences; 5 rendering points; 2 manual paragraphs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. User experience and data integrity | Box only after an answer, never empty, readable on phones and in both themes; official question file untouched | Pass |
| II. Decision support | Educational content only, no flight decision | Pass |
| III. Sourced theory content | Sentences describe the wording of the question (which word decides, which choices differ), not new technical claims; they come from the reviewed audit; a data test forbids verdict words and checks codes | Pass (owner reviews a sample) |
| IV. Test-first | Data, service, helper and view tests written first and seen failing; one Playwright spec for before/after answer and exam | Pass |
| V. Offline-first | New JSON in the service worker pre-cache list and loaded with the quiz data; a missing file degrades to "no box" | Pass |
| VI. Privacy and web security | No tracking; sentences escaped with `escapeHTML()` | Pass |
| VII. Web app without mandatory build | Plain `fetch` of a static JSON with a stable URL; file added to `STATIC_PATHS` in `vite.config.mjs` | Pass |
| VIII. Layered architecture | Loading and lookup in `QuizService`; rendering helper in a view module; views only call it | Pass |
| Language / i18n | Title and screen-reader label in `js/i18n/fr.js` (synced to `functions/shared/fr.mjs`); no inline French in views | Pass |
| Manual + Discord | Manual paragraphs « Mode Entraînement » and « 4. La Banque de Questions » updated in the same PR; PR carries `## Discord notice` and `## Discord guide` | Pass |

Post-design re-check: unchanged, all pass.

## Project Structure

### Documentation (this feature)

```text
specs/061-quiz-trap-box/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/trap-box-ui.md
├── checklists/requirements.md
└── tasks.md            (next step: /speckit-tasks)
```

### Source Code (repository root)

```text
js/data/qcm_question_traps.json            NEW  code → [sentence, …]
scripts/build_question_traps.mjs           NEW  builds the JSON from the audit file (kept outside the repo) and validates it
js/services/quiz_service.js                load the JSON best-effort, getQuestionTraps(code)
js/views/quiz_read_closely.js              NEW  readCloselyHtml(sentences), pure helper
js/views/quiz.js                           training/revision/perfecting correction, finished-exam review, question bank
js/views/quiz_stats.js                     error review in the statistics
js/views/quiz_stats_html.js                detailed question list (buildQuestionAnswersHtml)
js/i18n/fr.js, functions/shared/fr.mjs     quiz.question.readClosely (title, aria label)
js/i18n/fr_html.js                         manual paragraphs
css/quiz.css                               .quiz-read-closely box (theme tokens, dark mode)
sw.js, vite.config.mjs                     pre-cache + STATIC_PATHS
tests/data/quiz_question_traps.test.js     NEW
tests/services/quiz_service_traps.test.js  NEW
tests/views/quiz_read_closely.test.js      NEW
tests/e2e/quiz_read_closely.spec.js        NEW
```

**Structure Decision**: single static web app; one new data file, one new view helper, five insertion points in existing views.

## Complexity Tracking

None. The errors workshop and revision axes (`quiz_axes_html.js`) are left out on purpose: they show one choice's explanation line per item, not a question's correction, so a question-level box has no natural place there (the spec's assumptions allow an explicit exclusion; FR-001 is updated accordingly).
