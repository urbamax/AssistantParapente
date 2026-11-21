---
description: "Task list for the user manual catch-up"
---

# Tasks: User Manual Catch-Up

**Input**: Design documents from `specs/053-manual-catch-up/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/manual-content.md, quickstart.md

**Tests**: required (constitution Principle IV, research R6): content tests and one end-to-end flow, written and seen failing before the text changes.

**Organization**: by user story. Every text change edits **both** `components/manual_modal.html` and the matching key under `manualModal` in `js/i18n/fr_html.js`, with identical text (`tests/views/static_texts.test.js`). Because all stories touch these two files, story tasks are sequential, not `[P]`.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Start the dev preview (`.claude/launch.json`) and confirm the manual opens from the bottom navigation (`data-action="showManual"`, `index.html`) and from the header logo (`components/header.html`), signed out
- [X] T002 Create `specs/053-manual-catch-up/audit.md` with a table (tab, key, role, result, evidence) and one row per manual part currently in `components/manual_modal.html` (role from `data-requires-role` / `data-hidden-with-role`; result left empty)

---

## Phase 2: Foundational (blocking)

- [X] T003 Create `tests/views/manual_content.test.js`: load `components/manual_modal.html` as `tests/views/manual_by_role.test.js` does, apply `applyRoleVisibility` with no role, `beta` and `owner` (`AccessService`), and add a `visibleText(tabId)` helper scoped to `#manual-section-<tab>`; no assertion yet
- [X] T004 Audit pass, signed out: for each public row of `specs/053-manual-catch-up/audit.md`, compare the text with the screen in the preview (and the PR or code when the screen is not enough); fill `result` (`kept`, `corrected`, `added`, `removed`) and `evidence`; write the exact on-screen labels needed later (ICE card, install button, feedback form, statistics buttons, update overlay)
- [X] T005 Audit pass, `beta` and `owner`: same as T004 for the role-gated rows (Sites de vol, Calcul Volabilité, beta variants), including the forecast hour in the site's time zone (PR 313); use a test account with the role, never a real user's
- [X] T006 Add to `audit.md` any outdated content found that is not in the spec's tables, and decide each one's result

**Checkpoint**: every manual part has an audit result; labels for the new text are known.

---

## Phase 3: User Story 1 - Every visible feature is described (P1) 🎯 MVP

**Goal**: the 7 missing topics are in the manual, in the right tab, for the right roles.

**Independent Test**: signed out, each topic of the "Required" table of `contracts/manual-content.md` is visible in its tab.

### Tests (write first, see them fail)

- [X] T007 [US1] In `tests/views/manual_content.test.js`, assert for no role: Général mentions installing the app (and the iPhone/iPad steps), the feedback form and the Discord server; Sécurité mentions « Fiche ICE », health data, staying on the device by default, consent on each device and deletion; QCM mentions acronym meanings with their source; Carnet de Vol mentions a flight taking its site's new name; Bibliothèque mentions the official FFVL texts and the reserve-parachute guide
- [X] T008 [P] [US1] Create `tests/e2e/manual.spec.js` (GDPR consent set in `addInitScript` as in `tests/e2e/safety_ice_theme.spec.js`): open the manual from the bottom navigation, open Sécurité and see Fiche ICE, open Général and see install, feedback and Discord; no page error
- [X] T009 [US1] Run `npx vitest run tests/views/manual_content.test.js` and `npx playwright test tests/e2e/manual.spec.js`; confirm they fail for the missing topics

### Implementation

- [X] T010 [US1] Général (`#manual-section-dashboard`): add « 5. Installer l'application », « 6. Vos retours » and « 7. La communauté Discord » after « 4. Hors ligne et mises à jour », in `components/manual_modal.html` and new `manualModal` keys in `js/i18n/fr_html.js`, using the labels from T004
- [X] T011 [US1] Sécurité (`#manual-section-safety`): add « 4. Fiche ICE » (contents, helmet sticker, device-only by default, online copy only after consent on each device, deletion, the on-screen labels « Sauvegarde en ligne (facultative) » / « Retrouver ma fiche en ligne sur cet appareil » as found in T004) in both files
- [X] T012 [US1] QCM (`#manual-section-qcm`): add the acronym tooltips (only in explanations, meaning plus a button to the library page) in both files
- [X] T013 [US1] Carnet de Vol (`#manual-section-logbook`, site field): add that a flight linked to an FFVL site takes its new name when the site is renamed, and that a free place stays as typed, in both files
- [X] T014 [US1] Bibliothèque (`#manual-section-library`): add the official FFVL texts (statuts, chartes, accompagnateur and biplace texts, accident declaration), the public safety and weather texts, and the SNMVL reserve-parachute guide, in both files
- [X] T015 [US1] Run the tests of T009 and `npx vitest run tests/views/static_texts.test.js tests/views/manual_by_role.test.js`; all green; mark rows `added` in `audit.md`

**Checkpoint**: US1 works on its own (MVP).

---

## Phase 4: User Story 2 - No outdated description (P1)

**Goal**: no manual sentence contradicts the app.

**Independent Test**: each "Forbidden" phrase of `contracts/manual-content.md` is gone, and the replacement wording matches the app.

