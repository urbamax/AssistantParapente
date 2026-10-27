# Feature Specification: Sites List Re-render Keeps the Scroll Position

**Feature Branch**: `fix/sites-keep-scroll-on-rerender`
**Created**: 2026-10-27
**Status**: Implemented
**Input**: User description: "Quand on clique sur un bouton d'une carte de site, « + » par exemple, on retourne immédiatement en haut de la page."

## Problem

Every action on a site card (the "+" minimise button, a favourite, a wind tag…) re-renders the whole list through
`SitesListBase.renderList()`. That method first emptied `#sites-list-container` (`innerHTML = ''`) and only filled it
again at the end. If anything measures the layout between the two steps (a browser reflow, a scroll listener, a
cloud-sync callback), the empty container makes `#sites-screen` clamp its scroll position to 0, and the refilled list
stays at the top. Spec 040 fixed the two tags that scrolled explicitly; this one removes the cause for every control.

The jump could not be reproduced on a local profile without an account (no weather, no cloud sync), in desktop and
phone widths, with real clicks: the fix is defensive and removes the one step that can produce it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Act on a card without losing my place (Priority: P1)

The pilot scrolls down the site list and touches "+" (or any button) on a card. The list updates and the screen
stays where it was.

**Independent Test**: scroll `#sites-screen`, call `SitesView.renderList()`; `scrollTop` is unchanged.

**Acceptance Scenarios**:

1. **Given** a scrolled site list, **When** the list is re-rendered, **Then** `#sites-screen.scrollTop` is the same
   after the render.
2. **Given** a re-render, **When** the container is updated, **Then** it is assigned once with its final content and
   never with an empty string first.

## Requirements *(mandatory)*

- **FR-001**: `renderList()` MUST NOT empty `#sites-list-container` before assigning its final content.
- **FR-002**: `renderList()` MUST restore the `#sites-screen` scroll position it had on entry once the list is
  rendered.

## Success Criteria *(mandatory)*

- **SC-001**: `tests/views/sites_rerender_scroll.test.js` fails without the change and passes with it.
- **SC-002**: lint, format, typecheck and the whole unit suite pass.
