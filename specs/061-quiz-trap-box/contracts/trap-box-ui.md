# UI Contract: « À lire de près » box

## Helper

`readCloselyHtml(sentences: string[]): string` (`js/views/quiz_read_closely.js`)

- `[]`, `null` or `undefined` → `''` (nothing rendered, no wrapper).
- Otherwise:

```html
<aside class="quiz-read-closely" role="note" aria-label="{quiz.question.readCloselyAria}">
  <div class="quiz-read-closely-title"><i class="ri-eye-line" aria-hidden="true"></i> {quiz.question.readCloselyTitle}</div>
  <p class="quiz-read-closely-text">{escaped sentence}</p>   <!-- one per sentence, in order -->
</aside>
```

- Every sentence goes through `escapeHTML()`; no other markup is added inside the text.

## Service

`QuizService.getQuestionTraps(code: string): readonly string[]` — empty array when unknown, when the data file is missing or before the quiz data is loaded.

## Placement

| View | Where | Condition |
|---|---|---|
| Training / revision / perfecting | feedback area after an answer, before the alerts and per-choice explanations | after the answer is submitted |
| Finished mock exam, review of wrong answers | in each reviewed question, above its choices' explanations | exam finished |
| Question bank | in the opened item, above the explanation | item opened |
| Statistics, exam history review (error cards and detailed questions) | under the question, above its choices | always (answered questions) |
| Statistics, detailed question list | at the top of the content built by `buildQuestionAnswersHtml` | item opened |
| Mock exam in progress | none | — |
| Errors workshop / revision axes | none (per-choice items) | — |

## Strings (`js/i18n/fr.js`, `quiz.question`)

- `readCloselyTitle`: « À lire de près »
- `readCloselyAria`: « À lire de près : ce qui rend cette question délicate »
