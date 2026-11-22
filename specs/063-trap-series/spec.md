# Feature Specification: Trap-Question Series in Training Mode

**Feature Branch**: `feat/063-trap-series`

**Created**: 2026-11-22

**Status**: Draft

**Input**: Owner chose « Série « Questions à piège » » among the follow-ups of spec 061: in training mode, a series that draws first the questions that carry a trap (567 of 775), starting with those the learner already got wrong, with the « À lire de près » box after each answer.

## Context

Spec 061 added, for 567 paragliding questions, one to three sentences that name what makes the question tricky (an absolute word, two choices one word apart, « transitoirement »…), shown in the « À lire de près » box after an answer. Training mode today draws questions at random within the chosen level and theme. Learners have no way to train specifically on these tricky questions, although the official exam is full of them.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Train on tricky questions only (Priority: P1)

In the QCM setup, with Training mode selected, the learner turns on « Questions à piège ». The series then contains only questions that have at least one trap sentence, within the chosen level and theme, up to the chosen number of questions. After each answer the « À lire de près » box shows, as in spec 061.

**Why this priority**: it is the feature; it works alone.

**Independent Test**: turn the option on, start a 10-question training series: all 10 questions have a trap box after the answer; turn it off: the series is drawn as before.

**Acceptance Scenarios**:

1. **Given** Training mode and the option on, **When** the learner starts a series, **Then** every question of the series is one with trap sentences, within the selected level and theme.
2. **Given** the option on and a level/theme with fewer trap questions than the chosen number, **When** the series starts, **Then** it contains all the available trap questions (no padding with other questions).
3. **Given** the option on and a level/theme with no trap question at all, **When** the learner tries to start, **Then** a short message says there is no tricky question for this choice and the series does not start.
4. **Given** the option off, **When** a series starts, **Then** the draw is exactly the current one.

---

### User Story 2 - Mistakes first (Priority: P2)

With the option on, the questions the learner has already got wrong come first, then the ones never attempted, then the others; within each group the order stays random.

**Why this priority**: it focuses the series on the traps the learner actually falls into.

**Independent Test**: with statistics where three trap questions were missed, a series with the option on starts with those three (in any order).

**Acceptance Scenarios**:

1. **Given** statistics where some trap questions were answered wrongly at least once and not yet answered right since, **When** a series starts with the option on, **Then** those questions come first.
2. **Given** a learner without statistics (or statistics consent off), **When** a series starts, **Then** the trap questions are drawn at random.

### Edge Cases

- Trap data not loaded (offline first visit, missing file): the option is shown disabled with a short explanation, or hidden; training without it works as today.
- Switching to Exam, Revision or Perfecting mode: the option is not offered there (exam conditions and the other modes' own ordering stay unchanged).
- The option is remembered for the next visit like the other setup choices (count, theme), if those are remembered; otherwise it starts off.
- Voice mode and read-aloud: unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In Training mode only, the QCM setup MUST offer an on/off option « Questions à piège » (off by default), placed with the other series filters.
- **FR-002**: With the option on, a training series MUST contain only questions that have trap sentences (spec 061 data), within the selected level and theme, up to the selected number; if fewer exist, all of them.
- **FR-003**: With the option on, the series MUST order questions in three groups: missed and not yet answered right since, never attempted, the rest; random order inside each group.
- **FR-004**: When no trap question matches the level and theme, starting MUST be refused with a short message, and nothing else changes.
- **FR-005**: With the option off, the draw MUST be identical to today's.
- **FR-006**: The option MUST NOT be offered in Exam, Revision or Perfecting modes, and MUST NOT change them.
- **FR-007**: The option MUST be available to all users and work offline once the quiz data and the trap data are cached.
- **FR-008**: The series' mode label MUST make the filter visible during the series (e.g. « ENTRAÎNEMENT · QUESTIONS À PIÈGE »).

### Key Entities

- **Trap question**: a quiz question with at least one trap sentence in the spec 061 data.
- **Question history**: the per-question statistics already kept (attempts, correct answers, current streak), used to tell missed questions from the others.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % of the questions of a series with the option on show the « À lire de près » box after the answer.
- **SC-002**: With missed trap questions in the history, they all come before any other question of the series (when the series is long enough to hold them).
- **SC-003**: With the option off, the existing tests of the training draw pass unchanged.
- **SC-004**: Starting a series stays as fast as today.

## User Manual Impact *(mandatory)*

- **Sections checked**: Théorie > Entraînement aux QCM officiels: « 1. Les Quatre Modes d'Apprentissage » (Mode Entraînement), « 2. Paramétrage Avancé » (count and theme filters).
- **Updates required**: in « 2. Paramétrage Avancé », describe the « Questions à piège » option (training only, tricky questions only, missed ones first, box after each answer).
- **Outdated content found nearby**: None noticed.
- **Discord guide (`#guide-utilisation`)**: add one sentence on the option to the « Quatre modes » field (Entraînement line) of the QCM card.

## Release Announcement *(mandatory)*

- **Availability**: All users.
- **Discord notice (French, for pilots)**: « Nouveau dans le QCM : en mode Entraînement, l'option « Questions à piège » lance une série faite uniquement des questions qui contiennent un piège (un « jamais », deux propositions à un mot près…), en commençant par celles où vous vous êtes déjà trompé. L'encart « À lire de près » explique le piège après chaque réponse. »

## Assumptions

- « Missed » means: at least one wrong answer recorded and current streak at 0 (not answered right since), using the statistics already kept; when statistics consent is off, there is no history and the order is random.
- The option is a filter of Training mode, not a fifth mode; the revision axes and the errors workshop are unchanged.
- The trap data of spec 061 is the only source of « trap question »; no new data is created.
