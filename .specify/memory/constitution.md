# Assistant Parapente Constitution

## Core Principles

### I. User Experience and Data Integrity First

User experience and the integrity of the data shown to pilots (weather, courses, quiz, sites,
the user's own flights) are the project's top priority. When a trade-off arises, they prevail
over developer convenience, delivery speed and new features.

- Every screen MUST be clear, consistent and responsive: an action always gives visible
  feedback, and loading, empty and error states are designed, never left blank or broken.
- Data MUST be shown faithfully to its source: weather values exactly as returned by the
  forecast provider, with the model and forecast time; course and quiz content exactly as
  in its source; site data with its origin. Data MUST NEVER be invented, silently altered or
  silently replaced by defaults.
- A change that degrades an existing user flow or the accuracy of displayed data MUST NOT be
  merged, even if it adds a feature.

### II. Decision Support, Not Decision (NON-NEGOTIABLE)

The app gives an opinion on flying conditions; it never decides and never authorises a flight.
Even a green verdict is only the app's opinion: whether conditions suit a given pilot (level,
experience, wing, current form) is always the pilot's call, and everything shown is a forecast
that MUST be checked on site.

- Weather scores and flyability indicators MUST be presented as an opinion based on
  forecasts, never as permission to fly. Wherever a verdict is shown, including a green one,
  the app MUST remind the pilot that the decision is theirs and that conditions must be
  checked on site.
- Uncertainty MUST be visible, not hidden or resolved on the pilot's behalf: missing data,
  disagreement between weather models (e.g. AROME vs GFS) and the age of a forecast MUST be
  shown explicitly, with the forecast timestamp.
- Missing or stale data MUST NOT be silently replaced by defaults or presented as a normal
  score.
- Any change to the scoring formula or its thresholds (`js/weatherScoring.js`) MUST be
  covered by tests and explained in the feature specification.

Rationale: a wrong or over-confident indication can contribute to an accident; the pilot must
always have the information needed to judge for themselves.

### III. Sourced Theory Content

Theory courses and quiz explanations prepare pilots for FFVL exams and for safe flying; they
MUST be accurate and traceable.

- Allowed sources are the PDFs of the in-app library (`courses/`) and official documents
  published by the FFVL or the DGAC (regulations, decrees), cited with a link. Only content
  that applies to paragliding is admissible: an FFVL or DGAC document about another
  discipline or another kind of aircraft is not a valid source.
- A "see in the course" link MUST point to a page verified by hand (`verifiedPage`);
  automatically generated course mappings MUST NEVER be shown as citations.
- No technical or safety claim may be written from general knowledge alone. When no source
  exists, the content MUST say so rather than force a citation.
- Every quiz explanation MUST justify every option of its question (correct, wrong and
  neutral), and every acronym MUST be spelled out at first use; an unknown acronym is flagged,
  never guessed.

### IV. Test-First Development (NON-NEGOTIABLE)

- Tests MUST be written before the code they cover, and MUST be seen failing before the
  implementation is written (red → green → refactor).
- Every change to logic (services, utilities, core, scoring, parsing, sync) MUST come with
  Vitest unit tests; every user-visible flow MUST be covered by a Playwright end-to-end test.
- Every bug fix MUST add a regression test that fails without the fix.
- A change MUST NOT be merged unless lint, format check, typecheck (0 errors), unit tests,
  end-to-end tests and the production build all pass.

### V. Offline-First, No Data Loss

Pilots use the app on take-off and in the mountains, often without a network.

- Every feature MUST remain usable offline: logbook and IGC import, quiz and revision,
  courses already opened, site sheets, and the last downloaded forecast (shown with its
  timestamp and flagged as not current).
- Local storage (LocalStorage, IndexedDB) is the primary store; cloud sync is optional.
- Sync with Cloud Firestore MUST merge local and remote data without overwriting or losing
  any of it (flights, quiz statistics, spaced-repetition state).
- Imports of public site data (FFVL, ParaglidingEarth) MUST be additive: a refresh never
  overwrites a hand-curated entry, and licences and attributions stay displayed.

### VI. Privacy by Default and Web Security

- The app MUST NOT include analytics or tracking of any kind.
- An account MUST remain optional: every feature works without one, and an account is used
  only to sync the user's own data.
- IGC files and flight data are processed in the browser and stay on the device. The only
  exception is sync: when the user signs in, their flights, IGC traces and other personal data
  are synced to their own cloud account, and nowhere else.
- GDPR consent MUST be respected for any non-essential storage or third-party call.
- Raw `innerHTML` with unescaped user or external data is forbidden: use `textContent`,
  `createElement()` or `escapeHTML()` (`js/core/security.js`).
