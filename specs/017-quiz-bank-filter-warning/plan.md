# Implementation Plan: No "Unregistered action" Warning on the Quiz Bank Theme Filter

**Branch**: `fix/quiz-bank-filter-warning` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

## Summary

`QuizView.mount()` adds a `change` listener on `#bank-theme-filter` that calls
`renderBankContent(select.value)`. The select also has `data-action="renderQcmBank"`, so
`EventDelegator` (change delegation on `document`) dispatches `renderQcmBank`, finds no handler
or engine method and warns. Remove the unused `data-action` from `index.html`.

Rejected:
- Registering `renderQcmBank` in `js/core/main.js` to call `QuizView.renderBankContent`: the bank
  (hundreds of questions) would render twice per change.
- `AppEvents.markHandled(e)` in `QuizView.handleChange`: needs spec 016 (PR #68, not merged), and
  keeps a `data-action` that means nothing.

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| I. UX and data integrity | PASS | Filter behaviour unchanged, renders once |
| IV. Test-first | PASS | Regression tests seen failing before the fix |
| VII. No build | PASS | HTML attribute removed only |

## Project Structure

```text
index.html                          # #bank-theme-filter loses data-action="renderQcmBank"
tests/views/quiz_bank_filter.test.js # new unit test on the real index.html markup
tests/e2e/quiz_bank.spec.js          # new Playwright check
```

## Complexity Tracking

None.
