# Feature Specification: Sites Screen Texts in the Strings Catalogue

**Feature Branch**: `feat/sites-strings`

**Created**: 2026-09-30

**Status**: Draft

**Input**: Constitution audit gap C8, second screen after the logbook (spec 014): move every user-facing text of the sites screen (`js/views/sites.js`, about 150 texts) into the strings catalogue, with no visible change.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pilots see exactly the same sites screen (Priority: P1)

A pilot searches sites, reads the list, the verdicts, the timeline, the site details, the comparison table, the map popups, the GPS and weather messages: every text reads exactly as before.

**Independent Test**: the rendered sites screen (list with flyable, rainy, incomplete, loading and unavailable forecasts, details, offline notices, comparison table, pre-flight brief, map popup, GPS messages, weather failure and retry countdown, filter menus, saved places, more-maps sheet, fullscreen, toast, SpotAiR title, copied coordinates) is recorded before the change and compared after it: identical.

**Acceptance Scenarios**:

1. **Given** the recorded states, **When** rendered after the change, **Then** the HTML and texts are identical.
2. **Given** the GPS refused, found or failing, **When** the messages and dialogs appear, **Then** they are unchanged.

---

### User Story 2 - The sites screen can be translated from one place (Priority: P1)

Every text of the sites screen is in the catalogue (`FR.sites`), grouped by area, and nowhere else in its code.

**Independent Test**: the shared inline-text check (strengthened: texts at the end of a template, `setAttribute` of readable attributes, `label:` lists, texts chosen by a condition, `.placeholder` / `.title`) finds nothing in `js/views/sites.js`, and every key used exists.

**Acceptance Scenarios**:

1. **Given** `js/views/sites.js`, **When** the check runs, **Then** it finds 0 inline user-facing texts.
2. **Given** the logbook view (spec 014), **When** the strengthened check runs, **Then** it still finds 0.

### Edge Cases

- Data values stay as they are: wind directions, site type codes (`ATTERRO`, `NATUREL`…), level codes (`ALL`, `BI`…), map layer ids, FFVL site texts (escaped as in spec 003).
- Weekday abbreviations of the timeline and the forecast slider come from the catalogue.
- Brand names (Windy, Meteoblue, SpotAiR…) are labels too: they move to the catalogue so that one place holds every text.
- Accents: the owner asked to fix missing accents when 100 % certain. One text changes on purpose: « Cartes centrees sur » becomes « Cartes centrées sur » (the snapshot is updated for that text only).
- The forecast age format (« 45 min », « 3 h 20 », « 1 j 2 h ») moves to `FR.forecast` too.
- Developer console messages are out of scope; the static texts of `index.html` are out of scope (later feature).

## Requirements *(mandatory)*

- **FR-001**: Every user-facing text produced by `js/views/sites.js` MUST come from the catalogue (`FR.sites`, or existing `FR.weather` / `FR.forecast` keys).
- **FR-002**: The displayed sites screen MUST be identical before and after the change, except certain accent fixes requested by the owner (listed in Edge Cases).
- **FR-003**: Data values and filters MUST behave as before (no stored preference changes).
- **FR-004**: Catalogue texts inserted into HTML MUST be escaped, except placeholders filled with markup built by the code.
- **FR-005**: The inline-text check MUST be shared by the logbook and sites screens and fail on new inline texts in either.
- **FR-006**: Every key used by the sites screen MUST exist in the catalogue.

## Success Criteria *(mandatory)*

- **SC-001**: 0 inline user-facing texts in the sites view and the logbook view (automated check).
- **SC-002**: 100 % of recorded sites renders identical before and after.
- **SC-003**: All existing automated tests still pass.

## Assumptions

- Same pattern as spec 014 (`tt` / `th` / `tl` helpers bound to the `sites.` prefix).
