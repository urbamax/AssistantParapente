# Data Model: Question-Trap Box (061)

## QuestionTraps (file `js/data/qcm_question_traps.json`)

An object keyed by question code.

| Field | Type | Rule |
|---|---|---|
| key | string | an existing question code of `js/data/qcm_ffvl.csv`, not H, R or X |
| value | array of strings | 1 to 3 sentences, order = display order |

Sentence rules (enforced by `tests/data/quiz_question_traps.test.js`):

- non-empty, trimmed, ends with « . », fewer than 140 characters;
- no verdict word: juste(s), faux, fausse(s), vrai(e)(s), correct(e), exact(e), inexact(e), « bonne réponse », « à tort », « piège »;
- no address to the learner: tu, toi, ton, ta, tes, vous, votre, vos, imperative forms such as « repérez », « regarde »;
- no semicolon, no straight double quote (French guillemets « » allowed).

Counts at creation: 567 keys, 694 sentences (1: 443 questions, 2: 121, 3: 3).

## Runtime

- `QuizService.getQuestionTraps(code)` → frozen array of strings, empty when the code has no entry or the file failed to load.
- No persistence, no user data, no sync.
