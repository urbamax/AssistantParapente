# Contract: Voice Mode Modules

## `js/services/quiz_voice.js` (pure)

- `optionLetter(index: number): string` → `'A'`, `'B'`…
- `buildQuestionSpeech(question): string` → question text, then « Réponse A : text. » for each choice in displayed order.
- `buildFeedbackSpeech(result): string` → « Bonne réponse. » or « Mauvaise réponse. » followed by the explanation.
- `parseVoiceCommand(transcript: string, optionCount: number): VoiceCommand` (see data-model.md).
- `describeSelection(indexes: number[]): string` → « Sélection : B, D. » or « Sélection effacée. ».

## `js/services/voice_service.js`

- `canSpeak(): boolean`, `canListen(): boolean`
- `speak(text, { onEnd }?)`, `stopSpeaking()`, `isSpeaking(): boolean`
- `startListening({ onResult(alternatives: string[]), onError(code: string) })`, `stopListening()`, `isListening(): boolean`
  - error codes forwarded: `not-allowed`, `network`, `offline`, `unsupported`; `no-speech` / `aborted` restart silently.
  - listening pauses while speaking and resumes after.
- `getPrefs(): VoicePrefs`, `setPrefs(partial)`

## UI (`#qcm-voice-bar`)

| Element | `data-action` | Notes |
|---------|---------------|-------|
| « Lire » button | `quiz-voice-read` | `aria-pressed` while speaking |
| « Lecture auto » button | `quiz-voice-auto` | `aria-pressed` reflects the setting |
| Microphone button | `quiz-voice-mic` | hidden if `!canListen()`; `aria-pressed` while listening |
| Notice « J'accepte » / « Annuler » | `quiz-voice-consent` / `quiz-voice-cancel` | shown until agreed |
| « Retirer l'accord » | `quiz-voice-revoke` | shown when agreed |
| Status line `#qcm-voice-status` | — | `aria-live="polite"`: « Entendu : … », « Pas compris : … », errors |
