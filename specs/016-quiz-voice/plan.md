# Implementation Plan: Voice Mode for the Quiz

**Branch**: `feat/quiz-voice` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

## Summary

Add a voice bar to the quiz question screen, rendered by `QuizView` into an empty
`#qcm-voice-bar` container: « Lire », « Lecture auto », microphone, a status line and the
voice-answer notice. Browser speech is wrapped in `js/services/voice_service.js` (synthesis,
recognition, settings); quiz-specific pure logic (spoken texts, phrase interpretation) lives in
`js/services/quiz_voice.js` and is fully unit tested. Answer buttons show their letter.

## Technical Context

- **Language**: JavaScript ES modules, no build needed (Principle VII).
- **Browser APIs**: `speechSynthesis` / `SpeechSynthesisUtterance` (offline, all major browsers);
  `SpeechRecognition` / `webkitSpeechRecognition` (Chrome, Edge, Safari; none in Firefox).
  Both are feature-detected: no fallback library is needed since the controls are simply hidden.
- **Storage**: `StorageService`, new key `parapente_voice_prefs` = `{ autoRead, voiceConsent }`.
- **Tests**: Vitest (happy-dom, speech APIs mocked), Playwright (speech APIs stubbed by an init
  script).

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| I. UX and data integrity | PASS | Quiz text read verbatim; quiz flow unchanged when voice is unavailable |
| II. Decision support | N/A | No flying verdict involved |
| III. Sourced content | PASS | Nothing rephrased; only letters and « Réponse » added |
| IV. Test-first | PASS | Unit tests for parsing, texts, service, view; e2e for read and voice answer, written first |
| V. Offline | PASS | Reading works offline; voice answers state that they need a network and say so when offline |
| VI. Privacy | PASS | Recognition sends audio to the browser vendor: explicit opt-in after a notice naming it, revocable, never default; no audio stored by the app |
| VII. No build | PASS | Plain modules with extensions |
| VIII. Layers | PASS | Browser APIs in a service, pure logic tested, view wires UI through `data-action`, resources released in `unmount()` |
| Language | PASS | All texts in `FR.quiz.voice` |
| Accessibility | PASS | Native buttons, `aria-pressed`, `aria-live` status, theme variables |

## Project Structure

```text
index.html                         # + <div id="qcm-voice-bar" hidden></div> in #qcm-screen
js/i18n/fr.js                      # + FR.quiz.voice
js/services/voice_service.js       # new: speak/stop, listen/stopListening, support checks, prefs
js/services/quiz_voice.js          # new: optionLetter, buildQuestionSpeech, buildFeedbackSpeech, parseVoiceCommand
js/views/quiz.js                   # voice bar, letters on answers, auto-read, command handling, unmount cleanup
css/quiz.css                       # voice bar, letter badge, notice (theme variables)
tests/services/quiz_voice.test.js  # new
tests/services/voice_service.test.js # new
tests/views/quiz_voice.test.js     # new
tests/e2e/quiz_voice.spec.js       # new
```

## Complexity Tracking

None.
