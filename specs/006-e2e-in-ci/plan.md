# Implementation Plan: End-to-End and Script Tests in CI

**Branch**: `ci/e2e-tests` | **Spec**: [spec.md](spec.md)

## Summary

In `.github/workflows/ci.yml`: add a Python unittest step to `lint-and-test`, and a new
`e2e` job (Node 22, `npm ci`, `npx playwright install --with-deps chromium webkit`,
`npm run test:e2e`, upload `playwright-report/` on failure). In `playwright.config.js`, use the
`github` reporter plus a non-opening HTML report in CI.

## Constitution Check

| Principle | Status | Note |
|-----------|--------|------|
| IV. Test-first / merge gate | PASS | Closes B4: the e2e gate becomes automatic |
| VII. No build required | PASS | CI only |

Test-first note: the "test" of this change is the CI run itself (SC-001), observed on the pull
request; a deliberately failing scenario is not merged.

## Complexity Tracking

None.
