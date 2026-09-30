# Feature Specification: Safety Screen Texts in the Strings Catalogue

**Feature Branch**: `feat/safety-strings`

**Created**: 2026-09-30

**Status**: Draft

**Input**: Constitution audit gap C8, third screen (after specs 014 and 015): move every user-facing text of the safety screen (`js/views/safety.js`: emergency procedure, pre-flight check, "ready for take-off" checklist, SIGR self-assessment, GPS messages) into the strings catalogue, with no visible change. The owner asked to migrate every remaining screen.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pilots see exactly the same safety screen (Priority: P1)

A pilot in an emergency, before a flight or doing a self-assessment reads exactly the same texts as before, in the same order, with the same bold parts, online or offline.

**Independent Test**: the whole page, the pre-flight progress and spoken checklist, the three "ready" verdicts, the SIGR summaries and every GPS message (searching, denied, unavailable, timeout, unknown error, imprecise and precise fix, copy, share, no GPS) are recorded before the change and compared after it.

**Acceptance Scenarios**:

1. **Given** the recorded states, **When** rendered after the change, **Then** they are identical (two paragraphs lose a source line break inside the text, which the browser displays as a space: proven identical once whitespace is normalised).
2. **Given** the exported checklists (`READY_CHECKLIST`, `PREFLIGHT_CHECKLIST`, `SIGR_PLATES`), **When** read by other code and tests, **Then** they keep the same shape and texts.

---

### User Story 2 - The safety screen can be translated from one place (Priority: P1)

Every text is in `FR.safety`; the colour codes, ids and source file paths stay in the code.

**Independent Test**: the shared inline-text check finds nothing in `js/views/safety.js` and every key exists.

### Edge Cases

- FFVL sourced content (booklets, posters) is kept word for word; only its location changes. Bold parts are kept with `<strong>`, the only tag allowed in these catalogue texts; everything else is escaped.
- The safety frequency (`143,9875 MHz`) and source PDF paths are data, not texts.
- Accents: checked, none missing.

## Requirements *(mandatory)*

- **FR-001**: Every user-facing text of `js/views/safety.js` MUST come from `FR.safety`.
- **FR-002**: The displayed safety screen MUST be identical before and after the change (whitespace inside a paragraph excepted).
- **FR-003**: The exported checklists MUST keep their shape (ids, levels, labels).
- **FR-004**: Catalogue texts MUST be escaped, only `<strong>` restored where the source is bold.
- **FR-005**: The shared inline-text check MUST cover the safety screen, and the three migrated screens MUST share one guard test.

## Success Criteria *(mandatory)*

- **SC-001**: 0 inline user-facing texts in the three migrated screens.
- **SC-002**: 100 % of recorded safety states identical (whitespace-normalised).
- **SC-003**: All existing tests pass.

## Assumptions

- Spec numbers 016–018 were taken by parallel quiz work; this feature is 019.
