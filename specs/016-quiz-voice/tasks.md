# Tasks: Voice Mode for the Quiz

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/voice.md](contracts/voice.md)

Tests are mandatory (Constitution IV): each test task is written and seen failing before its implementation task.

## Phase 1: Setup

- [x] T001 Add `<div id="qcm-voice-bar" hidden></div>` inside `#qcm-screen` `.main-stage`, after `#qcm-mastery-progress`, in index.html
- [x] T002 Add the `FR.quiz.voice` texts (buttons, notice, status messages, spoken phrases) in js/i18n/fr.js

## Phase 2: Foundational

- [x] T003 [P] Write tests for `optionLetter`, `buildQuestionSpeech`, `buildFeedbackSpeech`, `describeSelection`, `parseVoiceCommand` (letters, homophones, concatenated letters, letter beyond `optionCount` → unknown, other words → unknown, each command and its variants) in tests/services/quiz_voice.test.js
- [x] T004 [P] Write tests for `canSpeak`, `canListen`, `speak`/`stopSpeaking`, listening pause while speaking, restart after a result, error codes, `offline` when `navigator.onLine` is false, prefs defaults (`autoRead: false`, `voiceConsent: false`) and corrupt value in tests/services/voice_service.test.js
- [x] T005 Implement js/services/quiz_voice.js per contracts/voice.md
- [x] T006 Implement js/services/voice_service.js per contracts/voice.md (storage key `parapente_voice_prefs`)

## Phase 3: User Story 1 - Hear the question and its answers (P1)

**Independent test**: « Lire » speaks the question and lettered answers; after validation, the verdict and explanation.

- [x] T007 [US1] Write view tests: voice bar hidden without speech; letters on answers; « Lire » speaks `buildQuestionSpeech`; after validation speaks `buildFeedbackSpeech` (not in exam); second tap and question change stop speech; `unmount` stops speech, in tests/views/quiz_voice.test.js
- [x] T008 [US1] Render the voice bar and letter badges, handle `quiz-voice-read`, stop speech on question change and in `unmount()`, in js/views/quiz.js
- [x] T009 [P] [US1] Style the voice bar, letter badge and status line with theme variables in css/quiz.css

## Phase 4: User Story 2 - Automatic reading (P2)

**Independent test**: « Lecture auto » on → new question read without a tap; setting kept after reload.

- [x] T010 [US2] Add view tests for `quiz-voice-auto` (toggle, `aria-pressed`, stored, auto-read on new question and after validation) in tests/views/quiz_voice.test.js
- [x] T011 [US2] Implement `quiz-voice-auto` and auto-read in js/views/quiz.js

## Phase 5: User Story 3 - Answer by voice (P3)

**Independent test**: notice before any listening; « B et D » selects B and D and shows « Entendu : … »; « valider » validates; unknown phrase changes nothing.

- [x] T012 [US3] Add view tests: mic hidden when `!canListen()`; notice first, cancel keeps off, accept stores `voiceConsent: true` and starts; letters replace selection; commands map to validate/next/prev/repeat/clear/stop; « Pas compris » leaves selection; letters ignored after validation; errors shown; revoke stops and clears consent; `unmount` stops listening, in tests/views/quiz_voice.test.js
- [x] T013 [US3] Implement mic, notice, consent/revoke, command handling and status line in js/views/quiz.js
- [x] T014 [US3] Write the end-to-end test with stubbed speech APIs (read, auto-read, consent, voice answer « b et d », « valider ») in tests/e2e/quiz_voice.spec.js

## Phase 6: Polish

- [x] T015 Mention voice answers (audio sent to the browser's recognition service only after agreement) in the privacy text of index.html
- [x] T016 Run lint, format check, typecheck, unit tests, e2e tests and build (quickstart.md)

## Dependencies

T001-T002 → T003-T006 → US1 → US2 → US3 → Polish. US2 and US3 reuse the voice bar from US1.

## Implementation Strategy

MVP = US1 (read-aloud, offline, no third party). US3 is experimental and opt-in.
