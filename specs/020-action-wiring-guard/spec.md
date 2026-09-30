# Feature Specification: Automated Check That Every Control Is Wired

**Feature Branch**: `test/action-wiring-guard`

**Created**: 2026-09-30

**Status**: Draft

**Input**: Specs 016 to 019 fixed controls wired to nothing, to a method that does not exist, twice, or with leftover code as arguments. Each was found by hand. Add an automated check so these mistakes fail the tests instead of reaching pilots.

## Context

Mistakes found so far, and whether a check would have caught them:

| Mistake | Spec | Caught by |
|---|---|---|
| Control whose action name nobody handles (false or real) | 016, 017, 018 | every name must have an owner |
| "Mot de passe oublié ?" mapped to a method that does not exist | 019 | a mapped method must exist |
| Quiz settings handled by both the app and the quiz screen | 018 | one owner per name |
| `data-args="this.value"`, `document.getElementById(...` | 019 | no code text in arguments |

This feature depends on specs 018 (PR #73) and 019 (PR #76): before them, the check fails on the mistakes they fix.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A miswired control fails the tests (Priority: P1)

A developer adds or renames a control, or a handler, and gets it wrong: the test suite fails and names the control and its file.

**Acceptance Scenarios**:

1. **Given** a control whose action name nobody handles, **When** the tests run, **Then** they fail naming it.
2. **Given** a registered name mapped to a method that does not exist, **When** a control uses it, **Then** the tests fail naming it.
3. **Given** a quiz screen action also registered app-wide, **When** the tests run, **Then** they fail naming it.
4. **Given** a control whose arguments contain code text (`this.`, `document.`), **When** the tests run, **Then** they fail naming it.
5. **Given** the current app, **When** the tests run, **Then** they pass.

### Edge Cases

- A name built at run time (template placeholder) is skipped; the quiz voice bar's placeholder only reuses names already listed.
- Controls listened to directly by a screen (by element id) cannot be detected; `DOCUMENTATION.md` states they must not carry a `data-action`.

## Requirements *(mandatory)*

- **FR-001**: The tests MUST fail when a `data-action`, `data-change-action`, `data-input-action`, `data-enter-action` or `data-backdrop-action` name has no owner (registered handler, fallback engine method, or screen delegation for `data-action`).
- **FR-002**: The tests MUST fail when a used registered name forwards to a method that does not exist.
- **FR-003**: The tests MUST fail when a quiz screen action name is also registered app-wide.
- **FR-004**: The tests MUST fail when control arguments contain code text.
- **FR-005**: Failure messages MUST name the action and where it is used.

## Success Criteria *(mandatory)*

- **SC-001**: Each mistake of specs 016–019, reintroduced, makes the tests fail.
- **SC-002**: The current app passes.

## Assumptions

- The check reads the source files (no browser); the registrations of `js/core/main.js` are read from its source because the file boots the whole app when imported.
