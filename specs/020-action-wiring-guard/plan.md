# Implementation Plan: Automated Check That Every Control Is Wired

**Branch**: `test/action-wiring-guard` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

## Summary

New Vitest file `tests/core/action_wiring.test.js`:

1. **Used names**: every `data-(action|change-action|input-action|enter-action|backdrop-action)`
   value in `index.html`, `components/**/*.html` and `js/**/*.js` (templates), with file:line.
2. **Registered names**, parsed from `js/core/main.js`: `AppEvents.register('name'` calls, and the
   `[...].forEach((action) => …)` loops (`'Prefix' + action` and bare `action`) with the object
   they forward to (`LogbookView[action]`, `SitesView[action]`…).
3. **Owners**: registered names; `navigate`; methods of the fallback engines
   (`LibraryEngine`, `FirebaseAuthEngine`, `GdprEngine`); for `data-action` only, the sites
   screen delegation (`SitesService` / `SitesView` methods) and the quiz screen's
   `handleClick` cases (parsed from `js/views/quiz.js`).
4. Checks FR-001 to FR-004, each listing every offender with its location.

Modules are imported (not `main.js`) to read real method names.

Self-test: each rule is also run on a small bad input (inline fixture) to prove it fails.

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| IV. Test-first | PASS | Seen failing on `main` (before specs 018/019) and on fixtures |
| VII. No build | PASS | Test only |

## Project Structure

```text
tests/core/action_wiring.test.js   # new (also checks the sites and quiz delegations call markHandled)
DOCUMENTATION.md                   # mention the check
```

## Complexity Tracking

None.
