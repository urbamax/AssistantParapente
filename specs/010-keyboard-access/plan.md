# Implementation Plan: Keyboard Access to Every Clickable Element

**Branch**: `fix/keyboard-access` | **Spec**: [spec.md](spec.md)

## Summary

Add `role="button" tabindex="0"` to the 25 non-focusable clickable elements (markup in
`index.html`, `components/*.html`, `js/views/{quiz,sites,logbook}.js`); `aria-hidden="true"` on
timeline bars; in `js/core/events.js` a `keydown` delegate: Enter/Space on
`[data-action][role="button"]` (not native controls) dispatches the action like a click and
prevents Space scrolling; focus outline via `:focus-visible` in `css/components.css`; a static test
scanning markup (same scan as the audit) and an e2e keyboard test.

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| Devices / accessibility | PASS | Closes C7 |
| IV. Test-first | PASS | Static and e2e tests first |
| VIII. Layers | PASS | Keyboard handling in the existing event delegator |

## Complexity Tracking

None.
