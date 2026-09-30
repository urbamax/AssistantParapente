# Feature Specification: Voice Mode for the Quiz

**Feature Branch**: `feat/quiz-voice`

**Created**: 2026-09-30

**Status**: Implemented

**Input**: Owner request « est-ce possible d'ajouter un mode vocal à la partie QCM ? », then « tout »: both read-aloud and voice answers on the quiz question screen.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hear the question and its answers (Priority: P1)

A pilot revising the FFVL theory taps a « Lire » button on the question screen: the app reads the question, then each answer preceded by its letter (« Réponse A : … »). After validating (outside exam mode), the pilot can hear the explanation with the same button.

**Why this priority**: it gives a hands-free, eyes-free way to revise (walking, before take-off) and helps pilots who read with difficulty. It works offline and without any third party.

**Independent Test**: start a training session, tap « Lire »: the spoken text is the question then « Réponse A : … », « Réponse B : … » in the displayed order; validate, tap « Lire » again: the explanation is read.

**Acceptance Scenarios**:

1. **Given** a question on screen, **When** the pilot taps « Lire », **Then** the question and every answer are read in French, each answer with the letter shown on screen.
2. **Given** a validated question outside exam mode, **When** the pilot taps « Lire », **Then** the verdict (« Bonne réponse » / « Mauvaise réponse ») and the explanation are read.
3. **Given** a reading in progress, **When** the pilot taps the button again, changes question or leaves the quiz, **Then** the reading stops at once.
4. **Given** a browser without speech synthesis, **When** the question screen shows, **Then** no voice controls appear and the quiz works as before.

---

### User Story 2 - Automatic reading (Priority: P2)

The pilot turns on « Lecture auto »: each new question is read as soon as it appears, and after validation the verdict and the explanation are read too. The choice is remembered on the device.

**Independent Test**: turn on « Lecture auto », go to the next question: it is read without a tap; reload the app: the setting is still on.

**Acceptance Scenarios**:

1. **Given** « Lecture auto » on, **When** a new question appears, **Then** it is read automatically.
2. **Given** « Lecture auto » off (default), **When** a new question appears, **Then** nothing is read.

---

### User Story 3 - Answer by voice (Priority: P3, experimental)

The pilot taps the microphone button. The first time, a notice explains that the voice is sent to the speech recognition service of the browser (Google for Chrome, Apple for Safari), that a network connection is needed, and asks for explicit agreement. Once listening, the pilot says the letters of the chosen answers (« A », « B et D ») and commands: « valider », « suivante », « précédente », « répète », « effacer », « stop ».

**Why this priority**: useful for a truly hands-free revision, but depends on the browser, the network and a third-party service, so it is optional and off by default.

**Independent Test**: with a simulated recognition result « B et D » the answers B and D become selected and « Entendu : b et d » is shown; with « valider » the question is validated; with an unknown phrase nothing changes and « Pas compris : … » is shown.

**Acceptance Scenarios**:

1. **Given** voice answers never agreed, **When** the pilot taps the microphone, **Then** the notice appears and nothing is listened to until the pilot agrees.
2. **Given** the pilot refuses the notice, **When** they come back later, **Then** the microphone is still off and the notice shows again on the next tap.
3. **Given** listening is on, **When** the pilot says letters, **Then** exactly those answers become selected (the previous selection is replaced) and what was heard is shown on screen.
4. **Given** listening is on, **When** the phrase is not understood, **Then** the selection is unchanged, nothing is validated and « Pas compris : <phrase> » is shown.
5. **Given** listening is on, **When** the app reads aloud, **Then** the app does not treat its own voice as an answer.
6. **Given** no network, a refused microphone or an unsupported browser, **When** the pilot tries to listen, **Then** a clear message explains why, and the buttons still work.
7. **Given** listening is on, **When** the pilot leaves the quiz or says « stop », **Then** the microphone is released.

### Edge Cases

- Answers are shuffled per question: letters always follow the displayed order. To make letters usable, each answer button shows its letter (A, B, C…) whenever the voice controls are available.
- A letter beyond the number of answers (« E » with 4 answers) is « Pas compris », never ignored silently.
- Common mishearings of French letters are accepted (« bé », « c'est », « dé »…); homophones that are also ordinary words are accepted only when the phrase contains nothing else.
- After validation, letters are ignored (answers are frozen) and « suivante » moves on.
- Exam mode: voice controls work, the explanation is not read (it is not shown), and leaving the page still invalidates the exam as before.
- The agreement for voice answers can be withdrawn at any time from the notice (« Désactiver ») and is never granted by default.
- The quiz content read aloud is exactly the displayed text (Principle III): nothing is rephrased.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The question screen MUST offer a « Lire » control that reads the question and every answer with its letter, in French, in the displayed order.
- **FR-002**: Outside exam mode, after validation, « Lire » MUST read the verdict and the explanation.
- **FR-003**: Any reading MUST stop when the pilot taps the control again, changes question or leaves the quiz.
- **FR-004**: A « Lecture auto » setting, off by default and remembered on the device, MUST read each new question and, after validation, the verdict and explanation.
- **FR-005**: Voice controls MUST be hidden when the browser cannot provide them; the quiz MUST keep working unchanged.
- **FR-006**: Voice answers MUST stay off until the pilot has agreed to a notice naming the third-party service and the need for a network; the agreement MUST be revocable.
- **FR-007**: Recognised letters MUST replace the selection with exactly those answers; commands MUST trigger the same actions as the buttons (validate, next, previous, read again, clear, stop).
- **FR-008**: Every recognised phrase MUST be shown (« Entendu : … » or « Pas compris : … »); an unrecognised phrase MUST NOT change the selection or validate.
- **FR-009**: The app MUST NOT listen while it speaks, and MUST release the microphone when the quiz is left.
- **FR-010**: All voice controls MUST be keyboard operable, have accessible names, and be readable in light and dark themes.
- **FR-011**: Every user-facing text of the feature MUST come from the strings catalogue.

### Key Entities

- **Voice settings** (on the device): auto-read on/off; voice-answer agreement given or not.
- **Voice command**: the result of interpreting a heard phrase: a set of letters, a command, or « not understood ».

## Success Criteria *(mandatory)*

- **SC-001**: A pilot can hear a whole question and its answers with 1 tap, offline.
- **SC-002**: 100 % of the phrase interpretation cases listed in the tests (letters, mishearings, commands, unknown phrases) give the expected result.
- **SC-003**: 0 voice answer is processed before the pilot's explicit agreement.
- **SC-004**: With voice unsupported, the quiz flow is identical to today (existing tests pass).

## Assumptions

- Reading uses the speech voices built into the device; their quality varies by device.
- Voice answers rely on the browser's recognition service; Firefox has none, so the microphone is not offered there.
- The letter badges on the answers are a small visible change accepted as part of the feature.
- Settings live in local storage, like the other quiz preferences; they are not synced.
