# Implementation Plan: Account Messages and Library Texts in the Strings Catalogue

**Branch**: `feat/account-manual-strings` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

## Summary

Account messages: a script copies each literal into `FR.account` and replaces it in place with
`t('account.…')` (templates get named placeholders); a comparison against the previous file proves
40/40 identical texts. Library: snapshot first (`tests/views/library_render.test.js`), then
`FR.library`. The shared check gains a `showAlert` / `showStatus` rule; both files join
`tests/views/inline_strings.test.js`. Vitest ignores `.claude/**`.

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| I. UX | PASS | Same wording, proven |
| IV. Test-first | PASS | Library snapshot recorded first; account comparison automated |
| VI. Security | PASS | Messages shown with `textContent` as before |
| Language | PASS | C8 for account and library |

## Complexity Tracking

None.
