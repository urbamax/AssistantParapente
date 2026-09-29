# Tasks: End-to-End and Script Tests in CI

- [X] T001 [US1] In `playwright.config.js`, set `reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html'`
- [X] T002 [US1] In `.github/workflows/ci.yml`, add the step `python3 -m unittest discover -s tests/scripts` to `lint-and-test` (after `npm test`)
- [X] T003 [US1] In `.github/workflows/ci.yml`, add a job `e2e` (ubuntu-latest, Node 22 with npm cache, `npm ci`, `npx playwright install --with-deps chromium webkit`, `npm run test:e2e`, `actions/upload-artifact@v4` of `playwright-report/` when the job fails, retention 7 days)
- [X] T004 [US1] Run `npm run test:e2e` locally with `CI=1` to check the CI settings (1 worker, retries) pass
- [ ] T005 [US1] Push, open the pull request and check both jobs pass on GitHub (SC-001)
- [X] T006 Update `DOCUMENTATION.md` (Verification & Debugging Toolkit: e2e now in CI)
