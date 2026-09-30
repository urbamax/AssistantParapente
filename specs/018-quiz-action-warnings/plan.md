# Implementation Plan: No "Unregistered action" Warning on Quiz and Equipment Controls

**Branch**: `fix/quiz-action-warnings` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

## Summary

- `QuizView.handleClick` (bubble phase on `document.body`, active while the quiz screen is
  mounted) runs before `EventDelegator` (bubble phase on `document`). When its `switch` handles
  the action, it calls `AppEvents.markHandled(e)` (spec 016): `dispatch()` then skips the
  fallback and the warning.
- The `setQcmMode`/`set-mode`, `setQcmCount`/`set-count`, `setMasteryTarget` and `goBack` cases
  are removed from that `switch`: `js/core/main.js` already registers these names, and a marked
  event still runs its registered handler, so keeping them would run the setting twice.
- The four equipment selects lose `data-action="document_getElementById"` and its `data-args`;
  `LogbookView`'s `setupAutreListener` keeps showing the "Other" field.

Rejected: registering the quiz names in `main.js` and deleting the quiz `switch` — 21 names to
list and keep in sync, for the same result.

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| I. UX and data integrity | PASS | Each action runs once; settings unchanged |
| IV. Test-first | PASS | Regression tests seen failing before the fix |
| VII. No build | PASS | Plain modules |

## Project Structure

```text
js/views/quiz.js                    # handleClick marks handled events; duplicate cases removed
index.html                          # 4 equipment selects lose the leftover data-action
tests/views/quiz_actions.test.js    # new unit test (both delegations active)
tests/e2e/quiz_actions.spec.js       # new Playwright checks (quiz stats sort, equipment "Other")
DOCUMENTATION.md                    # quiz screen joins the sites exception
```

## Complexity Tracking

None.
