# Feature Specification: Question-Trap Box in the Quiz Correction

**Feature Branch**: `feat/061-quiz-trap-box`

**Created**: 2026-11-22

**Status**: Draft

**Input**: Owner: « Ce serait intéressant de déceler les pièges dans l'énoncé aussi », then chose « Les deux » (fix the explanations, then show a box on screen), « Après la réponse » and a neutral register.

## Clarifications

### Session 2026-11-22

- Q: When is the box shown? → A: After the answer only (owner).
- Q: Register of the sentences? → A: Neutral, no address to the learner (owner).
- Q: Title of the box? → A: « À lire de près » (owner had no preference; recommended option).

### Session 2026-11-22 (after release)

- Owner: « la partie À lire de près n'est jamais très claire et n'explique pas comment éviter le piège d'énoncé ». The sentences only named the trap (« « Toujours » tombe dès qu'un seul cas contraire existe », « Deux choix ne diffèrent que d'un mot : … »), which the learner had just seen. → A: rewrite all sentences so each names the trap **and** shows how to settle it on this question (owner chose the full rewrite over a generic reflex line). FR-006 amended accordingly; the rewrite plan is in `rewrite-plan.md`.
- Owner (2026-11-23): « on doit afficher les pièges d'énoncé que quand on s'est trompé sur la question ». → A: the box shows only after a wrong or incomplete answer. FR-001 amended.

## Context

Audit 6 read the 775 quiz questions (FFVL QCM, hang-gliding codes H, R, X excluded) and found, for 567 of them, 694 traps: the word of the statement or of a choice that decides the points and that a hurried learner misreads (an absolute word such as « jamais », two choices that differ by one word, « transitoirement », a time of day, a reversed ratio, a true fact that does not answer the question…). Phase 1 (PRs 333–350) made the option lines name these traps. For each trap the audit also wrote one short sentence meant for the learner. This feature shows those sentences in the correction.

The word « piège » already has another meaning in the app: the errors workshop (« Atelier pièges & oublis ») and the « Piège récurrent » banner name the choices a given learner keeps getting wrong. The new box is about the question itself, the same for everyone.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the question's trap after answering (Priority: P1)

A learner answers a question in training mode. In the correction, above the explanations of the choices, a short box names what makes the question tricky, e.g. « Deux choix ne diffèrent que d'un mot : « au vent » ou « sous le vent » du relief. » The learner learns to read the statement and the choices more carefully next time.

**Why this priority**: it is the whole point of the feature and works alone.

**Independent Test**: answer a question that has a trap in training mode: the box appears in the correction with its sentence(s); answer a question without a trap: no box.

**Acceptance Scenarios**:

1. **Given** a question with one trap, **When** the learner submits an answer in training mode, **Then** the correction shows one box, titled « À lire de près », with the trap's sentence, above the choice explanations.
2. **Given** a question with two or three traps, **When** the correction is shown, **Then** the box lists each sentence, in the order of the data.
3. **Given** a question with no trap, **When** the correction is shown, **Then** no box and no empty space appear.
4. **Given** a question being displayed, **When** the learner has not answered yet, **Then** no trap sentence is visible or readable on the page (not hidden in the page either).

---

### User Story 2 - Same box in the other places that show a correction (Priority: P2)

The same box appears wherever the app shows the correction of an answered question: revision mode, the perfecting mode, the review of an exam once it is finished, the question bank when an item is opened, and the statistics' error review and detailed list.

**Why this priority**: consistency; the learner meets the trap again where they review.

**Independent Test**: finish a mock exam, open its review: each corrected question with a trap shows the box; during the exam, no box anywhere.

**Acceptance Scenarios**:

1. **Given** a mock exam in progress, **When** the learner moves through the questions, **Then** no trap box is ever shown.
2. **Given** a finished mock exam, **When** the learner opens the review of a question with a trap, **Then** the box is shown above its explanations.
3. **Given** the question bank, **When** the learner opens the explanations of a question with a trap, **Then** the box is shown with them.

### Edge Cases

