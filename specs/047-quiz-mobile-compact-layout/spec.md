# Feature Specification: Mobile Quiz Compact Layout

**Feature Branch**: `fix/quiz-mobile-compact-layout`

**Created**: 2026-10-28

**Status**: Ready

**Input**: User requests:
1. « En faisant attention a spec kit, elimine tout l'espace perdu en version mobile »
2. « C'est toute cette partie là qu'il faut retoucher » (cropped screenshot of quiz top section)
3. « Mettre des choses cote a cote etc »
4. « Par exemple, le code de question, le theme et "question x/x" devraient etre les uns a cote des autres »
5. « L'espace au dessus et en dessous du mode est trop trop trop important »
6. « "repondre a la voix" devrait etre sur la meme ligne que "lire" etc »
7. « Retirer l'accord juste en dessous des trois boutons »

## Problem Statement

On mobile devices (viewport <= 768px), the quiz question screen suffers from severe vertical whitespace inflation:
1. Excessive top margin above `#qcm-mode-label` (`margin-top: calc(var(--header-height, 110px) + 12px)` when the mobile floating header is only ~66px high), creating ~56px of empty white space.
2. Excessive margin below `#qcm-mode-label` (`margin-bottom: 32px`).
3. Voice controls in `.qcm-voice-controls` wrap awkwardly across multiple lines due to large button paddings and placing the revocation link `Retirer l'accord` inline with action buttons.
4. Question metadata (`bank-item-code`, `quiz-theme-tag`, and `quiz-progress`) stack into 3 vertical lines instead of sitting side by side on a single line because `.quiz-meta` and `.quiz-header-row` have `flex-direction: column`.
5. Question action buttons at the bottom are pushed behind the floating bottom navigation bar due to insufficient bottom scroll padding.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compact question header and metadata side by side (Priority: P1)

When a pilot takes a quiz on mobile, the question code (e.g. `E27B`), theme (e.g. `MÉCAVOL`), and progress indicator (e.g. `Question 6 / 10`) are arranged horizontally on the same line, with the code and theme aligned to the left and the progress aligned to the right.

**Why this priority**: Directly solves the 3-line stacking issue, saving ~50px of vertical space while keeping metadata clear and legible.

**Independent Test**: Load a quiz question in mobile viewport (<= 768px), verify that `.quiz-meta` has `flex-direction: row` and displays the code, theme tag, and progress on the same row.

**Acceptance Scenarios**:
1. **Given** a quiz question displayed on mobile, **When** metadata is rendered, **Then** `bank-item-code`, `quiz-theme-tag`, and `quiz-progress` are displayed on the same horizontal row.

---

### User Story 2 - Compact mode label and minimal top/bottom spacing (Priority: P1)

When opening the quiz screen on mobile, the mode label (e.g. `MODE ENTRAÎNEMENT`) sits close to the bottom of the top header without excessive gap, and the gap below it to the voice controls or question is tightened.

**Why this priority**: Eliminates over 60px of dead space between the header and the question content.

**Independent Test**: Verify mobile styles for `#qcm-screen .main-stage` and `.level-tag` have compact margins (top margin ~68-70px, bottom margin ~8px).

**Acceptance Scenarios**:
1. **Given** the mobile view of `#qcm-screen`, **When** the page renders, **Then** `.main-stage` margin-top is reduced from 122px to ~70px, clearing the floating header with minimal gap.
2. **Given** `#qcm-mode-label`, **When** rendered on mobile, **Then** its margin-bottom is 8px (down from 32px).

---

### User Story 3 - Voice controls on a single line with consent revocation below (Priority: P1)

When speech synthesis and recognition are available on mobile, the 3 action buttons (« Lire », « Lecture auto », « Répondre à la voix ») are displayed side by side on a single line. The « Retirer l'accord » link (when consent has been granted) is placed cleanly underneath the 3 buttons on its own line.

**Why this priority**: Makes the voice controls compact and structured, preventing disjointed wrapping and keeping the interface predictable.

**Independent Test**: Enable voice mode and consent, verify that the 3 voice buttons are grouped in a horizontal container on one line, and the revocation link is rendered beneath them.

**Acceptance Scenarios**:
1. **Given** voice controls enabled, **When** rendered on mobile, **Then** the 3 action buttons (« Lire », « Lecture auto », « Répondre à la voix ») sit on the same horizontal row.
2. **Given** voice consent granted, **When** rendered, **Then** « Retirer l'accord » is centered directly below the 3 action buttons.

---

### User Story 4 - End-to-end screen fit and bottom bar clearance (Priority: P2)

The entire quiz question, options, and validation button fit on standard mobile screens with minimal or no scrolling required, and bottom padding ensures that action buttons are never obscured by the bottom navigation bar.

**Why this priority**: Enhances ergonomic revision on phones in field conditions (take-off, bus, couch).

**Acceptance Scenarios**:
1. **Given** `#qcm-screen`, **When** scrolled to the bottom on mobile, **Then** `#qcm-actions-container` is fully visible above `.desktop-main-nav` including safe-area insets.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On viewports <= 768px, `.quiz-meta` and `.quiz-header-row` MUST display question code, theme, and progress side by side on a single row.
- **FR-002**: On viewports <= 768px, `#qcm-screen .main-stage` top margin MUST be reduced to ~70px (`calc(var(--header-height, 62px) + 8px)`).
- **FR-003**: On viewports <= 768px, `#qcm-mode-label` (`.level-tag`) bottom margin MUST be reduced to 8px.
- **FR-004**: The voice bar controls (`#qcm-voice-bar`) MUST group the 3 action buttons (`quiz-voice-read`, `quiz-voice-auto`, `quiz-voice-mic`) in a horizontal flex container (`.qcm-voice-buttons`) and place the revocation link (`quiz-voice-revoke`) on its own row below.
- **FR-005**: All voice accessibility attributes (`aria-pressed`, `aria-label`, `aria-live`) and delegated actions MUST be preserved.
- **FR-006**: Bottom padding on `#qcm-screen.mode-screen` MUST include safe-area insets (`env(safe-area-inset-bottom)`) and sufficiently clear `.desktop-main-nav`.

## Success Criteria *(mandatory)*

- **SC-001**: Question metadata (code, theme, progress) render on a single line on viewports <= 768px.
- **SC-002**: Voice action buttons render on a single line with revocation link below on viewports <= 768px.
- **SC-003**: All 1846+ Vitest tests and voice unit tests pass.
- **SC-004**: Code quality checks (lint, format, typecheck) pass with 0 errors.
