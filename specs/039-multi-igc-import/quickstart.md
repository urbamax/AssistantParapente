# Quickstart: Import Several Flights At Once

```bash
npx vitest run tests/services/igc_batch_import.test.js tests/services/logbook_defaults.test.js tests/views/logbook_batch_import.test.js
npx playwright test tests/e2e/logbook_batch_import.spec.js
```

1. Open the logbook, "Ajouter une session", and select three `.igc` files from `tests/fixtures/` (or drop them
   on the import zone). A table with three rows opens.
2. Check the starting values; change the wing of one row; add a pilot on another; pick a known course on a
   third.
3. Add a corrupted file to the selection: its row says it cannot be read and cannot be included.
4. Import. The history opens with the new flights; "Voir la trace" works on each.
5. Select the same files again: every row is flagged "déjà dans le carnet" and unticked.
