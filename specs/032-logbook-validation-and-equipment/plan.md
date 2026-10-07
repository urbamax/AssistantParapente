# Implementation Plan: Logbook Validation and Equipment Linking

1. **Revert PR 126 changes**:
   - Restore the `required` attributes and asterisks in `js/views/logbook.js`.
   - Revert the test modifications in `tests/views/logbook_school.test.js`.
   - Update snapshots.

2. **Custom Form Validation**:
   - In `LogbookViewClass.setupEvents()` or `saveFlights()`, intercept the form submission.
   - Use `form.checkValidity()` to check if fields are missing. If so, identify the missing fields.
   - If `#lb-voile` is missing, check `app.equipment.voiles`. If empty, show a specific alert: "Vous n'avez pas de voile configurée. Veuillez l'ajouter dans l'onglet Matériel." Otherwise: "Il manque la voile."
   - Trigger a Toast or Alert component to show the message.

3. **Logbook School Fields & Rescue Deployment**:
   - Update the HTML template in `js/views/logbook.js` for the "École" (School) toggle to include "Stage" details.
   - Add "Secours ouvert ?" toggle and a `<select id="lb-rescue">` populated with user's rescue parachutes (`app.equipment.secours`).
   - Update `LogbookService` to handle `stageName`, `stageSpecialty`, `rescueDeployed`, and `rescueId` in the flight model.

4. **Equipment Linking**:
   - In the equipment settings / modal (`js/views/equipment.js` or wherever equipment is managed - need to inspect codebase), add a dropdown for "Sellette" to select an active "Secours".
   - Update `EquipmentConfig` / save logic to store this link.

5. **Auto-selection Logic**:
   - In the logbook view, listen to the Rescue toggle. If checked, look up the selected harness (if any, or the default harness) and check if it has a linked rescue. If so, pre-select it in `#lb-rescue`.

6. **Testing**:
   - Write E2E or unit tests to verify the validation alerts and the equipment linkage.
