# Feature Specification: Quiz Statistics Filter Label Fixes

**Feature Branch**: `fix/quiz-filter-label`

**Created**: 2026-10-01

**Status**: Implemented

**Input**: Two follow-ups from the review of spec 024 (quiz texts in the catalogue), which kept every text identical on purpose:
1. The statistics filter label (« Toutes les questions tentées • Thème: Météo ») inserts the chosen theme name into the page without escaping it.
2. « Détail: » and « Thème: » lack the space before the colon that French typography requires and that the other quiz texts use (« Activité : »).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The theme filter label is shown as text (Priority: P1)

A pilot filters the question list by theme: the label shows the theme name as plain text, whatever characters it contains.

**Independent Test**: render the statistics with a theme filter containing HTML markup: the markup is shown as text, no element is created.

**Acceptance Scenarios**:

1. **Given** a theme filter `<img src=x onerror=…>`, **When** the statistics render, **Then** no `img` element is created and the label shows the text.
2. **Given** the theme filter « Météo », **When** the statistics render, **Then** the label reads « (Toutes les questions tentées • Thème : Météo) ».

### User Story 2 - French punctuation (Priority: P2)

**Acceptance Scenarios**:

1. **Given** a loading error « CORS », **When** the statistics render, **Then** the detail reads « Détail : CORS ».

### Edge Cases

- Theme names come from the app's own question file, so the risk was low; escaping removes it anyway.
- The mastery filter labels (catalogue texts) are escaped too, with no visible change.

## Requirements *(mandatory)*

- **FR-001**: The statistics filter label MUST escape the theme name and the catalogue texts it contains.
- **FR-002**: « Détail » and « Thème » MUST be followed by « : » with a space before the colon.

## Success Criteria *(mandatory)*

- **SC-001**: 0 HTML elements created from a theme name in the filter label.
- **SC-002**: The two texts follow French punctuation; every other quiz render is unchanged (snapshots).
