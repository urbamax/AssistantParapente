# Implementation Plan: « Vos pièges » in the Quiz Statistics

**Branch**: `feat/064-trap-stats` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

## Summary

A new data file `js/data/qcm_trap_types.json` gives, per question code, its traps as `{ type, choices }` (choice positions in the official file), built from audit 6 and a one-off classification. A pure service `js/services/trap_stats.js` reads each question's answer log (`readAnswerLog`) and counts, per type, encounters and falls (a touched choice with negative points ticked, or with positive points unticked). The statistics page renders a « Vos pièges » section (between the success gauge buttons and the distribution) with one line per met type and a « S'entraîner » button. The button starts a spec 063 trap series restricted to that type (`QuizService.setTrapType(type)`), with a label naming the type.

## Technical Context

**Language/Version**: JavaScript ES modules; Node 20 for tests and the build script
**Primary Dependencies**: none new
**Storage**: static JSON (pre-cached, `STATIC_PATHS`); reads existing statistics only
**Testing**: Vitest (data, counting service, view), Playwright (section + training button)
**Target Platform**: PWA, offline once cached
**Constraints**: counts follow the official choice order (answer log masks); level filter of the page respected
**Scale/Scope**: 694 traps, 6 learner-facing types

## Constitution Check

| Principle | Check | Status |
|---|---|---|
| I. UX / data integrity | Read-only use of statistics; section absent without data | Pass |
| III. Sourced content | Types describe the wording, not technical claims | Pass |
| IV. Test-first | Data, counting and view tests first, seen failing; e2e | Pass |
| V. Offline | New JSON pre-cached; missing file → no section | Pass |
| VI. Privacy | Computed on the device from existing stats | Pass |
| VIII. Layers | Counting in a pure service; rendering in a stats HTML helper | Pass |
| i18n | Type names, descriptions, labels in `js/i18n/fr.js` | Pass |
| Manual + Discord | Statistics description updated; PR sections; guide field length measured | Pass |

## Project Structure

```text
js/data/qcm_trap_types.json            NEW  code → [{ type, choices }]
scripts/build_trap_types.mjs           NEW  builds it from the audit files, validates
js/services/trap_stats.js              NEW  countTrapFalls(questions, statsByCode, trapTypes)
js/services/quiz_service.js            load trap types best-effort; getTrapTypes(code); setTrapType(); series filter by type
js/views/quiz_stats_html.js            buildTrapStatsHtml(rows)
js/views/quiz_stats.js                 section in renderStats; startTrapTypeTraining(type)
js/views/quiz.js                       series label with the type
js/i18n/fr.js (+ functions/shared/fr.mjs), js/i18n/fr_html.js, components/manual_modal.html
css/quiz.css, sw.js, vite.config.mjs
tests/data/quiz_trap_types.test.js, tests/services/trap_stats.test.js,
tests/services/quiz_service_trap_series.test.js (type filter), tests/views/quiz_render.test.js, tests/e2e/quiz_trap_stats.spec.js
```

## Complexity Tracking

None.
