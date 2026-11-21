# Implementation Plan: User Manual Catch-Up

**Branch**: `docs/053-manual-catch-up` | **Date**: 2026-11-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/053-manual-catch-up/spec.md`

## Summary

Audit every part of the in-app « Mode d'emploi » against the app on `main`, then fix its text:
add the 7 missing topics, correct the 4 outdated statements and anything else the audit finds,
and keep the split by role (public, `beta`, `owner`). The manual is static HTML
(`components/manual_modal.html`) whose every text is duplicated in the catalogue
`js/i18n/fr_html.js` (`manualModal`), with an existing test that the two are identical. The work
is text only: no view, service or style change. Content tests are written first (red), then the
text is changed (green). Public changes are then copied into the owner's local Discord guide, and
a notice for `#mises-a-jour` is finalised; both are published only after deployment, with the
owner's approval.

## Technical Context

**Language/Version**: HTML5 + JavaScript ES2022 (native ES modules); French text

**Primary Dependencies**: none added. Existing: `js/services/access_service.js`
(`applyRoleVisibility`), `js/core/ui_manager.js` (`_ensureManualModal`, lazy fetch of the
component)

**Storage**: N/A (static file, pre-cached by the service worker, already in `STATIC_PATHS`)

**Testing**: Vitest + jsdom (`tests/views/static_texts.test.js`,
`tests/views/manual_by_role.test.js`, new `tests/views/manual_content.test.js`); Playwright for
one end-to-end check of the manual (new `tests/e2e/manual.spec.js`)

**Target Platform**: installable PWA, mobile and desktop browsers, offline

**Project Type**: static web app without a mandatory build

**Performance Goals**: no measurable change; the manual stays lazy-loaded on first open

**Constraints**: offline-first; role split enforced by `data-requires-role` /
`data-hidden-with-role`; HTML text must equal the catalogue (spec 026); text in French; no
calculated-weather word visible without `beta` (existing regex test)

**Scale/Scope**: 10 tabs, about 260 catalogue keys, about 1,400 lines of HTML; about 11 known
changes plus what the audit finds

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. UX & data integrity | Fixes wrong instructions; no new screen; light/dark and keyboard behaviour of the modal unchanged | ✅ |
| II. Decision support | The beta/owner weather parts keep the reminder that the pilot decides and must check on site; no new verdict wording | ✅ |
| III. Sourced content | Manual text describes the app, it makes no technical or safety claim of its own. The ICE and Sécurité wording reuses what the screen says; FFVL documents are named, not quoted | ✅ |
| IV. Test-first | New content tests (Vitest) and one Playwright flow written and seen failing before the text changes; existing static-text and role tests stay green | ✅ |
| V. Offline-first | The manual file stays pre-cached; no network call added | ✅ |
| VI. Privacy & security | ICE text states health data, device-only by default, consent on each device, deletable. Text stays in static HTML; no `innerHTML` added in code. The Discord tooling stays outside the repository | ✅ |
| VII. No mandatory build | Plain HTML and ES-module strings; no build-only feature | ✅ |
| VIII. Layered architecture | No code change in views or services | ✅ |
| Language constraint | All text in the centralised catalogue (`fr_html.js`), identical to the HTML | ✅ |
| Workflow: `DOCUMENTATION.md` | No architecture change, so no update required (checked) | ✅ |

- [x] User manual: the spec's "User Manual Impact" section is filled in, and the sections to
  update in `components/manual_modal.html` / `manualModal` strings and, for public sections,
  in the Discord guide (`#guide-utilisation`) are identified.
- [x] Release announcement: the spec states the feature's availability; if it is for all
  users, a Discord update notice is drafted (posted after deployment, with owner approval).

**Post-design re-check**: still passing (no change from Phase 1 design; see research R1–R7).

## Project Structure

### Documentation (this feature)

```text
specs/053-manual-catch-up/
├── plan.md              # This file
├── research.md          # Phase 0: how the manual works, decisions
├── data-model.md        # Phase 1: manual part, audit record, Discord card
├── quickstart.md        # Phase 1: how to check the result
├── contracts/
│   └── manual-content.md  # Phase 1: what each tab must and must not say, per role
├── audit.md             # Written during implementation: one row per manual part
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
components/
└── manual_modal.html          # Manual text (HTML, role attributes)

js/i18n/
└── fr_html.js                 # manualModal catalogue, identical to the HTML

tests/views/
├── static_texts.test.js       # Existing: HTML == catalogue, every text has a key
├── manual_by_role.test.js     # Existing: nothing about calculated weather / sites without the role
└── manual_content.test.js     # New: required and forbidden statements per tab and role

tests/e2e/
└── manual.spec.js             # New: open the manual, Sécurité shows Fiche ICE, Général shows install/feedback/Discord

# Outside the repository (owner's machine, git-ignored)
scripts/discord_guide.py       # Discord copy of the public manual (#guide-utilisation)
```

**Structure Decision**: text-only change in the existing manual component and its catalogue,
with tests in the existing `tests/views` and `tests/e2e` folders. The Discord guide is edited in
the owner's local checkout and never committed.

## Complexity Tracking

No violation to justify.
