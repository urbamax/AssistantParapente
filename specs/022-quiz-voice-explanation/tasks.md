# Tasks: Quiz Voice Follow-ups

- [x] T001 [US1] Write tests for `buildAutoFeedbackSpeech` (right → verdict only; wrong and incomplete → verdict and explanation) and for « explication » / « explique » as `repeat` in tests/services/quiz_voice.test.js
- [x] T002 [US1] Write view tests: auto-read after a right answer speaks only « Bonne réponse. », after a wrong answer the full feedback; « Lire » and « explication » after a right answer read the full feedback, in tests/views/quiz_voice.test.js
- [x] T003 [US1] Implement `buildAutoFeedbackSpeech` and the new `repeat` variants in js/services/quiz_voice.js
- [x] T004 [US1] Use it for auto-read in `QuizView.validateQuestion` via `readAloud({ auto: true })` in js/views/quiz.js
- [x] T005 [US1] Accept letter homophones right after « et » (« A et dé », « B et des ») and test « à aider » in js/services/quiz_voice.js and tests/services/quiz_voice.test.js
- [x] T006 [US3] Write tests: listening stays on while speaking, `isEchoWindow` (during and 1.5 s after), `looksLikeEcho`, view answers during reading and ignores echoes, in tests/services/voice_service.test.js, tests/services/quiz_voice.test.js, tests/views/quiz_voice.test.js
- [x] T007 [US3] Implement in js/services/voice_service.js, js/services/quiz_voice.js and `QuizView.handleVoiceResult` in js/views/quiz.js; adapt tests/e2e/quiz_voice.spec.js
- [x] T008 Run lint, format check, typecheck, unit tests, e2e tests and build