### Tests (write first, see them fail)

- [X] T016 [US2] In `tests/views/manual_content.test.js`, assert for every role: no « trois rubriques », no « pour que vous puissiez recharger la page », no « Maîtrisé » as a revision-axes class; and positively: Général says the update is required with « Mettre à jour »; Statistiques mentions combining tiles and themes, « S'entraîner sur ces » and « Retour aux statistiques »; QCM says mastered chapters are hidden in the revision axes
- [X] T017 [US2] Run `npx vitest run tests/views/manual_content.test.js`; confirm the new assertions fail

### Implementation

- [X] T018 [US2] Général: rewrite the update bullet of « 4. Hors ligne et mises à jour » (`manualModal` key of « lorsqu'une mise à jour… ») to the mandatory full-screen « Mettre à jour » overlay, in both files
- [X] T019 [US2] Sécurité: change « donnant accès à ses trois rubriques » to four, in both files
- [X] T020 [US2] Statistiques (`#manual-section-stats`): rewrite the intro and « 1. Analyse par Thème » for faceted tiles and themes (each group updates the other's counts, theme rates unchanged), « S'entraîner sur ces N questions » and « Retour aux statistiques » with cleared filters, in both files
- [X] T021 [US2] QCM « 5. Les Axes de Révision »: remove the « Maîtrisé » class, say mastered chapters and empty filters are hidden, in both files
- [X] T022 [US2] Apply every other `corrected` or `removed` row of `audit.md` (public rows) in both files
- [X] T023 [US2] Run `npx vitest run tests/views/manual_content.test.js tests/views/static_texts.test.js tests/views/manual_by_role.test.js`; all green

**Checkpoint**: US1 and US2 both pass.

---

## Phase 5: User Story 3 - Each role sees its own manual (P2)

**Goal**: role-gated parts are audited and the role split holds.

**Independent Test**: signed out, beta and owner each see only their parts (`contracts/manual-content.md`, "Role split").

- [X] T024 [US3] In `tests/views/manual_content.test.js`, assert for no role that none of the text added in T010–T014 or T018–T022 matches the calculated-weather regex of `tests/views/manual_by_role.test.js`, and for `owner` that Sites de vol is visible; see it fail if any added text leaks
- [X] T025 [US3] Apply the `corrected` / `removed` rows of `audit.md` for `beta` and `owner` parts (Sites de vol, Calcul Volabilité, beta variants), writing a `beta` and a `data-hidden-with-role="beta"` variant where a paragraph differs by role, in both files
- [X] T026 [US3] Run `npx vitest run tests/views/`; all green; in the preview, read every tab signed out, with a test `beta` account and with the owner account

---

## Phase 6: User Story 4 - Discord guide and update notice (P3)

**Goal**: the Discord guide matches the public manual; the notice is ready.

**Independent Test**: each public tab has a matching Discord card with the same meaning; the notice text is approved by the owner.

- [X] T027 [US4] In the owner's main checkout (not the worktree, never committed), update the cards of `scripts/discord_guide.py` (Démarrer, Carnet de vol & traces, Matériel, Sécurité, QCM & théorie, Bibliothèque, Hors ligne & données) with the public changes only; check `git status` there shows the file as ignored
- [X] T028 [US4] Finalise the French notice in the spec's « Release Announcement » section of `specs/053-manual-catch-up/spec.md` from what actually changed
- [ ] T029 [US4] After deployment and the owner's approval of both, republish `#guide-utilisation` (`python3 scripts/discord_guide.py`) and post the notice to `#mises-a-jour` with the owner's local Discord tooling; never before

---

## Phase 7: Polish & Cross-Cutting

- [X] T030 Check the manual in light and dark themes, on a phone width and with the keyboard only (Tab, Enter, Escape), and the contextual opening from the logbook, safety, quiz and stats screens
- [X] T031 Confirm `audit.md` has a result and evidence on every row (SC-001)
- [X] T032 Check the user manual itself is up to date per the constitution: this feature is the manual update; confirm no other manual part is left `outdated` in `audit.md`
- [ ] T033 Run `npm run verify` (CI-faithful) and read the final status line; then `npm run verify:full` for the end-to-end suite
- [ ] T034 Open the pull request (one PR for the whole feature), with the audit summary and the Discord notice draft

---

## Dependencies & Execution Order

- Setup (T001–T002) → Foundational (T003–T006) → US1 → US2 → US3 → US4 → Polish.
- US1 and US2 are both P1 but edit the same two files: do them in order.
- US3 depends on T005 (role audit). US4 depends on US1–US3 text being final.
- T029 waits for deployment and the owner's approval.

## Parallel Opportunities

- T008 (`tests/e2e/manual.spec.js`) can be written while T007 is written (different file).
- T004 and T005 can be split across two people (different roles), but write to the same `audit.md`: merge carefully.
- Everything else touches `components/manual_modal.html` and `js/i18n/fr_html.js` and runs in sequence.

## Implementation Strategy

1. MVP: Setup + Foundational + US1 (missing topics), then stop and check.
2. Add US2 (outdated statements), then US3 (role-gated parts).
3. Open the PR after Polish; US4 publishing happens after deployment.
