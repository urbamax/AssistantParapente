# Tasks: Logbook Validation and Equipment Linking

1. **Revert Optional Fields**
   - Re-add `required` attributes and `<span class="required">*</span>` to mandatory logbook fields (datetime, site/lieu, voile, duree).
   - Re-enable the corresponding UI tests in `logbook_school.test.js` and update snapshots.

2. **Custom Validation Feedback**
   - In `js/views/logbook.js`, intercept the `#lb-form` submit event.
   - Run `checkValidity()` on the form. If invalid, find the missing fields.
   - If `#lb-voile` is empty, check if `app.equipment.voiles` has any items. If empty, show UI alert: "Vous n'avez pas de voile configurée. Veuillez l'ajouter dans l'onglet Matériel." Else show: "Il manque la voile."
   - Apply similar clear alerts for missing Duration or Site.

3. **School / Course Activities Update**
   - In `js/views/logbook.js`, update the "École" (School) group in the Flight HTML template.
   - Add a checkbox "C'est un stage" (It is a course).
   - If checked, show inputs for "Nom du stage" and `<select>` for "Spécialité" (Initiation, Perfectionnement, Progression, SIV, etc.).

4. **Rescue Deployed Field**
   - In `js/views/logbook.js` (Flight template), add a toggle "Secours ouvert ?".
   - If checked, show a select box populated with the user's available "Secours" (rescue parachutes) from `app.equipment`.

5. **Equipment Linkage: Harness <-> Rescue**
   - In `js/views/logbook.js`, update `renderEquipmentForm()` to show an extra select field when type is "sellette".
   - Populate this select with available "Secours".
   - Save the `linkedRescueId` field when adding/updating equipment.
   - Update `EquipmentConfig` type/structure if needed.

6. **Auto-Select Linked Rescue in Logbook**
   - When the user selects a "Sellette" (or defaults to the active harness) and checks "Secours ouvert ?", check if the harness has a `linkedRescueId`.
   - If it does, automatically set the `#lb-rescue` select to this ID.

7. **Data Model Updates**
   - Update `LogbookService.addFlight()` and `normalizeFlight()` in `js/services/logbook_service.js` to safely persist the new fields (`stageName`, `stageSpecialty`, `rescueDeployed`, `rescueId`).

8. **Tests Update**
   - Add/update tests in `tests/views/logbook_render.test.js`, `tests/views/logbook_school.test.js` (for course fields), and `tests/services/logbook_service.test.js` to cover the new fields.
