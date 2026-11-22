# Implementation Plan: Trap-Question Series in Training Mode

**Branch**: `feat/063-trap-series` | **Date**: 2026-11-22 | **Spec**: [spec.md](./spec.md)

## Summary

A « Questions à piège » checkbox in the QCM setup, shown in Training mode only, sets `qcmConfig.trapsOnly`. In `QuizService.startSession`, the training branch then keeps only questions with trap sentences (spec 061 `getQuestionTraps`) and orders them with a pure helper: missed (errors recorded, streak 0), never attempted, the rest, shuffled inside each group, then cut to the chosen count. No trap question → the existing error path with a dedicated message. The mode label shows « MODE ENTRAÎNEMENT · QUESTIONS À PIÈGE ».

## Technical Context

**Language/Version**: JavaScript ES modules (browser); Node 20 for tests
**Primary Dependencies**: none new
**Storage**: none new (in-memory setup state, like count and theme; existing per-question statistics read only)
**Testing**: Vitest (helper, service, view), Playwright (setup → series)
**Target Platform**: PWA, offline once quiz and trap data are cached
**Project Type**: static web application
**Performance Goals**: same start time as today (one filter + one sort over ≤ 775 items)
**Constraints**: draw unchanged when the option is off; exam, revision, perfecting untouched
**Scale/Scope**: 1 service helper, 1 service branch, 1 setup control, 1 label, manual paragraph

## Constitution Check

| Principle | Check | Status |
|---|---|---|
| I. UX and data integrity | Option off = current draw; clear refusal when nothing matches | Pass |
| III. Sourced content | Uses only the spec 061 sentences | Pass |
| IV. Test-first | Helper, service and view tests first, seen failing; e2e for the setup flow | Pass |
| V. Offline-first | Works on cached data; option disabled without trap data | Pass |
| VI. Security | No new HTML from data; label from the catalogue | Pass |
| VIII. Layers | Ordering in `js/services/trap_series.js` (pure), state in `QuizService`, UI in the view | Pass |
| i18n | Strings in `js/i18n/fr.js` and `fr_html.js` (setup label, hint, label, error) | Pass |
| Manual + Discord | « 2. Paramétrage Avancé » updated; PR carries both Discord sections | Pass |

## Project Structure

```text
js/services/trap_series.js          NEW  orderTrapSeries(questions, statsByCode, shuffle)
js/services/quiz_service.js         qcmConfig.trapsOnly, setTrapsOnly(), training branch, hasQuestionTraps()
js/views/quiz.js                    checkbox visibility per mode, change handler, mode label
index.html                          checkbox in #training-options (after the theme group)
js/i18n/fr.js, functions/shared/fr.mjs, js/i18n/fr_html.js, components/manual_modal.html
css/quiz.css                        checkbox row style
sw.js                               pre-cache the new service module
tests/services/trap_series.test.js, tests/services/quiz_service_trap_series.test.js,
tests/views/quiz_render.test.js (setup + label), tests/e2e/quiz_trap_series.spec.js
```

## Complexity Tracking

None.
