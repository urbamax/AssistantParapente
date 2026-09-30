# Implementation Plan: Logbook Screen Texts in the Strings Catalogue

**Branch**: `feat/logbook-strings` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

## Summary

Record the rendered logbook screens in a Vitest snapshot **before** touching the code, then move
every user-facing text of `js/views/logbook.js` into `FR.logbook` (`js/i18n/fr.js`) and read it with
`t()`; the snapshot must stay identical. A source-scanning test guards against new inline texts.
Stored values (option values, exercise and flight types, "Autre", brands, colours) stay in code.

## Technical Context

**Language/Version**: JavaScript ES modules
**Primary Dependencies**: none new
**Testing**: Vitest (happy-dom) snapshot of render functions with fake timers and fixtures; node test scanning the source
**Constraints**: no visible change (Principle I); texts escaped in HTML (VI); no build (VII)
**Scale/Scope**: ~240 texts, one view file, the catalogue, two test files

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| I. UX and data integrity | PASS | Rendered output proven identical; stored values untouched |
| IV. Test-first | PASS | Snapshot recorded and guard test seen failing before the move |
| VI. Security | PASS | Catalogue texts escaped with `escapeHTML` in HTML; pilot data escaping unchanged |
| VII. No build | PASS | Plain module |
| VIII. Layers | PASS | Texts in `js/i18n/`, read by the view |
| Language | PASS | Closes C8 for the logbook screen |

## Design decisions

- **Helper**: in `logbook.js`, `const tt = (key, params) => escapeHTML(t(\`logbook.${key}\`, params));` for HTML contexts; plain `t()` for `innerText`, `textContent`, input values, `alert` and `confirm`.
- **Markup in texts**: kept in code; texts with bold parts take the markup as a placeholder built from numbers (`{takeoff}`), not escaped.
- **Displayed stored values**: option labels come from the catalogue keyed by the stored value (e.g. `logbook.form.flightTypes.Plouf`), values unchanged.
- **Guard**: `tests/views/logbook_strings.test.js` strips comments and `console.*` calls, then fails on: text nodes in templates, literal `title` / `placeholder` / `alt` / `aria-label`, `alert(` / `confirm(` with a literal, literal assigned to `innerText` / `textContent`, and literal user sentences assigned to `.value`. Data values (`'Autre'`, option `value="…"`) are allowed.
- **Snapshot**: `tests/views/logbook_render.test.js` renders history (flight with IGC stats, badge, equipment, comment, weather + beacon; ground handling session), empty states, statistics, equipment (red and orange alerts, archived), both forms, edit mode, IGC altitude check (normal and suspicious), weather errors, and records `innerHTML` plus button/field texts.

## Project Structure

```text
js/i18n/fr.js                       # FR.logbook.{form,igc,history,stats,equipment,weather,messages}
js/views/logbook.js                 # t()/tt() everywhere
tests/views/logbook_render.test.js  # + __snapshots__/ (recorded before the move)
tests/views/logbook_strings.test.js # guard
```

## Complexity Tracking

None.
