# Implementation Plan: No "Unregistered action" Warning on Sites Controls

**Branch**: `fix/sites-action-warnings` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

## Summary

`SitesView.setupEventListeners()` (capture phase on `document.body`) runs the action (a
`SitesService` or `SitesView` method), then `EventDelegator` (bubble phase on `document`)
dispatches the same bare name, finds no handler and warns. `EventDelegator` gains
`markHandled(event)` (a `WeakSet` of events); the sites click and change handlers call it
when they ran an action; `dispatch()` returns before the engine fallback and the warning for a
marked event. Registered handlers are untouched, so nothing registered changes behaviour.

Rejected: registering every bare name to call `SitesView[action]` (350c1f5) runs view actions
twice (verified: `toggleDropdown` opens and closes on one click), and needs a list to maintain.

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| I. UX and data integrity | PASS | Each action still runs once; toggles keep working |
| IV. Test-first | PASS | Regression test seen failing before the fix |
| VII. No build | PASS | Plain modules |

## Project Structure

```text
js/core/events.js                  # markHandled(event); dispatch skips fallback for marked events
js/views/sites.js                  # _clickHandler / _changeHandler call AppEvents.markHandled(e)
tests/views/sites_actions.test.js  # new regression test (both delegations active)
```

## Complexity Tracking

None.
