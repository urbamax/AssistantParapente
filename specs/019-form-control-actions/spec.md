# Feature Specification: Menus Act on Change Only; Working "Forgot Password"

**Feature Branch**: `fix/form-control-actions`

**Created**: 2026-09-30

**Status**: Draft

**Input**: While checking why a quiz session would not start, found that merely opening some drop-down menus changes the pilot's settings, and that "Mot de passe oublié ?" does nothing. Fix both.

## Context

Checked in the browser on `main`:

- **Opening a menu changes a setting.** Drop-down menus are wired with the attribute used for buttons, which also reacts to clicks. Opening the menu (a click) runs the action with the wrong value, before any choice is made:
  - level menu in the header: the level becomes empty and "null" is saved on the device; after a reload the pilot's level (e.g. BI) is lost and "Tous les niveaux" is shown;
  - sites sort menu and weather model menu: the setting becomes the literal text `this.value` (a leftover of an old inline handler), saved in the pilot's preferences; the weather model change also restarts the forecast download.
  - The forecast range menu and wind filter menu are wired the same way; they only escape damage because their action ignores an invalid value.
- **"Mot de passe oublié ?" does nothing.** It calls a sign-in method name that does not exist, so no reset email is ever sent and nothing is shown. Its arguments, like those of "Se connecter" and "S'inscrire", are also leftover code text (`document.getElementById('login-email'`), unused.

The quiz "Aucune question trouvée" seen once during the audit could not be reproduced with any level, mode and question count (all 100 combinations start); it was most likely a side effect of the empty level above.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Opening a menu changes nothing (Priority: P1)

A pilot opens a drop-down menu, then closes it or picks an option: only picking an option changes the setting.

**Independent Test**: click a menu without choosing: the setting and the saved preferences are unchanged. Choose an option: the setting takes that value once.

**Acceptance Scenarios**:

1. **Given** level BI, **When** the pilot opens the level menu and closes it, **Then** the level stays BI, also after a reload.
2. **Given** the sites screen sorted by conditions, **When** the pilot opens the sort menu, **Then** the sort stays "conditions"; **When** they pick "A-Z", **Then** the list is sorted A-Z.
3. **Given** the weather model Météo-France, **When** the pilot opens the model menu, **Then** the model is unchanged and no new download starts.
4. **Given** a device where `this.value` was already saved as sort mode or weather model, **When** the app loads, **Then** the default sort and model apply.

### User Story 2 - Forgot password sends a reset email (Priority: P1)

**Acceptance Scenarios**:

1. **Given** the sign-in window with an email typed, **When** the pilot clicks "Mot de passe oublié ?", **Then** a reset email is requested for that address and the confirmation (or error) is shown.
2. **Given** the email field is empty, **When** the pilot clicks it, **Then** a message asks for the email address.

### Edge Cases

- Buttons, links and `role="button"` elements keep reacting to clicks (unchanged).
- A checkbox or text field with an action keeps reacting to change only (none uses a click action today).

## Requirements *(mandatory)*

- **FR-001**: Clicking a drop-down menu, text field or checkbox MUST NOT run its action; only a change of value does.
- **FR-002**: A menu change MUST pass the chosen value to its action.
- **FR-003**: No control MAY carry leftover code text as its arguments.
- **FR-004**: "Mot de passe oublié ?" MUST request a reset email for the typed address, or ask for the address when the field is empty.
- **FR-005**: A sort mode or weather model already saved as an unknown value (e.g. `this.value`) MUST be replaced by the default when preferences are loaded.

## Success Criteria *(mandatory)*

- **SC-001**: Opening and closing any menu leaves every setting and saved preference unchanged.
- **SC-002**: The reset email request is sent for the typed address.
- **SC-003**: All existing automated tests still pass.

## Assumptions

- The reset email itself is sent by the existing sign-in service; only the link that calls it is repaired.