- A question code present in the trap data but absent from the quiz (or the reverse): no box, no error.
- Trap data fails to load (offline first visit, corrupt file): the correction shows as today, without the box, and nothing else breaks.
- Text read aloud (« Lecture auto »): the box is not read before the answer; reading it after the answer follows the existing rule for explanations.
- Very narrow screens: the box wraps without horizontal scrolling.
- The recurring-trap banner and the new box on the same question: both may appear; they must be visually distinct (FR-002).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: After an answer is submitted (and only then), the correction of a question MUST show one box listing the trap sentence(s) of that question, above the choice explanations, in every view that shows an answered question's correction: training, revision and perfecting modes, the review of a finished mock exam, the question bank, and the statistics' error review and detailed question list. The errors workshop and revision axes, which show one choice's line per item, are out of scope.
- **FR-001a** (amended 2026-11-23): The box MUST be shown only when the learner got the question wrong (wrong or incomplete answer). In the immediate correction, the end-of-series review and the exam reviews, that is the answer being corrected. In the question bank and the statistics' detailed list, which show no answer, the box MUST be shown only when the last recorded answer to the question was wrong (its streak of right answers is 0 after at least one attempt).
- **FR-002**: The box MUST be titled « À lire de près », distinct from the existing « Piège récurrent » banner and the « pièges » of the errors workshop (owner had no preference; recommended title kept).
- **FR-003**: The box MUST NOT be shown, nor its text be present in the page, before the answer or at any time during a mock exam in progress.
- **FR-004**: Questions without a trap MUST show no box.
- **FR-005**: The trap sentences MUST be stored in a quiz data file keyed by question code, separate from the explanations file and from the official question file (which stays untouched), with 1 to 3 sentences per question.
- **FR-006** (amended 2026-11-22): Every sentence MUST name what makes the question tricky **and** how to settle it on this very question (the reading reflex applied to it: the counter-example that defeats an absolute word, the clue that separates two choices differing by one word, what the statement actually asks…). Since the box is shown only after the answer, a sentence MAY state the decisive fact, but MUST NOT copy the choice explanations. Every sentence MUST be neutral (no « tu », no « vous », no imperative; infinitives such as « pour trancher, … » are allowed), contain no verdict word (juste, faux, fausse, vrai, correct, exact, inexact, bonne réponse, à tort, piège), end with a period and stay under 240 characters; a data test MUST enforce these rules and that every key is an existing question code.
- **FR-007**: The box MUST be readable in light and dark themes and on phones, and MUST be announced to screen readers as a note attached to the correction.
- **FR-008**: The box MUST be available to all users (no role).

### Key Entities

- **Question trap**: a question code and an ordered list of 1 to 3 sentences, each describing one trap without giving the answer. Produced by audit 6, reviewed before shipping.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 567 questions show a box after the answer; the 208 others show none.
- **SC-002**: 0 trap sentences reachable on the page before an answer or during a mock exam (checked by an end-to-end test).
- **SC-003**: 100 % of sentences pass the data test of FR-006.
- **SC-004**: the correction appears as fast as today (no visible delay added by the box).

## User Manual Impact *(mandatory)*

- **Sections checked**: Théorie > Entraînement aux QCM officiels: « 1. Les Quatre Modes d'Apprentissage » (Mode Entraînement paragraph, which describes the correction and the « Piège récurrent » banner), « 4. La Banque de Questions ».
- **Updates required**: in the Mode Entraînement paragraph, add one sentence describing the new box (shown after answering, names what makes the question tricky, distinct from the recurring-trap banner); in « 4. La Banque de Questions », mention that the box appears with the explanations.
- **Outdated content found nearby**: None noticed.
- **Discord guide (`#guide-utilisation`)**: mirror the same sentence in the QCM part of the guide.

## Release Announcement *(mandatory)*

- **Availability**: All users.
- **Discord notice (French, for pilots)**: « Nouveau dans le QCM : après chaque réponse, un encart « À lire de près » signale le mot de l'énoncé ou des propositions qui fait basculer la réponse (un « jamais », deux propositions qui ne diffèrent que d'un mot…). De quoi apprendre à lire les questions de l'examen sans se faire piéger. »

## Assumptions

- The sentences come from audit 6 and are harmonised (neutral register, no verdict) before shipping; the owner reviews a sample.
- The box is shown in every correction view listed in FR-001; if one of them cannot host it simply, the plan says so and that view is left out explicitly rather than silently.
- Read-aloud and voice answering keep their current behaviour; the box is not part of what is read before the answer.
- Hang-gliding questions (H, R, X) stay out of scope, as they are excluded from the quiz.
