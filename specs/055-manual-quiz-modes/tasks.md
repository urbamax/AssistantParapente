# Tasks: Manual Quiz Modes Fix

- [X] T001 [US1] Add failing assertions to `tests/views/manual_content.test.js`: no « 50%, 75% ou 100% », no « 1, 3, 7, 14 puis 30 », no « 10, 20, 30, 40 ou TOUTES » for any role; QCM mentions « Palier objectif », « 6 jours » and « de 5 à 50 »
- [X] T002 [US1] Rewrite `manualModal.choisissezUnNiveauGlobal`, `manualModal.revisionEspaceeUneQuestion` and `manualModal.enModeEntrainementOu` in `components/manual_modal.html` and `js/i18n/fr_html.js` (identical text)
- [X] T003 [US1] Mark the three rows `corrected` in `specs/053-manual-catch-up/audit.md` with their evidence
- [X] T004 [US1] Update card « 5. QCM & théorie » of the owner's local `scripts/discord_guide.py` (never committed)
- [ ] T005 Run `npm run verify` and open the PR
- [ ] T006 After deployment and the owner's approval, republish `#guide-utilisation`
