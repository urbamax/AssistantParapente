# Implementation Plan: Quiz Voice Follow-ups

**Branch**: `feat/quiz-voice-explanation` | **Date**: 2026-10-01 | **Spec**: [spec.md](spec.md)

## Summary

Add `buildAutoFeedbackSpeech(result)` to `js/services/quiz_voice.js`: the verdict alone for a
right answer, otherwise `buildFeedbackSpeech(result)`. `QuizView.readAloud({ auto: true })` uses it
after validation when auto-read is on; « Lire » and « répète » keep the full feedback. The voice
commands « explication » / « explique » are added as variants of `repeat`. Letter homophones right
after « et » count as letters.

Answer while reading: `VoiceService` no longer pauses recognition while speaking and exposes
`isEchoWindow()` (speaking, or less than 1.5 s since the last reading ended). `QuizView`
skips alternatives where `looksLikeEcho()` is true (contains « réponse(s) » / « sélection ») and
ignores not-understood phrases silently during that window; an understood phrase stops the reading.

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| I. UX and data integrity | PASS | Explanation still displayed; text read verbatim when read |
| III. Sourced content | PASS | No content change |
| IV. Test-first | PASS | Unit and view tests written and seen failing first |
| VIII. Layers | PASS | Pure logic in the service, wiring in the view |
| Language | PASS | No new user-facing text |

## Project Structure

```text
js/services/quiz_voice.js          # + buildAutoFeedbackSpeech, looksLikeEcho, repeat variants, homophones after « et »
js/services/voice_service.js       # listen while speaking, isEchoWindow
tests/services/voice_service.test.js
tests/e2e/quiz_voice.spec.js       # echo delay before « Pas compris »
js/views/quiz.js                   # readAloud({ auto })
tests/services/quiz_voice.test.js
tests/views/quiz_voice.test.js
```

## Complexity Tracking

None.
