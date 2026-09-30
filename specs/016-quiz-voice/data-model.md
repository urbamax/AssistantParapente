# Data Model: Voice Mode for the Quiz

## VoicePrefs (local storage key `parapente_voice_prefs`)

| Field | Type | Default | Meaning |
|-------|------|---------|---------|
| `autoRead` | boolean | `false` | Read each new question and the feedback automatically |
| `voiceConsent` | boolean | `false` | Pilot agreed to send their voice to the browser recognition service |

Missing or corrupt value → defaults. Not synced to the cloud.

## VoiceCommand (result of `parseVoiceCommand`)

- `{ type: 'letters', indexes: number[] }`: sorted, unique, each `< optionCount`.
- `{ type: 'command', name: 'validate' | 'next' | 'prev' | 'repeat' | 'clear' | 'stop' }`
- `{ type: 'unknown' }`

## Listening state (in memory, view)

`off` → (tap, consent given, supported, online) → `listening` ⇄ `paused while speaking`
→ (« stop », tap, leave quiz, fatal error) → `off`.
