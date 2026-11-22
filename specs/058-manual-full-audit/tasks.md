# Tasks: Manual Full Audit Against the Code

- [X] T001 Extract every manual text per tab and role, and check each claim against the code (spec table)
- [X] T002 [US1] Add failing assertions to `tests/views/manual_content.test.js` (old wordings forbidden for every role; new facts required)
- [X] T003 [US1] Fix the eleven texts in `components/manual_modal.html` and `js/i18n/fr_html.js` (identical text)
- [X] T004 [US1] Record the corrected rows in `specs/053-manual-catch-up/audit.md`
- [X] T005 [US1] Update cards « 5. QCM & théorie » and « 6. Bibliothèque » of the owner's local `scripts/discord_guide.py` (never committed)
- [X] T005b [US1] Owner decision: hide the exam for « Tous les niveaux » (`isExamModeAvailable`), tests first (`tests/views/quiz_treuil_no_exam.test.js`, `tests/e2e/quiz_treuil_no_exam.spec.js`), stats snapshot updated
- [X] T006 Run `npm run verify`, open the PR with its Discord sections
- [ ] T007 After deployment, when the owner asks, republish `#guide-utilisation` (`scripts/discord_notices.py`)
