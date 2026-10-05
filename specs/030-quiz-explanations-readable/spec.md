# Feature Specification: Quiz Explanations the App Could Not Read

**Feature Branch**: `fix/quiz-explanations-unreadable`

**Created**: 2026-10-05

**Status**: Implemented

**Input**: Checking audit gap B3 before closing it: 23 quiz questions showed no explanation to the pilot (S51B, S78M, S79M, U23M, U25M, U32B, U33B, U38B, U69B, U72B, U77B, U79B, W8B, W12B, W35B, W40B, W48M, W51B, W55V, W81B, W88M, W89M, W93M), although their explanations had been written in the rewrite batches.

## Cause

Their question text contains a semicolon (« …moins rapide ; vous effectuez le dépassement par : »). In `qcm_ffvl_explanations.csv` the question had been cut at that semicolon and its opening quote never closed, so the app read the whole row as one field and found no explanation.

## Requirements *(mandatory)*

- **FR-001**: Every quiz question MUST have a non-empty explanation as read by the app.
- **FR-002**: Every row of the explanations file MUST have exactly three fields (code, question, explanation).
- **FR-003**: The written explanations MUST stay word for word; only the question field is rebuilt from `qcm_ffvl.csv`. CRLF line endings kept.

## Success Criteria *(mandatory)*

- **SC-001**: 0 question without a readable explanation (test `tests/data/quiz_explanations_readable.test.js`, failing before).
- **SC-002**: The 857 explanations read after the fix are identical to the written ones (checked by script).
