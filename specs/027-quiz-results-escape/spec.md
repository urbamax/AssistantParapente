# Feature Specification: Escape Quiz Texts on the Results Screen

**Feature Branch**: `fix/quiz-results-escape`

**Created**: 2026-10-04

**Status**: Implemented

**Input**: Constitution audit gap C6, last remaining part. On the end-of-session results screen, the code, the statement and the explanation of each wrong question are inserted into the page without escaping (`js/views/quiz.js`, `renderExamResults`). Everywhere else in the quiz these texts are escaped.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quiz texts are shown as text on the results screen (Priority: P1)

A pilot finishes a session: the questions they got wrong are listed with their statement and explanation, shown exactly as written, whatever characters they contain.

**Independent Test**: render the results for a wrong question whose code, statement and explanation contain HTML markup: the markup is shown as text and no element is created.

**Acceptance Scenarios**:

1. **Given** a wrong question whose statement contains `<img src=x onerror=…>`, **When** the results render, **Then** no `img` element is created and the statement shows the text.
2. **Given** a wrong question whose explanation reads « interdit < 1000m & soumis à arrêté », **When** the results render, **Then** that text is displayed as is.

### Edge Cases

- The bundled question files contain `<`, `>` and `&` (« < 1000m », « parachute & pod ») but no tag or HTML entity: escaping changes nothing visible for real data.
- Answer texts on this screen are already escaped.

## Requirements *(mandatory)*

- **FR-001**: The results screen MUST escape the question code, statement and explanation before inserting them into the page.
- **FR-002**: Every other quiz render MUST stay identical (spec 024 snapshots).

## Success Criteria *(mandatory)*

- **SC-001**: 0 HTML elements created from quiz data on the results screen.
- **SC-002**: All existing quiz snapshots unchanged.
