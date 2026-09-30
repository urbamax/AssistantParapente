# Tasks: Automated Check That Every Control Is Wired

- [X] T001 Write `tests/core/action_wiring.test.js` (used names, registrations parsed from `main.js`, owners, checks FR-001 to FR-004 with locations)
- [X] T002 Add fixture cases proving each rule fails on a bad input
- [X] T003 Run it on `origin/main` (before specs 018/019): see it fail on the known mistakes; on this branch: see it pass
- [X] T004 Mention the check in `DOCUMENTATION.md`
- [X] T005 Run lint, format check, typecheck, `npm test`, `npm run test:e2e`, `npm run build`
