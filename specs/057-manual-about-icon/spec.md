# Feature Specification: Remove the Umbrella Icon from the Manual's About Card

**Feature Branch**: `fix/057-manual-about-icon`

**Created**: 2026-11-22

**Status**: Draft

**Input**: Owner: « Pourquoi ce parapluie dans le mode d'emploi ? inutile »

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The About card shows no meaningless icon (Priority: P1)

The first card of the manual's « À propos » tab (« Assistant Parapente · 100% GRATUIT ») shows a
large umbrella icon (`ri-umbrella-line`). It has no meaning for the app and takes space, mostly on
phones.

**Independent Test**: open the manual: the card shows the title, the badge and the text, without
the icon, and the text uses the freed width.

**Acceptance Scenarios**:

1. **Given** the manual's « À propos » tab, **When** it opens, **Then** the first card has no icon and its title, badge and text are unchanged.

## Requirements *(mandatory)*

- **FR-001**: The umbrella icon MUST be removed from the About card; no other content changes.

## Success Criteria *(mandatory)*

- **SC-001**: 0 icons in the About card.

## User Manual Impact *(mandatory)*

- **Sections checked**: À propos (the card itself).
- **Updates required**: the icon is removed; no text changes.
- **Discord guide (`#guide-utilisation`)**: No change (the guide has no icon).

## Release Announcement *(mandatory)*

- **Availability**: All users.
- **Discord notice**: None: cosmetic change.
