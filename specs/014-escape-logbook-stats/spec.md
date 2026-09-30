# Feature Specification: Escape Pilot Data in Logbook Statistics

**Feature Branch**: `fix/escape-logbook-stats`

**Created**: 2026-09-30

**Status**: Implemented

**Input**: Owner report: `renderStats()` in the logbook view inserts pilot-entered values (wing name, place names, flight types, take-off techniques, ground handling exercises) into the statistics page without escaping them. These values can also arrive through cloud sync or a JSON import, so a value such as `<img src=x onerror=...>` would run in the page. This breaks the escaping rule of spec 003 and constitution Principle VI; the other logbook renders already escape pilot data.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Statistics show pilot text as text (Priority: P1)

A pilot opens the statistics tab of their logbook. Every name they typed (or that came from sync or an import) is shown literally; nothing in it is interpreted as page markup or code.

**Independent Test**: render the statistics of a logbook whose wing, place, flight type, take-off technique and exercise contain markup, and check that the markup is shown as text and no element is injected.

**Acceptance Scenarios**:

1. **Given** a flight whose wing is named `<img src=x onerror=…>`, **When** the statistics are shown, **Then** the equipment card shows that exact text and no image element is created.
2. **Given** flights and ground handling sessions whose place, flight type, take-off technique and exercise contain markup or a double quote, **When** the statistics are shown, **Then** each bar label (and its tooltip) shows the exact text and no element or attribute is injected.
3. **Given** a logbook with ordinary names (no special characters), **When** the statistics are shown, **Then** the page is unchanged.

### Edge Cases

- A take-off technique containing `"` must not break out of the label tooltip.
- A name containing `&` is shown as `&`, not as an entity.

## Requirements *(mandatory)*

- **FR-001**: Every pilot-provided value shown on the statistics page (wing name, place, flight type, take-off technique, ground handling exercise) MUST be escaped before insertion, in text and in attributes.
- **FR-002**: Statistics computations (counts, durations, top places, maintenance reminder matching) MUST be unchanged.

## Success Criteria *(mandatory)*

- **SC-001**: A unit test with markup payloads in all five fields fails without the fix and passes with it.
- **SC-002**: Statistics of a logbook without special characters render exactly as before.

## Assumptions

- Stored data is not modified; escaping happens only at display time (Principle I: data shown faithfully).
