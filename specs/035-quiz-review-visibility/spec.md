# Feature Specification: Spaced Repetition Made Visible and Tested (Quiz "Révision" mode)

**Feature Branch**: `feat/quiz-review-visibility`
**Status**: Draft
**Related**: Constitution v1.0.0 — Principle I (the app never silently does something different from what it shows), IV (tests first), V (spaced-repetition state is merged across devices without loss).

## What already exists

The "Révision" mode already schedules questions: each question remembers its streak of
consecutive correct answers and the time it was last seen (`streak`, `lastSeen` in the persistent
stats, merged between devices by `FirebaseAuthEngine.mergeQcmStats`). The interval before a
question is due grows with the streak: 0, 1, 3, 7, 14, then 30 days. Never-seen questions come
first, then the most overdue ones.

## Problem

1. The schedule is invisible. The pilot cannot tell how many questions are due, and when nothing is
   due the session silently falls back to the questions closest to their due date.
2. The description of the mode ("retravaillez vos points faibles") does not say that it is a
   spaced-repetition mode.
3. The scheduling logic lives inline in `startSession` and is not tested: the existing tests only
   cover the legacy fallback for stats recorded without `lastSeen`.

## User Stories

1. **See what is due.** When the pilot selects the Révision mode, a line says how many questions
   are due and how many are new, for the current level and theme.
2. **Be told when nothing is due.** If nothing is due, the line says so, gives the next due date,
   and says what the session will contain instead.

## Requirements

- **FR-1**: The scheduling rule is unchanged (same intervals, same ordering, same legacy fallback).
  It moves to a pure module, `js/services/review_scheduler.js`, covered by unit tests.
- **FR-2**: The module exposes, for a question's stats: the interval in days for a streak, whether
  the question is due, and the time it becomes due; and, for a set of questions, a summary
  (`total`, `fresh`, `due`, `notDue`, `nextDueAt`).
- **FR-3**: `QuizService.getReviewSummary(level)` applies the same level and theme filters as a
  session and returns that summary.
- **FR-4**: The summary line is shown only in Révision mode, and refreshed when the mode or the
  theme changes. Texts live in `js/i18n/fr.js`.
- **FR-5**: The mode description states that questions come back at growing intervals.

## Out of Scope

- A per-question difficulty factor (SM-2 "ease"): the fixed intervals are kept.
- Push notifications for due questions.
