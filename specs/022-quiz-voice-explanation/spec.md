# Feature Specification: Quiz Voice Follow-ups (Explanation on Mistake, Answer While Reading)

**Feature Branch**: `feat/quiz-voice-explanation`

**Created**: 2026-10-01

**Status**: Implemented

**Input**: Owner requests, follow-ups of spec 016 (quiz voice mode): « lire l'explication uniquement en erreur ou sur demande », « à aider » heard for « A et D », « on doit pouvoir répondre avant la fin de la lecture ».

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Auto-read skips the explanation of a right answer (Priority: P1)

With « Lecture auto » on, after validating a right answer the pilot only hears « Bonne réponse. »; after a wrong or incomplete answer they hear the verdict and the explanation, as before.

**Independent Test**: auto-read on; validate a right answer → only the verdict is spoken; validate a wrong answer → verdict and explanation.

**Acceptance Scenarios**:

1. **Given** auto-read on, **When** the answer is right, **Then** only « Bonne réponse. » is read.
2. **Given** auto-read on, **When** the answer is wrong or incomplete, **Then** the verdict and the explanation are read.

### User Story 2 - The explanation is always available on request (Priority: P1)

After validation, « Lire », the voice command « répète » and the new voice commands « explication » / « explique » read the verdict and the explanation, whatever the answer.

**Acceptance Scenarios**:

1. **Given** a right answer validated, **When** the pilot taps « Lire » or says « explication », **Then** the verdict and the explanation are read.

### User Story 3 - Answer before the end of the reading (Priority: P1)

While the app reads a question (or confirms a selection), the pilot can already say « B et D » or « valider »: the reading stops and the answer is taken. The app does not mistake its own voice for an answer.

**Acceptance Scenarios**:

1. **Given** a reading in progress and listening on, **When** the pilot says letters or a command, **Then** the reading stops and the action is done.
2. **Given** a reading in progress, **When** the recogniser hears the app's own words (« Réponse A : … », « Sélection : … ») or anything not understood, **Then** nothing changes and no « Pas compris » is shown.
3. **Given** a reading that ended less than 1.5 s ago, **When** a late echo arrives, **Then** it is ignored the same way.

### Edge Cases

- Exam mode is unchanged: no explanation is shown, none is read.
- Owner feedback: « A et D » is often transcribed « à aider » (already handled) or « A et dé » (FR-004).
- A question without explanation: only the verdict is read in every case.
- The explanation stays displayed on screen in every case; only the automatic reading changes.

## Requirements *(mandatory)*

- **FR-001**: Automatic reading after validation MUST read only the verdict when the answer is right.
- **FR-002**: Automatic reading MUST read the verdict and the explanation when the answer is wrong or incomplete.
- **FR-003**: « Lire » and the voice commands « répète », « explication », « explique » MUST read the verdict and the explanation after validation.
- **FR-004**: A letter homophone (« dé », « des », « c'est »…) right after « et » MUST count as a letter (« A et dé » → A and D), so that « A et D » is understood however it is transcribed (« à aider », « A et dé »); elsewhere in a longer phrase it stays « not understood » (« c'est la B »).

- **FR-005**: Listening MUST stay on while the app reads (this replaces spec 016 FR-009); an understood letter or command MUST stop the reading and be applied.
- **FR-006**: During a reading and for 1.5 s after it, a phrase containing « réponse(s) » or « sélection », or a phrase not understood, MUST be ignored without any message.

## Success Criteria *(mandatory)*

- **SC-001**: 0 explanation read automatically after a right answer (automated test).
- **SC-002**: 100 % of wrong or incomplete answers have their explanation read when auto-read is on.
- **SC-003**: An answer said during a reading is applied without waiting (automated test); 0 echo of « Réponse X : … » is taken as an answer.

## Assumptions

- The device's echo cancellation removes most of the app's voice; the filter above covers what remains. Some phones may still not allow listening while speaking; then the answer is simply taken after the reading.
- « Incomplete » (some right answers missing, no wrong one ticked) counts as a mistake.
