# Feature Specification: No "Unregistered action" Warning on Sites Controls

**Feature Branch**: `fix/sites-action-warnings`

**Created**: 2026-09-30

**Status**: Draft

**Input**: Every click on a sites screen control (favourites filter, map menus, filters, sort, GPS, card buttons…) logs "Unregistered action triggered" in the console, although the action works. Stop the false warning without running any action twice.

## Context

The sites screen has its own click/change delegation, which runs first and performs the action. The app-wide delegation then sees the same control, finds no handler under that name and logs the warning. 28 control names are affected.

An earlier attempt (local branch `worktree-fix-sites-action-delegation`, commit 350c1f5) registered each name app-wide to call the sites screen again. Checked in the browser: screen-level actions then run twice on one click; the "Active maps" menu opens and closes at once and can no longer be toggled. That approach is rejected.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sites controls work once, with a clean console (Priority: P1)

A pilot uses the sites screen: every control does its job exactly once, as today, and the console shows no false warning.

**Independent Test**: with both delegations active, click a sites control handled by the screen (a screen action and a service action): the action runs exactly once and no "Unregistered action" warning is logged.

**Acceptance Scenarios**:

1. **Given** the sites screen, **When** the pilot clicks "Favourites only", **Then** the filter toggles once and no warning is logged.
2. **Given** the sites screen, **When** the pilot clicks the "Active maps" button twice, **Then** the menu opens, then closes, and no warning is logged.
3. **Given** a select of the sites screen (sort mode), **When** its value changes, **Then** the change applies once and no warning is logged.

### User Story 2 - Real mistakes are still reported (Priority: P2)

A developer who writes a control with an action name nobody handles still sees the warning.

**Acceptance Scenarios**:

1. **Given** a control whose action no one handles, **When** it is clicked (on any screen, the sites screen included), **Then** the warning is logged.

### Edge Cases

- Controls whose name is registered app-wide (e.g. `SitesfilterByTag`, `navigate`, `GdprshowModal`) keep running through the app-wide delegation, unchanged.
- No method of the app-wide fallback engines (library, sign-in, privacy) shares a name with a control used on the sites screen (checked: only internal names such as `init`, `show`, `mount`), so skipping the fallback for sites-handled events changes no behaviour.
- When the sites screen is closed, its delegation is removed: a click on a leftover control behaves as today.
- Out of scope: the quiz bank filter `renderQcmBank`, which has the same warning but belongs to another screen.

## Requirements *(mandatory)*

- **FR-001**: A click or change handled by the sites screen's own delegation MUST NOT log "Unregistered action triggered".
- **FR-002**: Such an action MUST run exactly once per click or change.
- **FR-003**: An action that no one handles MUST still log the warning.
- **FR-004**: The fix MUST NOT depend on a hand-maintained list of sites action names.

## Success Criteria *(mandatory)*

- **SC-001**: 0 "Unregistered action" warnings while using the 28 sites controls.
- **SC-002**: Each sites control runs its action once per click (toggles stay usable).
- **SC-003**: All existing automated tests still pass.

## Assumptions

- The sites screen's delegation stays the one that performs these actions; this feature only lets the app-wide delegation know they were handled.
- Once merged, the obsolete local branch `worktree-fix-sites-action-delegation` is deleted.
