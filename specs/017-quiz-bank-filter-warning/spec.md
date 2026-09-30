# Feature Specification: No "Unregistered action" Warning on the Quiz Bank Theme Filter

**Feature Branch**: `fix/quiz-bank-filter-warning`

**Created**: 2026-09-30

**Status**: Draft

**Input**: The quiz bank theme filter (`#bank-theme-filter`) carries `data-action="renderQcmBank"`. No handler has that name, so every theme change logs "Unregistered action triggered: renderQcmBank". Check whether the filter works, then stop the warning.

## Context

Checked in the browser (`/?mode=QCM_BANK`): choosing "Météo" does filter the list (only Météo questions remain). The quiz screen attaches its own `change` listener to the select when it opens and renders the bank itself. The app-wide delegation then sees the same `data-action`, finds no handler and logs the warning. The `data-action` attribute is a leftover that nothing uses.

Registering `renderQcmBank` app-wide would render the list twice per change (it holds hundreds of questions). Marking the event as handled needs `AppEvents.markHandled` (spec 016), not merged yet. Removing the unused attribute is enough.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Theme filter works once, with a clean console (Priority: P1)

A pilot browsing the question bank picks a theme: the list shows only that theme's questions, rendered once, and the console shows no false warning.

**Independent Test**: with the app-wide delegation and the quiz screen listener active, change the theme filter: the bank renders once with the chosen theme and no "Unregistered action" warning is logged.

**Acceptance Scenarios**:

1. **Given** the question bank, **When** the pilot picks "Météo", **Then** only Météo questions are listed and no warning is logged.
2. **Given** a theme is picked, **When** the pilot picks "Tous les thèmes", **Then** all questions of the level are listed again.

### Edge Cases

- The keyword search box next to the filter keeps working with the chosen theme (same listener, unchanged).
- Changing the level while the bank is open still re-renders with the chosen theme (unchanged).
- Out of scope: the sites screen controls (spec 016).

## Requirements *(mandatory)*

- **FR-001**: Changing the quiz bank theme filter MUST NOT log "Unregistered action triggered".
- **FR-002**: The bank MUST be rendered exactly once per theme change, with only the chosen theme's questions.

## Success Criteria *(mandatory)*

- **SC-001**: 0 "Unregistered action" warnings when using the theme filter.
- **SC-002**: All existing automated tests still pass.

## Assumptions

- The quiz screen's own listener stays the one that renders the bank.
