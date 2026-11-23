# Feature Specification: « Vos pièges » in the Quiz Statistics

**Feature Branch**: `feat/064-trap-stats`

**Created**: 2026-11-23

**Status**: Draft

**Input**: Owner chose « Pièges dans les stats » after spec 063: classify the 694 traps by type and show in the statistics the types where the learner gets trapped most.

## Context

Audit 6 found 694 traps in 567 questions and, for each, the choices it touches (the ones a learner who misses the trap gets wrong). Spec 061 shows one sentence per trap after an answer; spec 063 lets the learner train on trap questions. The answer log already keeps, per question, which choices were ticked at each attempt. Nothing yet tells the learner which *kind* of trap catches them: absolute words, two choices one word apart, the frame set by the statement…

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See which kinds of traps catch me (Priority: P1)

On the statistics page, a « Vos pièges » section lists the trap types the learner has met, sorted by how often they fell into them: for each type, its name, a one-line description of how it works, the number of times the learner fell into it out of the times they met it, and a short bar.

**Why this priority**: it is the feature; it turns 694 individual traps into a handful of habits to fix.

**Independent Test**: with an answer history that ticked the wrong word in several « jamais / toujours » choices, the section shows « Mots absolus » first with the right counts.

**Acceptance Scenarios**:

1. **Given** a history where the learner answered trap questions, **When** the statistics open, **Then** the section lists each type met at least once, sorted by number of falls (then by rate), with « falls / encounters ».
2. **Given** a trap whose touched choices were all handled correctly in an answer, **When** counting, **Then** that answer is an encounter, not a fall.
3. **Given** no answer to any trap question (or statistics consent off), **When** the statistics open, **Then** the section shows a short sentence inviting to train, or is absent when statistics are off (as the rest of the page).

---

### User Story 2 - Train on one kind of trap (Priority: P2)

Each type line has a button « S'entraîner » that starts a training series of trap questions of that type only (spec 063 ordering: missed first, then never attempted, then the rest), with the usual number of questions.

**Why this priority**: closes the loop from diagnosis to practice.

**Independent Test**: click « S'entraîner » on « Choix à un mot près »: every question of the series has a trap of that type, and the « À lire de près » box shows after each answer.

**Acceptance Scenarios**:

1. **Given** the section, **When** the learner clicks « S'entraîner » on a type, **Then** a training series starts with only questions carrying a trap of that type, within the current level.
2. **Given** the series, **When** it runs, **Then** its label names the type (e.g. « QUESTIONS À PIÈGE · MOTS ABSOLUS »).

### Edge Cases

- A question with two traps of different types: an answer can count as a fall for one and an encounter only for the other.
- Old answer log entries (first log format) stay readable; entries whose choices cannot be mapped are ignored.
- Trap type data missing (offline first visit): the section is absent; the rest of the page is unchanged.
- Choices are shuffled during sessions: counting uses the choice positions of the official file (as the answer log already does).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each of the 694 traps MUST have exactly one type among: mots absolus, choix à un mot près, cadre de l'énoncé, relation inversée, vrai mais hors sujet, valeur et unité (and a rare « autre » not shown to learners), stored with the choices it touches, in a quiz data file separate from the official questions and from the « À lire de près » sentences.
- **FR-002**: For each answer in the learner's answer log to a trap question, and for each trap of that question, the answer MUST count as an encounter of the trap's type, and as a fall when a touched choice with negative points was ticked or a touched choice with positive points was left unticked.
- **FR-003**: The statistics page MUST show a « Vos pièges » section listing the types with at least one encounter, sorted by falls (descending) then fall rate, each with its name, a one-line description, « N chutes sur M », and a bar.
- **FR-004**: With no encounter, the section MUST show one sentence inviting to try the « Questions à piège » series; with statistics consent off, it follows the page (not shown).
- **FR-005**: Each listed type MUST offer « S'entraîner », starting a training series of trap questions of that type within the current level, ordered as in spec 063, with the number of questions chosen in the setup.
- **FR-006**: The section MUST respect the level filter of the statistics page (only questions of the selected level).
- **FR-007**: Available to all users, offline once data is cached; no data leaves the device beyond the existing statistics sync.

### Key Entities

- **Trap type record**: question code → list of { type, touched choice positions }, aligned with audit 6.
- **Answer log entry**: existing per-question list of [day, ticked-choices mask].

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 694 of 694 traps have a type; « autre » under 5 %.
- **SC-002**: For a test history, the counts match a hand count exactly.
- **SC-003**: « S'entraîner » on a type yields a series where 100 % of the questions have a trap of that type.
- **SC-004**: The statistics page opens as fast as today.

## User Manual Impact *(mandatory)*

- **Sections checked**: Théorie > statistics description in the manual (QCM part), « 5. Les Axes de Révision ».
- **Updates required**: describe the « Vos pièges » section and its « S'entraîner » buttons where the manual describes the statistics.
- **Outdated content found nearby**: to check during implementation.
- **Discord guide (`#guide-utilisation`)**: one sentence in the QCM card (statistics), measured against the 1,024-character field limit.

## Release Announcement *(mandatory)*

- **Availability**: All users.
- **Discord notice (French, for pilots)**: « Nouveau dans les statistiques du QCM : la section « Vos pièges » montre les sortes de pièges où vous tombez le plus (mots absolus, propositions à un mot près, cadre de l'énoncé…), avec un bouton pour vous entraîner sur chacune. »

## Assumptions

- Types come from a one-off classification of audit 6's traps (element, location, touched choices, reason), reviewed on a sample before shipping.
- The sentence rewrite under way for spec 061 does not change which choices a trap touches; the type file is independent of the sentences.
- The type names and descriptions are short catalogue strings, neutral, without verdict words.
