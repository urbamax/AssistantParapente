# Implementation Plan: Escape Pilot Data in Logbook Statistics

**Branch**: `fix/escape-logbook-stats` | **Spec**: [spec.md](spec.md)

## Summary

In `renderStats()` (`js/views/logbook.js`), wrap every pilot-provided value with `escapeHTML`
(already imported from `js/core/security.js`): the wing name in `.equip-name`, the place in the
top places `.bar-label`, and the type in the flight type, take-off technique (text and `title`)
and exercise `.bar-label`. The raw wing name is still used for the maintenance lookup; only the
output is escaped.

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| I. Data integrity | PASS | Stored values unchanged; escaping only at display; plain names render identically |
| IV. Test-first | PASS | Regression test in `tests/views/logbook_xss.test.js`, seen failing |
| VI. Security | PASS | Closes the last unescaped pilot data in the logbook view (spec 003 rule) |

## Complexity Tracking

None.
