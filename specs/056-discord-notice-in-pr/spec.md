# Feature Specification: Discord Notices Carried by Pull Requests

**Feature Branch**: `chore/056-discord-notice-in-pr`

**Created**: 2026-11-22

**Status**: Draft

**Input**: Owner: « Les autres agents n'indiquent rien dans mises-a-jour... »

## Context

Constitution 1.1.0 asks for a Discord update notice (`#mises-a-jour`) and a matching Discord guide
update (`#guide-utilisation`) after deployment, with the owner's approval. In practice nothing is
posted:

1. An agent's session ends when its pull request is opened; the owner deploys later over SSH, so no
   one is left to post.
2. The Discord tooling and token live only in the owner's main checkout and are git-ignored; an
   agent working in a worktree has neither.
3. Nothing checks that the spec's « Release Announcement » section is filled (spec 054 has none;
   PR 323 has no spec).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every pull request says what to tell the community (Priority: P1)

**Independent Test**: open a PR without the sections: the CI check fails with a message saying what
to add. Add them: the check passes.

**Acceptance Scenarios**:

1. **Given** a PR body without `## Discord notice` or without `## Discord guide`, **When** CI runs, **Then** the check fails and names the missing section.
2. **Given** a section that is empty, holds only the template comment, or says `None` without a reason, **When** CI runs, **Then** the check fails.
3. **Given** `None: <reason>` or a French text, **When** CI runs, **Then** the check passes; a notice longer than Discord's 2,000-character limit fails.
4. **Given** a PR opened by a bot (Dependabot), **When** CI runs, **Then** the check is skipped.

### User Story 2 - After a deployment, one session posts everything that is pending (Priority: P1)

**Independent Test**: after merging PRs with notices, the owner's local tool lists every pending
notice and guide change since the last batch; nothing is posted until the owner approves; posted PRs
are never posted twice.

**Acceptance Scenarios**:

1. **Given** merged PRs since the last batch, **When** the owner says the deployment is done, **Then** a session (in the main checkout) lists their notices and guide changes and shows them to the owner.
2. **Given** the owner approves, **When** the session posts, **Then** each notice goes to `#mises-a-jour` only, the guide changes are applied to the local guide and `#guide-utilisation` is republished, and the PR numbers are recorded as done.
3. **Given** a PR whose sections say `None`, **Then** it is recorded as done without posting.

## Requirements *(mandatory)*

- **FR-001**: Every PR to `main` (except bot PRs) MUST have a `## Discord notice` section and a `## Discord guide` section, each holding French text or `None: <reason>`.
- **FR-002**: A CI check MUST enforce FR-001 by reading the PR body from the event file (never interpolated into a shell command).
- **FR-003**: A notice MUST fit in one Discord message (2,000 characters).
- **FR-004**: The owner's local tool (git-ignored, main checkout) MUST list pending PRs since a recorded baseline, post approved notices to `#mises-a-jour`, and record done PRs in a git-ignored ledger.
- **FR-005**: Nothing is posted without the owner's approval in the conversation.
- **FR-006**: The constitution, spec/plan/tasks templates and a new pull request template MUST describe this flow instead of « post after deployment ».

## Success Criteria *(mandatory)*

- **SC-001**: 100 % of non-bot PRs merged after this change carry both sections.
- **SC-002**: After a deployment, one request (« publie les annonces ») is enough to post every pending notice.

## User Manual Impact *(mandatory)*

- **Sections checked**: none affected; this changes the development workflow, not the app.
- **Updates required**: No impact: no user-visible change.
- **Discord guide (`#guide-utilisation`)**: No change.

## Release Announcement *(mandatory)*

- **Availability**: no user-visible change.
- **Discord notice**: None: internal workflow change.

## Assumptions

- The ledger baseline is PR 325: PRs merged up to it are not announced by the tool (324 was announced by hand); the owner may still announce older ones by hand.
- The PR body is the right carrier: agents always write one, and it survives after their session ends.
