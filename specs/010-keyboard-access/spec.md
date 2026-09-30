# Feature Specification: Keyboard Access to Every Clickable Element

**Feature Branch**: `fix/keyboard-access`

**Created**: 2026-09-30

**Status**: Draft

**Input**: Constitution audit gap C7 (Devices and accessibility constraint: « every screen MUST be … operable with a keyboard »). 26 clickable elements (quiz filters and question/exam details, login tabs and « mot de passe oublié », footer legal links, site tag/type filters, orientation/type filter chips, map layer toggles, header logo, IGC upload area, timeline hours) are plain `div`/`span`/`label`/`a` without `href`: they cannot be reached with Tab nor activated with Enter/Space.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Everything clickable works with the keyboard (Priority: P1)

A pilot who uses the keyboard (or a screen reader) can reach every interactive element with Tab, sees where the focus is, and activates it with Enter or Space, with the same effect as a click.

**Independent Test**: tab to a quiz filter, a site tag, a footer legal link and a login tab; press Enter or Space: the same action as a click happens.

**Acceptance Scenarios**:

1. **Given** any clickable element listed in the input, **When** the pilot presses Tab, **Then** it receives focus with a visible focus outline.
2. **Given** a focused clickable element, **When** the pilot presses Enter or Space, **Then** its action runs once (same as a click), and Space does not scroll the page.
3. **Given** a screen reader, **When** it reaches such an element, **Then** it is announced as a button.
4. **Given** the 120 hour bars of a site timeline, **When** using the keyboard, **Then** the hour is chosen with the forecast slider (already keyboard-operable); the bars stay out of the Tab order to avoid thousands of stops, and are hidden from screen readers as decorative duplicates of the slider.

### Edge Cases

- Native buttons, links with `href` and form fields keep their native behaviour (no double action).
- Elements added later must follow the same rule (checked automatically).

## Requirements *(mandatory)*

- **FR-001**: Every element with a click action that is not natively focusable MUST be focusable (`tabindex="0"`) and exposed as a button (`role="button"`), except the timeline hour bars (FR-004).
- **FR-002**: Enter and Space on such an element MUST trigger its action exactly once; Space MUST NOT scroll.
- **FR-003**: A visible focus indicator MUST be shown on these elements in both themes.
- **FR-004**: Timeline hour bars MUST stay out of the Tab order and be hidden from assistive technologies; the forecast slider is their keyboard equivalent.
- **FR-005**: An automated check MUST fail if a new non-focusable clickable element appears without these attributes.

## Success Criteria *(mandatory)*

- **SC-001**: 0 non-focusable clickable elements without `role="button"` and `tabindex="0"` in the app's HTML and views (automated check; timeline bars excepted).
- **SC-002**: In an automated browser check, footer legal link, a site tag filter and a quiz filter are activated with Enter and Space.

## Assumptions

- Visual appearance stays the same except the focus outline.
