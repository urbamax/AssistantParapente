# Tasks: Pilot Certifications (Brevets) & Progression Tracking

**Input**: Design documents from `/specs/042-brevets-progression/`  
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md), [contracts/ui.md](contracts/ui.md)

## Phase 1: Foundational Domain Service & i18n (`BrevetService`)

- [x] T001 Write unit tests for `BrevetService` in `tests/services/brevet_service.test.js` (normalization, score/percentage auto-calculation, `getPracticalPilotLevel`, `getTargetTheoryLevel`, `isTheoryValidated`, `getTargetSchoolBrevet`, `resolveSuggestedBrevet`, `brevetSummary`, `unassignedSchoolSessionsFor`, `batchAssignBrevet`, `mergeBrevets`).
- [x] T002 Implement `js/services/brevet_service.js`, register `./js/services/brevet_service.js` in `sw.js` `CRITICAL_ASSETS`, and wire `mergeBrevets` in `js/services/firebase_service.js`.
- [x] T003 Add French UI strings in `js/i18n/fr.js` and run `npm run sync:functions` to update `functions/shared/fr.mjs`.

## Phase 2: User Story 1 - School Sessions (`brevetPrepare`) & Learned Defaults (Priority: P1)

- [x] T004 [US1] Extend `tests/services/logbook_defaults.test.js` with tests for learning `brevetPrepare` from courses and school habits, and advancing `brevetPrepare` (`BI` → `BP`) when `BI` was validated prior to the session date.
- [x] T005 [US1] Update `js/services/logbook_defaults.js` and `js/views/logbook_learned.js` (`LEARNED_FIELD_IDS['lb-brevet-prepare'] = 'brevetPrepare'`) to suggest `brevetPrepare`.
- [x] T006 [US1] Write form and history unit tests in `tests/views/logbook_brevets.test.js` covering `#lb-brevet-prepare` in `vol` and `gonflage`, clearing when `#lb-ecole-check` is unticked, history badge rendering, and history filtering by `brevet`.
- [x] T007 [US1] Implement `#lb-brevet-prepare` in `js/views/logbook_checklists.js`, `js/views/logbook_form.js`, `js/views/logbook_history.js`, and `js/services/logbook_export.js`.

## Phase 3: User Story 2 - "Mes Brevets & Progression" Dashboard, Edit Modal & Batch Assign (Priority: P1)

- [x] T008 [US2] Write unit tests in `tests/views/logbook_brevets.test.js` for `[data-brevets-stats]` rendering (empty and populated logbook), editing a brevet via `#lb-brevet-modal` (theory `28/30` → `93%` + practical validation), and retroactive batch assignment via `#lb-brevet-batch-modal`.
- [x] T009 [US2] Implement `[data-brevets-stats]`, `#lb-brevet-modal`, and `#lb-brevet-batch-modal` in `js/views/logbook_stats.js` and wire actions in `js/core/main.js`.

## Phase 4: User Story 3 - QCM Theory Progression & Sites Flight Level Dissociation (Priority: P1)

- [x] T010 [US3] Write unit tests in `tests/views/quiz_brevets.test.js` and `tests/views/sites_details.test.js` for automatic theory level advancement (`BI` → `BP`), official theory badge in `#qcm-setup-screen` and `#stats-screen`, automatic `REVISION` mode selection when picking a validated theory level, and `SitesView.buildPreFlightBriefHtml` using `getPracticalPilotLevel()`.
- [x] T011 [US3] Implement QCM theory banner and auto-`REVISION` mode in `js/views/quiz.js`, `js/views/quiz_stats.js`, `js/views/quiz_stats_html.js`, and practical pilot level lookup in `js/views/sites_list.js`.

## Phase 5: E2E Verification, Documentation & Quality Gates

- [x] T012 Create Playwright E2E test `tests/e2e/brevets_progression.spec.js` and update `DOCUMENTATION.md`.
- [x] T013 Run `npm run sync:functions`, `npm run format`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
