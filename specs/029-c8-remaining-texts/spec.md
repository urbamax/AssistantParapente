# Feature Specification: Remaining Inline Texts (Audit Gap C8, Completion)

**Feature Branch**: `fix/c8-remaining-texts`

**Created**: 2026-10-05

**Status**: Implemented

**Input**: After closing C8 (specs 014–026), a scan of every JavaScript file found user-facing texts outside the migrated screens: update banner, load and crash screens, theme button title, privacy message, 3D map, date format, and messages of the logbook, sites and quiz services. The owner asked to fix them.

## Requirements *(mandatory)*

- **FR-001**: The texts of `app_update.js`, `base_view.js`, `router.js`, `ui_manager.js`, `gdpr_engine.js`, `map_3d.js`, `date_utils.js`, `quiz_service.js`, `logbook_service.js` and `sites_service.js` MUST come from the catalogue (new sections `update`, `errors`, `theme`, `privacy`, `map3d`, `dates`, `sites.service`; new keys in `logbook.weather` and `logbook.igc`).
- **FR-002**: Displayed texts MUST stay identical (existing snapshot tests unchanged), except two messages shown in English to the pilot, now in French: « No valid GPS data found in file. » → « Aucun point GPS valide dans le fichier. », « Open-Meteo API error: N » → « Erreur du service météo Open-Meteo (N) ».
- **FR-003**: Saving the current place with an empty field MUST name it « Nouveau lieu » (bug found on the way: the code compared the field hint with an old text, so the place was named after the hint « Adresse ou ville (ex: Annecy)... »). The code reads the hint from the catalogue, the same text as the page.
- **FR-004**: The shared inline-text check MUST cover these ten files (data values listed: quiz themes, « Autre », « Inconnu », « × », « © Google », font family).

## Success Criteria *(mandatory)*

- **SC-001**: 0 inline user-facing texts in the 16 checked files.
- **SC-002**: All tests pass; the saved-place test fails without the fix.
