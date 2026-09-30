# Research: Voice Mode for the Quiz

## R1 - Reading engine

- **Decision**: browser `speechSynthesis`, `lang = 'fr-FR'`, rate 0.95, one utterance per call.
- **Rationale**: already used by the safety checklist (`js/views/safety.js`), offline, no third party.
- **Alternatives**: cloud text-to-speech (needs network, account and a third party: rejected).

## R2 - Recognition engine

- **Decision**: `SpeechRecognition` or `webkitSpeechRecognition`, `lang = 'fr-FR'`,
  `continuous = false`, `interimResults = false`, `maxAlternatives = 3`; restarted after each
  result while listening is on. Every alternative is tried until one is understood.
- **Rationale**: single-shot sessions are the most reliable across Chrome and Safari; restarting
  gives a hands-free loop. Alternatives raise the hit rate for single letters.
- **Alternatives**: on-device models (heavy download, Principle "heavy code on demand"; overkill).

## R3 - Privacy

- **Decision**: explicit opt-in stored as `voiceConsent: true` after a notice that names Google
  (Chrome, Edge) and Apple (Safari) as the receivers of the audio and states a network is needed;
  a « Retirer l'accord » button revokes it and stops listening. The notice also shows on every tap
  while no consent is stored.
- **Rationale**: Principle VI (GDPR consent for any third-party call); the app itself stores no audio.
- **Alternatives**: a new GDPR banner category (heavier, changes consent version for every user).

## R4 - Own voice echo

- **Decision**: recognition is aborted before speaking and restarted when the utterance ends.
- **Rationale**: otherwise the reading « Réponse A » is heard as the answer « A ».

## R5 - Phrase interpretation

- **Decision**: normalise (lower case, no accents, apostrophes and punctuation as spaces), match
  commands first (whole phrase), then remove fillers (« réponse(s) », « et », « la », « le »,
  « les », « lettre ») and require every remaining token to be a letter word; concatenated letters
  (« bd ») are split. Letter words: `a ah ha` → A, `b be bee` → B, `c ce ces ses sait cest` → C,
  `d de des` → D, `e eu euh` → E, `f ef effe` → F. A letter beyond the answer count, or any other
  word, gives « not understood ».
- **Rationale**: the recogniser often writes letters as their French homophones; requiring every
  token to be a letter avoids reading ordinary sentences as answers.

## R6 - Selection semantics

- **Decision**: letters replace the whole selection; « effacer » empties it.
- **Rationale**: predictable when repeated; « B et D » states the full answer.
