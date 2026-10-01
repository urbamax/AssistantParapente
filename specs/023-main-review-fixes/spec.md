# Feature Specification: Fixes After the Review of Direct Commits to Main

**Feature Branch**: `fix/main-review`

**Created**: 2026-10-01

**Status**: Implemented

**Input**: Owner request « vérifier tout ce qui a été modifié en ton absence ». Eight commits were pushed straight to `main` on 2026-09-30 (15af602, 7043d79, cba0dd4, b9f1ab0, 5ef2cec, f29ff78, 8fe2bcd, cb08a36), without spec or pull request; CI on `main` has failed since 15af602 (format, typecheck, unit tests). The review also found a data-integrity issue and inline texts.

## Requirements *(mandatory)*

- **FR-001**: `main` MUST pass lint, format check, typecheck and unit tests again (formatting of 5 files, quiz voice JSDoc, `functions/shared/fr.mjs` regenerated).
- **FR-002**: The quiz voice changes (incomplete verdict, answer text read with the selection, letter homophones) MUST be covered by tests; without answer texts the selection is still read « B, D » (not « B. D »).
- **FR-003**: The logbook MUST NOT show « Décollage et atterrissage » (or « Début et fin ») unless the landing weather was fetched and found identical (explicit `meteoAtterroSame` flag). A failed landing fetch or an older session shows « Décollage » only (Principle I, weather data integrity).
- **FR-004**: Texts added inline in services (forecast duration of the « hide unflyable » filter, blocked weather request message) MUST come from the catalogue; the duplicated duration code is one method; the filter loop tolerates a missing range.
- **FR-005**: The debug file `test_meteo.html` MUST be removed (the Raspberry Pi serves the source tree).
- **FR-006**: `js/data/qcm_ffvl_explanations.csv` MUST get back its CRLF line endings (lost in the merge of PR 75; content unchanged).

## Out of scope (reported to the owner)

- `BRIEF_CLAUDE_PHASE_3.md`, `RAPPORT_AUDIT_FINAL_CLAUDE.md`, `RAPPORT_MODERNITE_CLAUDE.md` committed in 15af602: kept, owner's decision.
- Process: direct pushes to `main` skip Spec Kit, review and CI (constitution governance).

## Success Criteria *(mandatory)*

- **SC-001**: CI green on the pull request (lint-and-test and e2e).
- **SC-002**: New tests: quiz voice (selection with texts, incomplete verdict, 7 homophones), logbook combined weather row (3 cases).
