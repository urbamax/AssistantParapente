# Feature Specification: Pilot Certifications (Brevets) & Progression Tracking

**Feature Branch**: `042-brevets-progression`  
**Created**: 2026-10-27  
**Status**: Draft  
**Input**: User description: "Dans les sessions école, pouvoir indiquer que la session a servi à préparer un brevet (BI, BP, BPC, Treuil), enregistrer la validation d'un brevet pratique et de son examen théorique (date, score/barème avec % auto-calculé, école, moniteur/examinateur), dissocier le niveau de vol (Sites) du niveau théorique travaillé (QCM), et permettre le rattachement rétroactif en lot des sessions école existantes."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Tagging School Sessions with Target Brevet & Retroactive Batch Assignment (Priority: P1)

A pilot recording a school session (flight or ground handling, inside a multi-day course or standalone) wants to indicate which certification (`BI`, `BP`, `BPC`, or `TREUIL`) the session prepares for. If they already logged dozens of school sessions before obtaining their `BI`, they can batch-assign those existing school sessions to `BI` in one click from the Brevets section.

**Why this priority**: Linking practical training sessions to a specific certification is the foundation for tracking training volume per brevet and keeping the logbook accurate without tedious one-by-one editing.

**Independent Test**: Open the logbook session form (`vol` or `gonflage`), tick the school checkbox, verify the "Brevet préparé" selector (`— Aucun / Non précisé —`, `BI`, `BP`, `BPC`, `TREUIL`), save a session, verify the badge on the history card, and test the batch-assignment modal on unassigned school sessions.

**Acceptance Scenarios**:

1. **Given** the session form (`vol` or `gonflage`) with "En école" ticked, **When** the pilot selects `BI — Brevet Initial` in `#lb-brevet-prepare` and saves, **Then** the saved session carries `brevetPrepare: 'BI'` and displays the target brevet on its history card.
2. **Given** the session form with "En école" unticked, **When** the session is saved, **Then** `brevetPrepare` is saved as `""` regardless of any prior selection.
3. **Given** past school sessions with `brevetPrepare: 'BI'` at anécole or inside a `stage`, **When** a new session is opened for that school or course while `BI` is not yet validated before the session date, **Then** `#lb-brevet-prepare` is automatically pre-filled with `'BI'`.
4. **Given** existing school sessions without `brevetPrepare`, **When** the pilot opens the batch-assign modal for `BI` in `Carnet > Statistiques` and confirms, **Then** all checked sessions are updated with `brevetPrepare: 'BI'` and the `BI` training totals update immediately.

---

### User Story 2 - Recording Practical & Theoretical Certifications in Logbook Statistics (Priority: P1)

A pilot who has just passed their `BI` theoretical exam (e.g., `28 / 30`, `93%`) and/or obtained their full practical `BI` certification wants to record these milestones with dates, scores, school, and instructor/examiner, and see a clear overview of all 4 certifications (`BI`, `BP`, `BPC`, `TREUIL`) at the top of `Carnet > Statistiques`.

**Why this priority**: Pilots need a dedicated, persistent record of their official FFVL certifications (both theory and full practical brevet) combined with the logbook sessions that contributed to each certification.

**Independent Test**: Open `Carnet > Statistiques`, verify the "Mes Brevets & Progression" section is visible even with an empty logbook, open the `BI` configuration modal, enter theoretical exam (`28 / 30`, date, school, examiner) and practical validation (date, school, instructor), save, and verify the `BI` card displays both badges and session statistics.

**Acceptance Scenarios**:

1. **Given** `Carnet > Statistiques`, **When** rendered, **Then** the "Mes Brevets & Progression" block displays cards for `BI`, `BP`, `BPC`, and `TREUIL` with their current status (`Validé`, `Théorie validée`, `En préparation`, or `Non commencé`), training session counts (`Vols`, `Gonflage`), and an action button to edit each brevet.
2. **Given** the brevet edit modal for `BI`, **When** the pilot enters `score = 28` and `total = 30`, **Then** the percentage field automatically calculates `93%` (while still allowing direct `%` entry if `score`/`total` are left blank).
3. **Given** a brevet with linked school sessions in `Carnet > Statistiques`, **When** the pilot clicks the session counter/filter on that brevet card, **Then** `Carnet > Historique` opens filtered to only the sessions with `brevetPrepare === code`.

---

### User Story 3 - Dissociating Flight Level (Sites) from Target Theory Level (QCM) (Priority: P1)

When a pilot obtains their `BI` (both practical and theory), two distinct behaviours must happen across the application:
- In **Sites** (Pre-Flight Brief), the pilot flies as a newly certified `BI` pilot (so safety advice and level reminders reflect `BI — Brevet Initial`, their highest validated practical brevet).
- In **Théorie > QCM** and **Statistiques QCM**, since `BI` theory is already validated, the active QCM level automatically advances to `BP` (and after `BP` theory, to `BPC`). If the pilot manually switches the QCM selector back to `BI`, an official validation banner (`Théorie BI validée le [date] — 28/30 (93%)`) is shown and the QCM mode automatically switches to `REVISION` (`Consolidation des acquis`).

**Why this priority**: Newly certified `BI` pilots still fly with `BI` privileges and need `BI`-appropriate flight briefings, while their theoretical study immediately moves on to preparing the `BP` exam.

**Independent Test**: Validate `BI` (practical + theory `28/30`). Verify `GlobalState.get('level')` advances to `'BP'`. Open `Théorie > QCM`: verify `'BP'` is active, then click `'BI'` and verify the official theory badge and automatic switch to `'REVISION'` mode. Open a site's Pre-Flight Brief in `Sites`: verify the pilot level shown is `Brevet Initial` (`BI`).

**Acceptance Scenarios**:

