# Implementation Plan: Pilot Certifications (Brevets) & Progression Tracking

**Branch**: `042-brevets-progression` | **Date**: 2026-10-27 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/042-brevets-progression/spec.md`

## Summary

Add end-to-end support for FFVL pilot certifications (`BI`, `BP`, `BPC`, `TREUIL`):
1. A pure domain & persistence service (`js/services/brevet_service.js`) storing certification status (practical validation + theoretical exam with score/total and auto-computed `%`) in `parapente_user_prefs.brevets`, with lossless cloud sync in `FirebaseAuthEngine.mergePreferences`.
2. Tagging school sessions (`vol` and `gonflage`) with `brevetPrepare`, smart pre-filling in `suggestDefaults` / `applyLearnedDefaults` that advances to the next brevet once the previous one is validated, history filtering, and retroactive batch assignment of unassigned school sessions.
3. A "Mes Brevets & Progression" dashboard and editor/batch modals in `Carnet > Statistiques`.
4. Dissociation of flight level vs theory level: `Sites` Pre-Flight Brief uses the highest validated practical brevet (`getPracticalPilotLevel()`), while `Théorie > QCM` and `Statistiques QCM` advance to `getTargetTheoryLevel()`, show an official validation banner for passed theory levels, and auto-switch passed levels to `REVISION` mode.

## Technical Context

**Language/Version**: Vanilla JavaScript (ES6+ modules with `// @ts-check` where applicable), HTML5, CSS3  
**Primary Dependencies**: None added (uses existing `StorageService`, `GlobalState`, `LogbookService`, `AppEvents`, `UIManager`, `escapeHTML`, `t`)  
**Storage**: `localStorage` via `StorageService.KEYS.USER_PREFS` (`parapente_user_prefs.brevets`) and `StorageService.KEYS.LOGBOOK` (`parapente_logbook[].brevetPrepare`), synced to Firestore via `FirebaseAuthEngine`  
**Testing**: Vitest + happy-dom (`npm test`), Playwright E2E (`npx playwright test`)  
**Target Platform**: Offline-first PWA (desktop & mobile browsers)  
**Project Type**: Single-page progressive web application  
**Constraints**:
- All UI strings in French in `js/i18n/fr.js` synced to `functions/shared/fr.mjs` via `npm run sync:functions`.
- Zero inline event handlers (`onclick`, `onchange`, `oninput`); all actions wired via `AppEvents.register` in `js/core/main.js` or `QuizView.handleClick`.
- Any new file under `js/` must be added to `CRITICAL_ASSETS` in `sw.js`.
- All user-supplied values interpolated into HTML must be escaped with `escapeHTML()`.

## Constitution Check

- **I. Architectural Integrity**: `BrevetService` is a self-contained service in `js/services/brevet_service.js`; view rendering stays in `js/views/`; event wiring follows `js/core/main.js` and `route_code_splitting.test.js`.
- **II. Code Quality & Verification**: JSDoc types, Prettier formatting, ESLint clean, TypeScript check clean.
- **III. Testing Discipline (Test-First)**: Unit tests for `BrevetService`, `logbook_defaults`, `LogbookView`, `QuizView`, and `SitesView` written before implementation.
- **IV. Security & Data Integrity**: All strings escaped via `escapeHTML()`; cloud merge preserves newer `updatedAt` per brevet.
- **V. UX, Accessibility & Offline-First**: Modals use `role="dialog"`, `aria-modal="true"`, Escape/backdrop close, and `sw.js` precaches `js/services/brevet_service.js`.
- **VI. Language Policy**: Documentation/specs in English, UI copy in French in `js/i18n/fr.js` + `npm run sync:functions`.

## Project Structure

### Documentation (this feature)

```text
specs/042-brevets-progression/
├── spec.md
├── plan.md
├── data-model.md
├── checklists/
│   └── requirements.md
├── contracts/
│   └── ui.md
└── tasks.md
```

### Source Code

```text
js/
├── core/
│   └── main.js                     # Wire brevet modal, batch-assign, and filter actions
├── i18n/
│   └── fr.js                       # French copy for brevets, modals, QCM banner, history badge
├── services/
│   ├── brevet_service.js           # NEW: Brevet state, progression logic, summaries, batch assign, cloud merge
│   ├── firebase_service.js         # Merge brevets in mergePreferences()
│   ├── logbook_defaults.js         # Suggest brevetPrepare from course/habits + advance after validation
│   └── logbook_export.js           # Include brevetPrepare in exported school session details
└── views/
    ├── logbook_checklists.js       # Add #lb-brevet-prepare select inside renderSchoolBlock()
    ├── logbook_form.js             # Read/write/preserve brevetPrepare on session form
    ├── logbook_history.js          # Render brevet badge on history card + filter by 'brevet'
    ├── logbook_learned.js          # LEARNED_FIELD_IDS['lb-brevet-prepare'] + learned pre-fill
    ├── logbook_stats.js            # Render "Mes Brevets & Progression" + edit & batch modals
    ├── quiz.js                     # Theory status banner, auto-advance level, auto-switch passed level to REVISION
    ├── quiz_stats.js               # Render theory status banner in #stats-screen
    ├── quiz_stats_html.js          # HTML builder for theory exam status in QCM stats
    └── sites_list.js               # Use BrevetService.getPracticalPilotLevel() in buildPreFlightBriefHtml()
sw.js                               # Precache ./js/services/brevet_service.js
```

## Complexity Tracking

No constitution violations.
