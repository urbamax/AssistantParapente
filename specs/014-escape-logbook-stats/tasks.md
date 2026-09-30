# Tasks: Escape Pilot Data in Logbook Statistics

- [X] T001 Add a `renderStats` test with markup payloads in wing, place, flight type, take-off technique and exercise in `tests/views/logbook_xss.test.js`; confirm it fails
- [X] T002 Wrap the five values with `escapeHTML` in `renderStats` (`js/views/logbook.js`)
- [X] T003 Run lint, format check, typecheck, unit tests and end-to-end tests
