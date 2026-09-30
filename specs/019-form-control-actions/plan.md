# Implementation Plan: Menus Act on Change Only; Working "Forgot Password"

**Branch**: `fix/form-control-actions` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

## Summary

- `EventDelegator`'s click listener dispatches `data-action` for any element, form fields
  included; the change listener dispatches it again on change. The click listener now ignores
  `SELECT`, `INPUT` and `TEXTAREA` targets (their action runs on change). Same guard in
  `SitesView._clickHandler`, which calls `SitesService[action]()` without arguments on a click.
- `index.html`: drop `data-args="this.value"` (3 sites menus) and the truncated
  `document.getElementById(...)` arguments (sign-in, sign-up, forgot password).
- `FirebaseAuthEngine.forgotPassword()`: reads `#login-email`; empty → error alert; otherwise
  `resetPassword(email)`. `main.js` already maps `FirebaseAuthforgotPassword` to it.
- `migrateSitePrefs()` drops a `sortMode` or `weatherModel` that is not one of the menu values,
  so preferences already corrupted with `this.value` fall back to the defaults.

Rejected: converting the menus to `data-change-action` — the sites screen's own change
delegation reads `data-action`, so the sites menus would need a second mapping.

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| I. UX and data integrity | PASS | Settings no longer corrupted by opening a menu |
| IV. Test-first | PASS | Regression tests seen failing before the fix |
| VII. No build | PASS | Plain modules |

## Project Structure

```text
js/core/events.js                       # click delegation skips form fields
js/views/sites.js                       # _clickHandler skips form fields
js/services/firebase_service.js         # forgotPassword()
js/services/sites_service.js            # migrateSitePrefs drops unknown sort mode / model
tests/services/site_prefs_migration.test.js # + unknown values dropped
index.html                              # leftover data-args removed
tests/core/form_control_actions.test.js # new unit tests
tests/e2e/form_controls.spec.js         # new Playwright checks (level menu, sort menu)
```

## Complexity Tracking

None.
