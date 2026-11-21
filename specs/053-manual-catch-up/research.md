# Research: User Manual Catch-Up

## R1. Where the manual text lives

- **Decision**: edit `components/manual_modal.html` and the matching `manualModal` keys of `js/i18n/fr_html.js` together, in the same commit.
- **Rationale**: the app shows the HTML as is (the catalogue is not loaded at run time); `tests/views/static_texts.test.js` fails if a text has no key or differs from its catalogue value (spec 026). Rich text uses `data-i18n-html` and is compared as parsed HTML.
- **Alternatives considered**: generate the HTML from the catalogue (rejected: changes how the manual is built, out of scope); edit only the HTML (rejected: breaks the spec 026 test and the future translation).

## R2. How role-gated parts work

- **Decision**: keep using `data-requires-role="beta|owner"` (shown only with the role) and `data-hidden-with-role="beta"` (public variant hidden when the role is there), as the manual already does. When a paragraph differs by role, write two variants.
- **Rationale**: `applyRoleVisibility` (`js/services/access_service.js`) runs on the modal right after it is loaded (`ui_manager._ensureManualModal`); `tests/views/manual_by_role.test.js` already checks that a user without `beta` sees no calculated-weather word and no sites section.
- **Alternatives considered**: separate manual files per role (rejected: duplication, three files to keep in step).

## R3. What counts as "the app" for the audit

- **Decision**: the reference is `origin/main` on 2026-11-21 (after PR 321). Each manual part is checked against the screen in the dev preview and, where needed, against the code and the PR that shipped it. Results go in `audit.md` (one row per part: tab, role, result, evidence).
- **Rationale**: SC-001 needs a recorded result for every part; PR descriptions alone can be out of date, the screen is the truth.
- **Alternatives considered**: audit only the 11 known gaps (rejected: the owner reports the whole manual lags).

## R4. Where the new public topics go

- **Decision**: in Général, add « Installer l'application », « Vos retours » (feedback form) and « La communauté Discord » after « Hors ligne et mises à jour ». In Sécurité, add a « 4. Fiche ICE » part and change « trois rubriques » to « quatre rubriques ». Acronym tooltips go in QCM, the site-rename behaviour in Carnet de Vol (site field), new documents in Bibliothèque.
- **Rationale**: users look for help in the tab of the screen they are on (`showManual('contextual')` opens the tab of the active screen); Général already holds account, theme and offline topics.
- **Alternatives considered**: a new « Aide & communauté » tab (rejected for now: more navigation, and the owner can still ask for it).

## R5. ICE wording

- **Decision**: describe what the sheet holds (emergency contacts, medical information), the helmet sticker, that the sheet stays on the device by default, that an online copy needs the pilot's agreement on each device, and that it can be deleted at any time; use the labels on screen (« Sauvegarde en ligne (facultative) », « Retrouver ma fiche en ligne sur cet appareil »). Exact labels are read from the screen during implementation.
- **Rationale**: health data (GDPR Art. 9, PRs 180 and 307); Principle VI.

## R6. Tests

- **Decision**: a new Vitest file `tests/views/manual_content.test.js` reads the HTML, applies each role (none, beta, owner) and checks required phrases (e.g. Fiche ICE, « Mettre à jour », « S'entraîner sur ces », install, Discord, feedback) and forbidden ones (« trois rubriques », « vous puissiez recharger la page », the « Maîtrisé » axes class). One Playwright test opens the manual from the app and checks the Sécurité and Général tabs. Both are written first and seen failing.
- **Rationale**: Principle IV (test-first; a user-visible flow has an end-to-end test). Content tests stop the manual from going stale again on these points.
- **Alternatives considered**: snapshot of the whole manual (rejected: breaks on every wording change and says nothing about meaning).

## R7. Discord guide and notice

- **Decision**: after the in-app text is final, the matching cards of the owner's local `scripts/discord_guide.py` (7 cards: Démarrer, Carnet de vol & traces, Matériel, Sécurité, QCM & théorie, Bibliothèque, Hors ligne & données) are updated with the public changes only. They are republished to `#guide-utilisation` after deployment, with the owner's approval. The notice text in the spec is finalised and posted to `#mises-a-jour` only, after deployment and approval.
- **Rationale**: constitution 1.1.0 workflow rules; the Discord tooling must never be committed.
- **Alternatives considered**: generate the Discord cards from the manual HTML (rejected for this feature: the cards are written as short summaries with a different structure; possible later improvement).
