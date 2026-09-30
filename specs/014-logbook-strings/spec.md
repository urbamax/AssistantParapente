# Feature Specification: Logbook Screen Texts in the Strings Catalogue

**Feature Branch**: `feat/logbook-strings`

**Created**: 2026-09-30

**Status**: Draft

**Input**: Constitution audit gap C8 (Language constraint: user-facing text must live in a centralised strings module so the app can be translated later). The module exists since spec 001 (`js/i18n/fr.js`, `t()`), but most screens still write their texts inline. The owner asked to go "as far as reasonable"; the chosen approach is one screen per feature, starting with the logbook, the largest screen (about 240 inline texts in the code).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pilots see exactly the same logbook (Priority: P1)

A pilot uses the logbook (add a flight or a ground handling session, import an IGC trace, history, statistics, equipment). Every text, button, hint, message and confirmation reads exactly as before.

**Why this priority**: the change must be invisible to pilots (Principle I); any wording change or missing text would be a regression.

**Independent Test**: the rendered logbook screens (history with a flight and a ground handling session, statistics, equipment with alerts, both forms, IGC altitude check, weather rows, messages) are recorded before the change and compared after it: identical.

**Acceptance Scenarios**:

1. **Given** a logbook with flights, ground handling sessions and equipment, **When** each tab is displayed, **Then** the displayed HTML is identical to the one recorded before the change.
2. **Given** an empty logbook, **When** history, statistics and equipment are displayed, **Then** the empty-state texts are unchanged.
3. **Given** the add form, **When** switching between flight and ground handling, editing a session and cancelling, **Then** button labels and hints are unchanged.

---

### User Story 2 - The logbook can be translated from one place (Priority: P1)

The owner (or a future translator) finds every text of the logbook screen in the strings catalogue, grouped by area, and nowhere else in the logbook code.

**Why this priority**: it is the purpose of the constitution's Language rule and closes C8 for this screen.

**Independent Test**: an automated check of the logbook code finds no inline user-facing text (text between tags, `title` / `placeholder` / `alt` / `aria-label` attributes, `alert` / `confirm` messages, texts assigned to buttons or fields).

**Acceptance Scenarios**:

1. **Given** the logbook view code, **When** the check runs, **Then** it finds 0 inline user-facing texts.
2. **Given** a text added inline later, **When** the check runs, **Then** it fails and shows the line.

### Edge Cases

- Stored values (flight types "Plouf", "Thermique"…, take-off techniques, ground handling exercises, the "Autre" choice value, equipment colours and brands, site types) are data saved in the pilot's logbook and synced: they stay as they are. Only the labels shown for them move to the catalogue.
- Texts written into a session by the app (place names found from an IGC trace such as "Lieu inconnu (Import GPS)") come from the catalogue; existing sessions keep their saved text.
- Developer console messages are not user-facing: out of scope.
- Texts of the logbook part of `index.html` (static HTML) are out of scope for this feature (handled with the other static screens later).
- Pilot-entered text is still escaped as before (spec 003 rules unchanged).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every user-facing text produced by `js/views/logbook.js` MUST come from the strings catalogue (`js/i18n/fr.js`, section `logbook`).
- **FR-002**: The displayed logbook MUST be identical before and after the change (same texts, same markup).
- **FR-003**: Stored values and their saved form MUST NOT change (no data migration).
- **FR-004**: Catalogue texts inserted into HTML MUST be escaped like any other text, except for placeholders filled with markup built by the code from numbers.
- **FR-005**: An automated check MUST fail when user-facing text is written inline in the logbook view.
- **FR-006**: Catalogue keys MUST be grouped by area (form, IGC import, history, statistics, equipment, weather, messages) and every key used by the logbook MUST exist (no key shown instead of text).

### Key Entities

- **Catalogue entry**: a key (e.g. `logbook.history.empty`) and its French text, with optional `{placeholders}`.

## Success Criteria *(mandatory)*

- **SC-001**: 0 inline user-facing texts in the logbook view (automated check).
- **SC-002**: 100 % of recorded logbook renders identical before and after.
- **SC-003**: All existing automated tests still pass.

## Assumptions

- Same pattern as the texts already in the catalogue (spec 001, 002, 011, 012): `t('logbook.…')`.
- Other screens (sites, quiz, safety, account, static HTML) follow in later features, one per screen.
