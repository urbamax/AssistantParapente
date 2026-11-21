# Contract: Manual Content per Tab and Role

What `tests/views/manual_content.test.js` enforces. "Visible" means not inside a `hidden`
element after `applyRoleVisibility` for the given role. Phrases are checked case-insensitively;
the final wording comes from the screen labels found during the audit.

## Required (visible to everyone)

| Tab | Must mention |
|---|---|
| Général | installing the app (button, and the steps on iPhone/iPad); the feedback form (report a bug, suggestion); the Discord server; the update is required, applied with « Mettre à jour » |
| Carnet de Vol | a flight takes the new name of its site when the FFVL renames it |
| Sécurité | four tabs; « Fiche ICE »; health data; stays on the device by default; online copy only with consent on each device; can be deleted |
| QCM | acronyms in explanations show their meaning and source; revision axes hide mastered chapters |
| Bibliothèque | official FFVL texts; the reserve-parachute guide |
| Statistiques | tiles and themes can be combined; « S'entraîner sur ces » questions; « Retour aux statistiques » |

## Forbidden (visible to anyone)

| Phrase | Why |
|---|---|
| « trois rubriques » (Sécurité) | The screen has four |
| « pour que vous puissiez recharger la page » | The update is now required |
| « Maîtrisé » as a revision-axes class | Mastered chapters are hidden (PR 289) |

## Role split (existing, kept)

- Without `beta`: no calculated-weather word (`tests/views/manual_by_role.test.js` regex), no Calcul Volabilité tab, no Sites de vol tab or section.
- With `beta` but not `owner`: Calcul Volabilité visible, Sites de vol hidden.
- With `owner`: Sites de vol visible.

## Static texts (existing, kept)

Every text has a `manualModal.*` key, and the HTML equals the catalogue (`tests/views/static_texts.test.js`).
