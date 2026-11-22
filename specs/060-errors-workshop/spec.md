# Feature Specification: Traps and Omissions Workshop Across All Chapters

**Feature Branch**: `feat/060-errors-workshop`

**Created**: 2026-11-22

**Status**: Draft

**Input**: Owner, looking at « Axes de révision » with many traps and omissions still « En consolidation » and some omissions « À corriger »: « J'ai plein de choses à revoir, pourtant le module ne me propose pas de revoir mes oublis etc. de manière générale. »

## Context: what the code shows (`origin/main` after PR 338)

| Point | Code | Effect |
|---|---|---|
| The cross-chapter box « N pièges actifs à corriger / Atelier anti-pièges » | shown only when `trapTotals.active > 0` (`quiz_axes_html.js`) | With every trap « En consolidation », the box disappears although there is plenty to review |
| Questions of the anti-trap workshop | `pickAntiTrapQuestions` reads `traps` only (`error_diagnostic.js`) | Omissions (right answers left unticked) are never replayed across chapters, active or not |
| Manual | « reprend jusqu'à 8 questions où vous êtes tombé plusieurs fois dans le même piège » | Wrong already: any unresolved trap counts, even picked once |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Review every unresolved error in one workshop (Priority: P1)

A pilot has traps and omissions « À corriger » or « En consolidation » spread over several chapters. At the top of « Axes de révision » they see how many remain and start one workshop that replays them, whatever the chapter.

**Independent Test**: with only consolidating traps, or only omissions, the box and its button are shown; the workshop contains the questions with an omission.

**Acceptance Scenarios**:

1. **Given** traps all « En consolidation » and no active one, **When** the pilot opens « Axes de révision », **Then** the box shows « À revoir : N pièges » and the button « Atelier pièges & oublis ».
2. **Given** only omissions (active or consolidating), **When** the screen opens, **Then** the box shows « À revoir : N oublis » and the button.
3. **Given** both, **Then** the box reads « À revoir : N pièges et M oublis ».
4. **Given** no unresolved trap or omission (none, or all « Surmonté »), **Then** the box is not shown.
5. **Given** the pilot starts the workshop, **Then** it holds up to 8 questions with an unresolved trap or omission: errors « À corriger » first (relapses, then the most frequent), then « En consolidation »; completed with questions of the same chapters up to 5 as before.

## Requirements *(mandatory)*

- **FR-001**: The cross-chapter box MUST be shown when the level holds at least one trap or omission whose status is « À corriger » or « En consolidation ».
- **FR-002**: Its title MUST give the counts of unresolved traps and omissions (one/many wording, a part omitted when zero).
- **FR-003**: `pickAntiTrapQuestions` MUST rank each question by its most urgent unresolved error, trap or omission, with the existing order (status, relapse, count, last day).
- **FR-004**: The workshop is renamed « Atelier pièges & oublis » (button, header label « ATELIER PIÈGES & OUBLIS »), including the button of the end-of-series traps card.
- **FR-005**: The screen MUST still never show a question or choice text.

## Success Criteria *(mandatory)*

- **SC-001**: Tests cover scenarios 1 to 5 (box rendering and picker).
- **SC-002**: The manual describes the workshop as implemented.

## User Manual Impact *(mandatory)*

- **Sections checked**: QCM tab, « Axes de révision » paragraph (HTML and `manualModal` catalogue).
- **Updates required**: the workshop sentence: name, traps and omissions, « À corriger » then « En consolidation », shown as soon as one remains.
- **Discord guide (`#guide-utilisation`)**: card « 5. QCM & théorie » if it names the anti-trap workshop.

## Release Announcement *(mandatory)*

- **Availability**: All users.
- **Discord notice**: « Axes de révision : l'atelier anti-pièges devient l'« Atelier pièges & oublis ». Il reprend aussi les bonnes réponses que vous avez oublié de cocher, et reste proposé tant qu'il reste des erreurs à corriger ou en consolidation, tous chapitres confondus. »

## Assumptions

- The 8-question cap and the completion to 5 are kept.
- The « Avec pièges actifs » filter is unchanged (it filters chapters, not the workshop).