1. **Given** `BI` theory is newly marked as passed (or `BI` practical is validated), **When** saved, **Then** `GlobalState.get('level')` automatically advances to `'BP'` (the next unvalidated theory level in `BI → BP → BPC`).
2. **Given** `BI` theory is validated (`28/30`, `93%`), **When** the pilot selects `BI` in `#qcm-setup-screen` or `#stats-screen`, **Then** an official banner displays the validation date and score, and in `#qcm-setup-screen` the mode automatically switches to `REVISION`.
3. **Given** `BI` practical is validated and `BP` practical is NOT validated while `GlobalState.get('level')` is `'BP'`, **When** the pilot opens the Pre-Flight Brief on a site in `Sites`, **Then** the brief displays `Brevet Initial` (`BI`) as the pilot's flight level.
4. **Given** `BI` practical is validated on `2026-10-26`, **When** the pilot logs a new school session on `2026-10-27` at the same school, **Then** learned defaults suggest `brevetPrepare: 'BP'` instead of `'BI'`.

---

### Edge Cases

- **No brevet configured yet**: All existing behaviour is preserved (Sites falls back to `GlobalState.get('level')`, QCM defaults to `BI`, learned defaults do not inject `brevetPrepare` unless past sessions or configured brevets exist).
- **Qualification Treuil (`TREUIL`)**: Independent from the `BI → BP → BPC` progression chain; validating `TREUIL` does not alter `GlobalState.get('level')` or the `BI → BP → BPC` chain.
- **Direct percentage without score/total**: Pilots who only remember their percentage (e.g. `85%`) without the exact fraction can enter `85` directly; if both `score` and `total` (`> 0`) are provided, `percentage` is computed as `Math.round((score / total) * 100)` clamped to `0..100`.
- **Cloud Sync (`mergePreferences`)**: `brevets` inside `USER_PREFS` merges per brevet key (`BI`, `BP`, `BPC`, `TREUIL`) using `updatedAt` timestamps so no certification data is lost across devices.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support 4 certification codes (`BI`, `BP`, `BPC`, `TREUIL`), where `['BI', 'BP', 'BPC']` form the ordered progression chain and `'TREUIL'` is an independent qualification.
- **FR-002**: The logbook school block (`renderSchoolBlock` in `js/views/logbook_checklists.js`) MUST include a `#lb-brevet-prepare` select field saved as `brevetPrepare` (`'' | 'BI' | 'BP' | 'BPC' | 'TREUIL'`) on school sessions and cleared to `''` when `#lb-ecole-check` is unticked.
- **FR-003**: `suggestDefaults` (`js/services/logbook_defaults.js`) and `applyLearnedDefaults` (`js/views/logbook_learned.js`) MUST learn `brevetPrepare` from the selected course (`latestOfCourse`) or school habits (`instructorForPlace` / `latestSchool`), and automatically advance a learned `BI`/`BP` to the next level in `['BI', 'BP', 'BPC']` if that brevet was already practically validated strictly before the new session's date.
- **FR-004**: `BrevetService` (`js/services/brevet_service.js`) MUST persist certification records under `brevets` in `StorageService.KEYS.USER_PREFS` (`parapente_user_prefs`) and support per-brevet `updatedAt` merging in `FirebaseAuthEngine.mergePreferences`.
- **FR-005**: `Carnet > Statistiques` (`js/views/logbook_stats.js`) MUST render a "Mes Brevets & Progression" section displaying the 4 brevets, their theoretical and practical status, aggregated school session counts (`Vols`, `Gonflage`, total duration), click-to-filter history (`filterHistoryByStat('brevet', code)`), a modal to edit each brevet's theoretical/practical validation, and a batch-assignment modal to tag existing unassigned school sessions.
- **FR-006**: `QuizView` (`js/views/quiz.js`, `js/views/quiz_stats.js`, `js/views/quiz_stats_html.js`) MUST display the official theoretical exam status banner in `#qcm-setup-screen` and `#stats-screen`, allow opening the brevet theory editor modal directly from QCM/Stats, advance `GlobalState.get('level')` to `getTargetTheoryLevel()` when a theory exam is validated, and auto-select `REVISION` mode when the user selects a level whose official theory exam is already validated.
- **FR-007**: `SitesView.buildPreFlightBriefHtml` (`js/views/sites_list.js`) MUST use `BrevetService.getPracticalPilotLevel()` when at least one practical brevet is validated, falling back to `GlobalState.get('level')` otherwise.

### Key Entities

- **BrevetRecord** (stored in `USER_PREFS.brevets[code]`):
  - `theory`: `{ passed: boolean, date: string, score: number|null, total: number|null, percentage: number|null, school: string, examiner: string, notes: string }`
  - `practical`: `{ validated: boolean, date: string, school: string, instructor: string, notes: string }`
  - `updatedAt`: ISO timestamp string
- **Flight / Ground Session (`brevetPrepare`)**:
  - `brevetPrepare`: `'' | 'BI' | 'BP' | 'BPC' | 'TREUIL'` on logbook entries when `ecole` is non-empty.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A pilot can record or update their `BI` theoretical exam (`28/30` → `93%`) and practical validation in under 30 seconds from either `Carnet > Statistiques` or `Théorie > QCM`.
- **SC-002**: Existing unassigned school sessions can be linked to `BI` in a single batch operation without editing sessions one by one.
- **SC-003**: Validating `BI` (practical + theory) immediately sets the QCM target level to `BP`, switches `BI` QCM setup to `REVISION` mode with an official badge when `BI` is selected, and keeps the Sites Pre-Flight Brief level at `BI` (`Brevet Initial`).
- **SC-004**: 100% of unit, guardrail (`sw_precache`, `inline_strings`, `action_wiring`, `route_code_splitting`, `shared_copy`), and E2E tests pass.
