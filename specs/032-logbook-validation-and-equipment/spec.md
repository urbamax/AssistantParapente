# Feature Specification: Logbook Validation and Equipment Linking

**Feature Branch**: `fix/logbook-validation-and-equipment`

**Created**: 2026-10-07

**Status**: Defined

**Input**: 
Instead of removing the mandatory fields in the logbook (like wing, site, duration), we must keep them but improve the validation feedback. If a user tries to save without a wing, they should see a message saying "wing is missing". The system should also check if any wing exists in their equipment list, and if not, prompt them to add one.
In the school activities (stage), we need new fields:
- Nom du stage (Course name)
- Spécialité (Specialty: Initiation, Perfectionnement, Progression, SIV, etc.)
- Was the rescue parachute opened/deployed? (If yes, select the parachute).
In the equipment tab (matériel), for harnesses (sellette), we must allow assigning a currently mounted rescue parachute (secours en cours). This will automatically pre-select the correct rescue parachute during a logbook activity if the rescue was deployed.

## Approach

1. **Form Validation Feedback**:
   - Revert the removal of `required` attributes.
   - Intercept the form submission (`submit` event) to provide custom, user-friendly feedback instead of silent browser blocks.
   - If the wing is missing and the user's equipment array (fetched from `StorageService`/`IDBStorage`) has no wings, display a helpful message: "Il manque la voile. Allez dans l'onglet Matériel pour en ajouter une."

2. **School / Course Activities (Stage)**:
   - Expand the `#lb-ecole-group` or add a new checkbox/section for "Stage" (Course).
   - Add input for "Nom du stage".
   - Add a `<select>` for "Spécialité" with the options (Initiation, Perfectionnement, Progression, SIV, Autre).
   - Add a checkbox "Secours ouvert ?" (Rescue deployed). If checked, show a select box populated with the user's rescue parachutes.

3. **Equipment Linking**:
   - In the `Matériel` (Equipment) view, when creating or editing a "Sellette", add a field to select a currently mounted "Secours" (from the user's list of parachutes).
   - Save this linkage in the equipment item's data model.

4. **Auto-selection**:
   - In the logbook form, when the user selects a Wing/Harness (or just by default if they have a primary harness with a linked rescue), and they check "Secours ouvert ?", auto-select the linked rescue parachute.

## Requirements *(mandatory)*

- **FR-001**: Custom validation feedback MUST clearly explain why the form cannot be submitted (e.g., missing wing, site, or duration).
- **FR-002**: If the user lacks a wing in their configuration, the feedback MUST direct them to the Equipment tab.
- **FR-003**: A "Stage" section MUST capture the course name and specialty.
- **FR-004**: Users MUST be able to log a rescue parachute deployment and specify the parachute used.
- **FR-005**: Users MUST be able to link a "Secours" to a "Sellette" in the equipment tab.
- **FR-006**: The logbook MUST auto-select the rescue parachute if it is linked to the active harness/equipment.

## Success Criteria *(mandatory)*

- **SC-001**: Clicking "Enregistrer" without a wing displays a clear UI alert/message and does not fail silently.
- **SC-002**: A new logbook session can correctly save the `stageName`, `stageSpecialty`, and `rescueDeployedId`.
- **SC-003**: Equipment data model successfully stores `linkedRescueId` for a harness.
- **SC-004**: Tests are updated/created to verify the custom validation and the new fields.
