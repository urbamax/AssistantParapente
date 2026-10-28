# Implementation Plan: Mobile Quiz Compact Layout

**Branch**: `fix/quiz-mobile-compact-layout` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

## Summary

Eliminate wasted vertical whitespace on mobile in the quiz question screen:
1. Wrap voice action buttons into `.qcm-voice-buttons` and place `.qcm-voice-link` (Retirer l'accord) on its own line below.
2. In `css/quiz.css`, for viewports <= 768px:
   - Adjust `.main-stage` top margin to `calc(var(--header-height, 62px) + 8px)`.
   - Reduce `.level-tag` bottom margin from 32px to 8px.
   - Set `.quiz-header-row` and `.quiz-meta` to `flex-direction: row`, `align-items: center`, `justify-content: space-between`, placing code, theme, and progress side by side.
   - Make `.qcm-voice-buttons` distribute the 3 action buttons horizontally on one line with compact padding/typography.
   - Adjust `#qcm-screen.mode-screen` bottom padding with safe-area insets.

## Technical Context

JavaScript ES modules, CSS3 flexbox and media queries, Vitest (happy-dom). No new dependencies or storage schema changes.

## Constitution Check

| Principle | Status |
|-----------|--------|
| I. UX and data integrity | Pass: compact layout enhances readability on mobile phones, keeping full question and options visible without scrolling |
| II. Decision Support | Not concerned |
| III. Sourced Content | Not concerned |
| IV. Test-first | Pass: unit tests verify voice bar DOM hierarchy and regression tests |
| V. Offline-First | Pass: purely presentation and local DOM |
| VI. Privacy & Security | Pass: voice consent revocation link remains prominent and functional |
| VII. Web App / No Build | Pass: standard native ES modules and CSS |
| VIII. Layered Architecture | Pass: UI rendering in `quiz_voice_ui.js`, styling in `css/quiz.css` |

No violation.

## Project Structure

```text
js/views/quiz_voice_ui.js                             # wrap 3 voice buttons into .qcm-voice-buttons and place revoke link below
css/quiz.css                                          # mobile styles for .quiz-meta, .level-tag, .main-stage, .qcm-voice-buttons
tests/views/quiz_voice.test.js                        # unit tests verifying .qcm-voice-buttons container and button placement
```
