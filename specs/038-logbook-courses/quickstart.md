# Quickstart: Logbook Courses

## Run the checks

```bash
npx vitest run tests/services/logbook_courses.test.js tests/views/logbook_courses_form.test.js tests/views/logbook_courses_stats.test.js
npx playwright test tests/e2e/logbook_courses.spec.js
npm run verify
```

## See it working

1. Serve the app (`python3 -m http.server` or the dev server) and open the logbook.
2. Add a flight: tick **Session encadrée par une école**, school "Ecole Test", add two instructors
   ("Gilbert", "Marie"), tick **C'est un stage**, name "Stage été", specialty "SIV", add a companion and
   a pilot. Save.
3. Add another session: tick the school box and the course box, type "Stage" in the course name and pick
   "Stage été". Expected: school, specialty, both instructors, companion and pilot are filled in, and the
   explanation line lists them.
4. Add a third session at the same place less than 3 h later. Expected: the form opens with the course
   already ticked and named.
5. Open the statistics. Expected: a **Stages** card with "Stage été", its flights and times; touch it:
   the history shows only those sessions under the filter banner.
6. Open a session saved before this feature with one instructor (or set `moniteur: 'Gilbert'` in the
   data). Expected: one chip "Gilbert", unchanged after save.

## Expected failures before the code exists (test-first)

The three Vitest files and the Playwright flow fail until the module, the form and the statistics are
written; they are the first tasks.
