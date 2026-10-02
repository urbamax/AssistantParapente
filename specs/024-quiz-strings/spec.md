# Feature Specification: Quiz Screen Texts in the Strings Catalogue

**Feature Branch**: `feat/quiz-strings`

**Created**: 2026-10-01

**Status**: Implemented

**Input**: Constitution audit gap C8, quiz screen (`js/views/quiz.js`, about 110 texts: question bank, mode descriptions, statistics, exam history and review, question, answer feedback, results, dialogs). The owner asked to migrate every remaining screen; the quiz waited until parallel quiz work (specs 016–018, 022) was merged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Same quiz for the pilot (Priority: P1)

**Independent Test**: 11 groups of rendered states recorded before the change (bank full and empty; 4 mode descriptions; statistics without consent, loading, loading error, no question, every mastery filter, theme filter, all levels, a level without questions, question sort buttons; exam history for every level and exam review with and without errors; question in every mode with revision badges and mastery progress; feedback with course link; results for training, revision, mastery, exam passed, failed and invalidated; dialogs) are identical after it. The other dialogs (import) are checked by comparing every catalogue text with the previous code.

### User Story 2 - Translatable from one place (Priority: P1)

**Independent Test**: the shared inline-text check finds nothing in `js/views/quiz.js` and every key exists.

### Edge Cases

- Theme names (`Météo`, `Mécavol`…) come from the question file and are compared with it by the filters: they stay data. Level codes stay data.
- Singular and plural forms that were built by appending « s » become two catalogue entries (same rendering).
- Accents: checked, none missing.

## Requirements *(mandatory)*

- **FR-001**: Every user-facing text of `js/views/quiz.js` MUST come from `FR.quiz`.
- **FR-002**: Rendered quiz states MUST be identical before and after.
- **FR-003**: The shared inline-text check MUST cover the quiz (own helpers `tq` / `tqh` / `tql`) and ignore CSS values.

## Success Criteria *(mandatory)*

- **SC-001**: 0 inline user-facing texts in the six migrated files.
- **SC-002**: 100 % of the recorded quiz states identical; 104 of 108 catalogue texts found word for word in the previous code, the 4 others being explicit plural forms.
