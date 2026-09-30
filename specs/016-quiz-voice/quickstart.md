# Quickstart: Voice Mode for the Quiz

```bash
npx vitest run tests/services/quiz_voice.test.js tests/services/voice_service.test.js tests/views/quiz_voice.test.js
npx playwright test tests/e2e/quiz_voice.spec.js
npm run lint && npm run format:check && npm run typecheck && npm test && npm run test:e2e && npm run build
```

Manual check (Chrome, then Safari): start a training session, tap « Lire » (question and lettered
answers are read), turn on « Lecture auto », validate (verdict and explanation are read), tap the
microphone, accept the notice, say « B et D », then « valider », then « suivante ».
In Firefox the microphone is not shown.
