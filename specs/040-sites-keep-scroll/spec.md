# Feature Specification: Sites Screen Keeps Its Scroll Position

**Feature Branch**: `fix/sites-keep-scroll`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "When I change something on the Sites page, the page jumps back to the top instead of staying where it is."

## Problem

On the Sites screen, touching a wind-direction tag or a site-type badge on a site card applies that
filter and then scrolls the whole screen smoothly back to the top. A pilot who was reading the list
at the fortieth card loses their place and must scroll down again after every such touch. The other
controls of the screen (favourites, sort mode, forecast slider, search, range, hide-unflyable) already
keep the position; the two tags are the exception, found by reproducing each control in the browser.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Filter from a card without losing my place (Priority: P1)

The pilot scrolls down the site list and touches a wind tag (for example "NW") or a type badge on a
card. The filter is applied and the list updates; the screen stays at the same scroll position (as far
as the shorter list allows).

**Why this priority**: it is the whole request; the jump happens on every use of these two controls.

**Independent Test**: scroll the sites screen down, touch a wind tag and a type badge; the scroll
position is not reset to the top.

**Acceptance Scenarios**:

1. **Given** the site list scrolled down, **When** the pilot touches a wind tag, **Then** the wind
   filter is applied, the badges and the map markers are updated, and the screen is not scrolled.
2. **Given** the site list scrolled down, **When** the pilot touches a type badge, **Then** the type
   filter is applied and the screen is not scrolled.
3. **Given** the "back to top" button, **When** the pilot touches it, **Then** the screen still scrolls
   to the top (unchanged).

### Edge Cases

- The filtered list is shorter than the current position: the browser keeps the screen at the end of
  the shorter list; nothing else is done.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Applying a wind filter or a type filter from a site card MUST NOT change the scroll
  position of the Sites screen.
- **FR-002**: The filter, the badges, the dropdown state, the saved preferences and the map markers
  MUST be updated exactly as before.
- **FR-003**: The "back to top" button MUST keep scrolling to the top.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After touching a wind tag or a type badge on a card, the scroll position of the screen is
  unchanged (verified in the browser at 1200 px of scroll, before: 373 px / 529 px after the touch).
- **SC-002**: No other Sites control changes its behaviour.

## Assumptions

- The jump was added on purpose so that the pilot would see the filter badges at the top; the pilot has
  asked for the opposite, and the badges stay visible in the sticky bar.