- External links and `window.open` MUST use `rel="noopener noreferrer"`; scripts loaded
  from a CDN MUST carry a Subresource Integrity (`integrity`) attribute.
- No secret (private key, token, password) may be committed to the repository.

### VII. Web App Without a Mandatory Build

- The product MUST remain a web app (installable PWA running in the browser); it MUST NOT
  require a native app or an app store.
- The source MUST run as-is as native ES modules from any static server
  (`python3 -m http.server`). Vite is used only to produce an optimised `dist/`; source code
  MUST NOT depend on Vite-only features (`import.meta.env`, bare module imports, plugins that
  change semantics). Imports MUST include the file extension.
- Every file fetched at run time (JSON, CSV, HTML, PDF, images) MUST be listed in
  `STATIC_PATHS` in `vite.config.mjs`.
- Recent browser APIs that are not universally supported MUST go through a helper with a
  fallback (e.g. `toSorted` from `js/utils/array_utils.js`, the `Object.groupBy` fallback).

### VIII. Layered Architecture

- Views (`js/views/`) handle rendering and user interaction only; business logic, data and
  external APIs live in services (`js/services/`); reusable domain-agnostic logic lives in
  `js/utils/` as pure functions.
- Views extend `BaseView` and release their resources (maps, timers, listeners) in
  `unmount()`.
- No inline event handlers (`onclick=…`): interactions use `data-action` / `data-args`
  dispatched by `EventDelegator` and registered in `main.js`.
- Async methods of critical services MUST return `{ success, data, error }`; a view that
  receives a failure MUST call `renderErrorState()` with a retry action, never render a
  blank or broken screen.

## Product and Technical Constraints

- **Audience**: every paragliding pilot, from student to confirmed pilot. Features MUST NOT
  assume a given level unless the level filter (BI / BP / BPC / ALL) is applied.
- **Dependencies**: libraries and frameworks may be added when the plan justifies them, as
  long as Principles VI and VII still hold (web app, no tracking, source runnable without a
  build unless this constitution is amended). Heavy code (3D engine, large datasets) MUST be
  loaded on demand.
- **Language**: the UI is in French only. User-facing text of every new or reworked feature
  MUST live in a centralised strings module rather than inline in code, so the app can be
  translated later. Project artifacts (specifications, plans, documentation, commit
  messages) are written in English.
- **Devices and accessibility**: mobile and desktop are equally supported. Every screen MUST
  be usable on both, readable in light and dark themes with sufficient contrast, and
  operable with a keyboard.
- **Performance**: no change may visibly slow down app start-up or navigation. Numeric
  budgets will be added by amendment once current load times have been measured.

## Development Workflow and Release

- Every code change, however small, goes through the Spec Kit cycle: `/speckit-specify` →
  `/speckit-clarify` when needed → `/speckit-plan` (including the Constitution Check) →
  `/speckit-tasks` → `/speckit-implement`. A small fix may have a short specification, but
  never none.
- Existing code is not exempt: it is audited against this constitution, and every gap found
  is recorded and fixed through its own Spec Kit cycle. Code touched by a change MUST be
  brought into compliance as part of that change.
- A Constitution Check violation MUST be justified in the plan's Complexity Tracking
  section, or the plan MUST be revised.
- Work happens on a dedicated branch (`feat/…`, `fix/…`, `chore/…`, `docs/…`) and reaches
  `main` through a pull request merged with a merge commit, only when all checks of
  Principle IV pass.
- Commit messages follow Conventional Commits (`feat(sites): …`).
- Any architecture change MUST update `DOCUMENTATION.md` in the same pull request.
- Deployment is never automatic: it happens only when the owner explicitly asks for it. An
  agent may prepare and run it, after confirming that `main` is green, building `dist/` and
  checking the built app, and only after the owner's final confirmation.

## Governance

- This constitution supersedes every other practice in the project. When another guide
  (such as `DOCUMENTATION.md`) contradicts it, that guide MUST be corrected.
- The project owner is the only person who approves amendments. An agent may propose an
  amendment but MUST NOT merge it without the owner's explicit approval.
- Every amendment is made through a pull request that edits this file, states the reason and
  bumps the version:
  - MAJOR: a principle is removed or redefined in an incompatible way;
  - MINOR: a principle or section is added, or guidance is materially expanded;
  - PATCH: clarification, wording, typo.
- Compliance is checked at every `/speckit-plan` and during review of every pull request.

**Version**: 1.0.0 | **Ratified**: 2026-09-29 | **Last Amended**: 2026-09-29
