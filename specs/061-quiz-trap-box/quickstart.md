# Quickstart: validate the « À lire de près » box (061)

## Prerequisites

- `npm ci` in the worktree; the audit file `~/quiz-audit-kit/audit6/pieges_encarts.json` (only to regenerate the data).

## Regenerate and check the data

```bash
node scripts/build_question_traps.mjs ~/quiz-audit-kit/audit6/pieges_encarts.json
npx vitest run tests/data/quiz_question_traps.test.js
```

Expected: 567 keys, 694 sentences, test green.

## Unit and view tests

```bash
npx vitest run tests/services/quiz_service_traps.test.js tests/views/quiz_read_closely.test.js
```

## End to end

```bash
npx playwright test tests/e2e/quiz_read_closely.spec.js
```

Expected: in training, the box is absent before answering a question that has a trap and present after; absent after answering a question without a trap; never present during a mock exam; present in the finished exam's review.

## Manual check

1. Start a training series on a theme with weather questions, answer A92V (« Une brise de vallée ») if drawn: the box shows « « Jamais » tombe dès qu'un seul cas contraire existe. » (or the current sentence) above the explanations.
2. Toggle the dark theme: the box stays readable.
3. Phone width (375 px): no horizontal scroll.
4. Full CI-faithful check before pushing: `npm run verify` (the pre-push hook runs it).
