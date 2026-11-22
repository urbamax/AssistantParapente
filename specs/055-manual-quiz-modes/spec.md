# Feature Specification: Manual Quiz Modes Fix

**Feature Branch**: `docs/055-manual-quiz-modes`

**Created**: 2026-11-22

**Status**: Draft

**Input**: Owner report: « Et le mode perfectionnement dans le guide ? c'est pas bon je pense ». Follow-up to spec 053, whose audit marked these texts « kept » by mistake.

## Context

Three statements of the QCM tab of the manual (and the matching Discord guide card) no longer match the app:

| Manual / guide says | App does | Source |
|---|---|---|
| Perfectionnement: target « 50%, 75% ou 100% » | « Palier objectif » slider, 1 % steps, from current mastery + 1 % to 100 %; current mastery shown; mastery = correct answers among the last 10 attempts (empty slots count as missing); series lengthens after an error and shortens when fewer questions suffice; live progress; start disabled when the whole scope is at 100 % | `index.html` `#mastery-target-slider`, `QuizService.getMasteryTargetBounds`, `advanceMasteryProgress`, `js/services/mastery.js` |
| Révision: fixed intervals « 1, 3, 7, 14 puis 30 jours » | SM-2: 1 day, then 6 days, then the previous interval times an ease factor (2.5 at start, +0.1 per correct answer, lowered after an error, never below 1.3); a missed question is due again at once | `js/services/review_scheduler.js` |
| Question count « 10, 20, 30, 40 ou TOUTES » | Slider from 5 to 50 in steps of 5; its last position means all questions | `#qcm-count-slider`, `js/views/quiz.js` |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The pilot reads how the quiz modes really work (Priority: P1)

**Independent Test**: the QCM tab of the manual and the Discord card « 5. QCM & théorie » describe the slider target, SM-2 intervals and the count slider; none of the old wordings remain.

**Acceptance Scenarios**:

1. **Given** the manual, **When** a pilot reads « Mode Perfectionnement », **Then** it describes a target chosen with a slider from the current mastery to 100 %, and how mastery is measured.
2. **Given** the manual, **When** a pilot reads « Mode Révision », **Then** it gives 1 day, 6 days, then growing intervals depending on their answers, not fixed 1-3-7-14-30 days.
3. **Given** the manual, **When** a pilot reads « Paramétrage Avancé », **Then** the count is a slider from 5 to 50, last position = all.

## Requirements *(mandatory)*

- **FR-001**: The three statements above MUST match the app in the manual (HTML and catalogue, identical).
- **FR-002**: The old wordings (« 50%, 75% ou 100% », « 1, 3, 7, 14 puis 30 jours », « 10, 20, 30, 40 ou TOUTES ») MUST NOT appear in the manual for any role.
- **FR-003**: The Discord guide card « 5. QCM & théorie » (owner's local tooling) MUST say the same; it is republished after deployment with the owner's approval.

## Success Criteria *(mandatory)*

- **SC-001**: 0 occurrences of the three old wordings in the manual, for every role.
- **SC-002**: The 053 audit file records the three rows as corrected.

## User Manual Impact *(mandatory)*

- **Sections checked**: QCM (all four modes, Paramétrage Avancé, Banque, Axes, Sigles).
- **Updates required**: Mode Révision, Mode Perfectionnement, Paramétrage Avancé.
- **Outdated content found nearby**: the setup-screen description of Révision (`js/i18n/fr.js`, `qcmSetupScreen.modes.revisionDescription`) says a missed question comes back « dès le lendemain », while it is due again at once. App text, not the manual: left for its own change.
- **Discord guide (`#guide-utilisation`)**: card « 5. QCM & théorie », lines Révision and Perfectionnement.

## Release Announcement *(mandatory)*

- **Availability**: All users.
- **Discord notice**: none of its own. This corrects the 053 manual update announced on 2026-11-22; republishing `#guide-utilisation` is enough.

## Assumptions

- The reference is `origin/main` at 2026-11-22 (after PR 325).
