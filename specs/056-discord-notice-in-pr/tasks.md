# Tasks: Discord Notices Carried by Pull Requests

- [X] T001 [US1] Write `tests/scripts/pr_discord_sections.test.js` (missing, empty, comment-only, « None » without reason, too long, bot-free body, CRLF, generated-by line) and see it fail
- [X] T002 [US1] Write `scripts/pr_discord_sections.mjs` (`readSection`, `checkPrBody`, `extractSections`, `--check`, `--extract`) until the tests pass
- [X] T003 [US1] Add `.github/workflows/pr-discord-sections.yml` (pull_request opened/edited/reopened/synchronize, body read from the event file, bots skipped)
- [X] T004 [US1] Add `.github/pull_request_template.md` with both sections
- [X] T005 [US2] Amend the constitution (1.2.0) and the spec, plan and tasks templates; git-ignore `scripts/discord_notices.py` and its ledger
- [X] T006 [US2] Write the owner's local `scripts/discord_notices.py` (`list`, `post`, `done`) and its ledger (baseline PR 325), never committed
- [X] T007 [US2] Add both sections to open PR 326
- [X] T008 Run `npm run verify` and open the PR (with its own Discord sections)
