# Feature Specification: No "Unregistered action" Warning on Quiz and Equipment Controls

**Feature Branch**: `fix/quiz-action-warnings`

**Created**: 2026-09-30

**Status**: Draft

**Input**: After specs 016 (sites) and 017 (quiz bank filter), an audit of every `data-action` name in the app against the registered handlers, fallback engines and screen-level delegations found the remaining false "Unregistered action triggered" warnings, and quiz settings that run twice per click. Fix them all.

## Context

Audit (133 action names in `index.html` and view templates, checked against the handlers of the running app):

- No control is dead: every action is performed by someone.
- **Quiz screen, 21 names** (`QuizsetThemeSort`, `QuizsetMasteryFilter`, `QuizsetThemeFilter`, `QuizsortQuestions`, `QuizclearAllFilters`, `QuiztoggleQuestionDetails`, `QuiztoggleExamDetails`, `QuizresetStats`, `QuizexportData`, `QuizimportData`, `toggle-option`, `validate-question`, `next-question`, `prev-question`, `finish-session`, `quiz-voice-*`…): the quiz screen's own click delegation performs them, then the app-wide delegation logs the warning. Checked in the browser.
- **Equipment form, 4 selects** (brand, model, size, colour) carry `data-action="document_getElementById"`, a leftover of an old inline handler. The logbook screen's own listener already shows the "Other" field; the attribute only causes the warning. Checked in the browser.
- **Quiz settings run twice**: `setQcmMode`, `setQcmCount` and `setMasteryTarget` are registered app-wide and also handled by the quiz screen's delegation, so each click applies the setting twice (no visible effect today, since each sets a value).

This feature depends on spec 016 (`AppEvents.markHandled`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quiz controls work once, with a clean console (Priority: P1)

A pilot uses the quiz (setup, questions, statistics, voice mode): every control does its job exactly once and the console shows no false warning.

**Independent Test**: with both delegations active, click a quiz control handled by the quiz screen: it runs once, no warning. Click a quiz setting (mode, count, mastery target): it applies once.

**Acceptance Scenarios**:

1. **Given** the quiz statistics, **When** the pilot changes the theme sort, **Then** the sort applies once and no warning is logged.
2. **Given** a question, **When** the pilot selects an answer, **Then** the answer toggles once and no warning is logged.
3. **Given** the quiz setup, **When** the pilot picks a mode, a question count or a mastery target, **Then** the setting applies once.

### User Story 2 - Equipment "Other" fields, with a clean console (Priority: P2)

**Acceptance Scenarios**:

1. **Given** the equipment form, **When** the pilot picks "Autre..." as brand (or model, size, colour), **Then** the free-text field appears and no warning is logged.

### User Story 3 - Real mistakes are still reported (Priority: P2)

1. **Given** a control whose action no one handles, **When** it is clicked on the quiz screen, **Then** the warning is logged.

### Edge Cases

- `goBack` is registered app-wide and also listed by the quiz screen; its only button is on the course screen, where the quiz delegation is not active. The quiz screen's `goBack` case is dead and is removed so the name has one owner.
- The unused aliases `set-mode` and `set-count` (no control uses them) go with their cases.
- When the quiz screen is closed, its delegation is removed: behaviour elsewhere is unchanged.

## Requirements *(mandatory)*

- **FR-001**: A click handled by the quiz screen's own delegation MUST NOT log "Unregistered action triggered".
- **FR-002**: Each quiz control MUST run its action exactly once per click, settings included.
- **FR-003**: Changing an equipment brand, model, size or colour select MUST NOT log the warning, and "Autre..." MUST still show its free-text field.
- **FR-004**: An action that no one handles MUST still log the warning.

## Success Criteria *(mandatory)*

- **SC-001**: 0 "Unregistered action" warnings from the quiz screen and the equipment form.
- **SC-002**: Mode, count and mastery target settings apply once per click.
- **SC-003**: All existing automated tests still pass.

## Assumptions

- Spec 016 (PR #68) is merged before this feature, or together with it.
