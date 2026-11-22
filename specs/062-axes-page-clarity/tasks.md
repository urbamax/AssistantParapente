# Tasks: Revision Axes Page Clarity

- [X] T001 Audit the page with the owner's stats export (spec table)
- [X] T002 [US1] Lot A: priority names, two filter rows counting chapters, useless filters hidden, « À corriger » counts omissions, box « dans N chapitres », reason line, page guide, « Voir tous (N, dont M surmontés) », pills « à corriger » (`js/views/quiz_axes_html.js`, `js/i18n/fr.js`)
- [X] T003 [US2] Lot B: 6-question method text, step 2 « Comprendre » groups traps, omissions and key points, step numbers without a gap, « À lire en premier » on the first manual only
- [X] T004 [US3] Lot C: folded cards (`card:<id>`), hidden mastered chapters named under the list
- [X] T005 Tests: `tests/views/quiz_axes_clarity.test.js`, updated `quiz_axes_traps.test.js`, e2e `revision_axes.spec.js`, manual content
- [X] T006 Manual paragraph « 5. Les Axes de Révision » (HTML and catalogue)
- [X] T007 Visual check with the owner's data: 3,944 px desktop (was ~21,600), 7,356 px at 375 px (was ~55,000), no horizontal scroll
- [ ] T008 Run `npm run verify:full`, open the PR with its Discord sections
