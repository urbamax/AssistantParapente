# Implementation Plan: Safe and Faithful Site Details

**Branch**: `fix/escape-site-details` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-safe-site-details/spec.md`

## Summary

Render site details through a pure allowlist renderer (`renderSiteText`) that escapes everything
and restores only line breaks, bold and `http(s)` links (new tab, `noopener`); use FFVL page
addresses only when they are `http(s)`; escape quiz questions, choices and explanations; repair
the 246 fields with Windows-1252 characters in the site database and in the import scripts.

## Technical Context

**Language/Version**: JavaScript ES2023 native modules (browser); Python 3 (import scripts)

**Primary Dependencies**: none new

**Storage**: `js/data/sites_data.json` (one-time repair) and its server copy `functions/sites_data.json`

**Testing**: Vitest + happy-dom (renderer, whole-database checks, views), Playwright (details in
the browser), Python `unittest` (stdlib) for the repair helper

**Target Platform**: mobile and desktop browsers (PWA); local Python for data scripts

**Project Type**: web app (static SPA) + data scripts

**Performance Goals**: rendering cost negligible (regex on short strings, 50 cards max)

**Constraints**: no new dependency; renderer usable without DOM; data import stays additive

**Scale/Scope**: `js/core/security.js`, `js/views/sites.js`, `js/views/quiz.js`,
`js/data/sites_data.json`, `scripts/text_repair.py`, two import scripts

## Constitution Check

| Principle / rule | Status | How the plan complies |
|------------------|--------|-----------------------|
| I. UX and data integrity first | PASS | Lost safety text restored; broken characters repaired; unchanged look elsewhere |
| II. Decision support | PASS | No verdict change |
| III. Sourced content | PASS | Quiz content unchanged (display only) |
| IV. Test-first (NON-NEGOTIABLE) | PASS | Tests first: renderer + attack patterns, whole-database text equality, no C1 characters, quiz escaping, e2e on SORGIA / NOTRE-DAME-DE-LA-MER; e2e run locally (not in CI yet, audit B4) |
| V. Offline-first | PASS | No change |
| VI. Privacy and security | PASS | Closes A7/C6: no unescaped external data; links `noopener`; non-http addresses dropped |
| VII. Web app, no build | PASS | Plain modules, no dependency |
| VIII. Layered architecture | PASS | Pure renderer in `core/security.js`; views call it |

**Post-design re-check**: all gates pass; no Complexity Tracking entry.

## Project Structure

```text
specs/003-safe-site-details/   spec, plan, research, data-model, contracts/sanitizer.md, quickstart, tasks
js/core/security.js            + renderSiteText, safeHttpUrl
js/views/sites.js              details rendered with renderSiteText; FFVL button via safeHttpUrl
js/views/quiz.js               escapeHTML on question, choices and explanations (7 places)
js/data/sites_data.json        one-time repair of Windows-1252 characters
scripts/text_repair.py         NEW: repair_cp1252
scripts/import_ffvl_sites.py, scripts/refresh_paraglidingearth.py   clean() uses repair_cp1252
tests/core/security.test.js    NEW
tests/data/sites_data_text.test.js   NEW (whole database)
tests/views/sites_details.test.js    NEW
tests/views/quiz_escaping.test.js    NEW
tests/scripts/test_text_repair.py    NEW (unittest)
tests/e2e/sites_flow.spec.js   + details scenario
```

## Implementation Phases

1. **US2 renderer and URLs** (foundation for US1): tests → `renderSiteText`, `safeHttpUrl`.
2. **US1 full site text**: tests on the whole database and the card → use renderer in `sites.js`, e2e.
3. **US2 quiz**: tests → escape the 7 quiz insertions.
4. **US3 characters**: tests (data + Python) → `text_repair.py`, scripts, one-time repair, sync copy.
5. **Polish**: `DOCUMENTATION.md`, full checks, manual quickstart.

## Complexity Tracking

No constitution violation to justify.
