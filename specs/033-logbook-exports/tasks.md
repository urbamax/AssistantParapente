# Tasks: Logbook Exports

1. Write failing unit tests for the file-name and report builders (`tests/services/logbook_export.test.js`).
2. Implement `js/services/logbook_export.js` (pure builders) and the French strings.
3. Write failing view tests: IGC button only with a trace, download name and content, empty report message, report sent to print.
4. Implement `downloadTrace` and `exportLogbookPdf` in `LogbookView`, the card button and the history button; register the actions in `main.js`; add `js/utils/print.js`.
5. Add a Playwright test: IGC download from a card, and the PDF button asking for confirmation on an empty logbook.
6. Update the user manual and the roadmap.
