# Feature Specification: Revision Axes Page Clarity

**Feature Branch**: `feat/062-axes-page-clarity`

**Created**: 2026-11-22

**Status**: Draft

**Input**: Owner, on « Axes de révision »: « 52 et 37 mais 17 et 2+17+13+… Je ne comprends pas bien », then « Fais un audit complet de cette page pour la rendre plus compréhensible » and « Oui, A + B + C ».

## Audit (owner's stats export, level BP, `origin/main` after PR 354)

The page is about 21,600 px tall on a desktop (17 cards of 750 to 1,560 px, everything unfolded: 34 traps, 30 omissions, 63 course links).

| # | Finding | Lot |
|---|---|---|
| 1 | « consolider » means two things: chapter « Priorité 1 · Points à consolider » (failing) and error « En consolidation » (almost fixed) | A |
| 2 | One priority, two names: filter « Blocages & hésitations » / card « Points à consolider »; filter « À rafraîchir » / card « Acquis à rafraîchir » | A |
| 3 | The box counts errors, the filters count chapters without saying so, and the filters overlap (13 + 4 = 17, « En consolidation (17) » covers all) | A |
| 4 | A filter that selects every chapter is shown | A |
| 5 | « Avec pièges actifs » ignores omissions, « En consolidation » counts both | A |
| 6 | « Voir tous mes pièges (9) » includes the 5 overcome ones, the pill says 4 | A |
| 7 | « Maîtrise 99 % » in Priority 1, or in Priority 2 with no « à rafraîchir » pill: the reason for the priority is not shown | A |
| 8 | Blocage, hésitation, « À corriger », « En consolidation », « Surmonté », « Maîtrise » are explained nowhere on the page | A |
| 9 | The method box says the workshop has « 5 à 8 questions »; every card offers 6 | B |
| 10 | The method is 1 → 2 → 3 but traps and omissions come before step 1, and a card without key points jumps from step 1 to step 3 | B |
| 11 | « Prioritaire sur vos erreurs » sits on almost every manual of a card (4 out of 4) and no longer tells anything | B |
| 12 | Every card is unfolded: one must scroll a whole card to reach the next | C |
| 13 | Mastered chapters disappear without a word | C |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Understand the page at a glance (Priority: P1)

**Independent Test**: with the owner's data, every count on the page says what it counts, no word has two meanings, and the list shows one short line per chapter.

**Acceptance Scenarios**:

1. **Given** the page, **Then** priorities read « Priorité 1 · À retravailler », « Priorité 2 · À entretenir », « Priorité 3 · À découvrir », identical on filters and cards; « consolidation » only names error statuses.
2. **Given** the filters, **Then** they are in two labelled rows, « Chapitres » (Tous and the priorities, which split the chapters) and « Chapitres avec erreurs » (« À corriger », traps or omissions; « En consolidation »); a filter with 0 chapters or with every chapter is hidden unless selected.
3. **Given** the box, **Then** it reads « À revoir : 52 pièges et 37 oublis dans 17 chapitres ».
4. **Given** a card, **Then** a line says why it is in its priority (« Pourquoi Priorité 1 : 1 blocage, 11 hésitations. »).
5. **Given** a « Comment lire cette page » button, **When** opened, **Then** it defines the priorities, blocage, hésitation, the three error statuses and the mastery percentage.
6. **Given** a traps or omissions block with overcome items, **Then** the button reads « Voir tous mes pièges (9, dont 5 surmontés) ».

### User Story 2 - One method, in order (Priority: P1)

1. The method box says the workshop has 6 questions (fewer if the chapter has fewer).
2. In a card: Étape 1 Lire, Étape 2 Comprendre (my traps, my omissions, key points), Étape 3 Vérifier; numbering has no gap (no step 2 content → « Étape 2 — Vérifier »).
3. Only the first manual of a card, when it covers the pilot's errors, carries « À lire en premier ».

### User Story 3 - A short list (Priority: P1)

1. Cards are folded by default: category, priority, title, mastery bar, pills, reason, and an « Ouvrir » button; the body (steps) shows once opened, and stays open across re-renders.
2. Below the list: « 2 chapitres maîtrisés masqués : Facteurs humains, Milieu naturel. »

## Requirements *(mandatory)*

- **FR-001** to **FR-013**: one per audit row, as in the scenarios above. Error pills say « à corriger » instead of « actif(s) », the word of the error status and of the filter.
- **FR-014**: The page MUST still never show a question or choice text.

## Success Criteria *(mandatory)*

- **SC-001**: With the owner's data the folded page is under 5,000 px tall on a 1,280 px wide screen.
- **SC-002**: Tests cover each scenario.

## User Manual Impact *(mandatory)*

- **Sections checked**: QCM tab, « Axes de révision » paragraph.
- **Updates required**: new priority names, filters in two rows, folded cards, reason line, page guide, 6-question workshop.
- **Discord guide**: card « 5. QCM & théorie » if it names the priorities (it does not; checked).

## Release Announcement *(mandatory)*

- **Availability**: All users.
- **Discord notice**: « Axes de révision, plus lisible : les chapitres sont repliés en une ligne qui dit pourquoi ils sont dans leur priorité, les priorités s'appellent À retravailler, À entretenir et À découvrir, les filtres sont rangés en deux lignes (chapitres, erreurs), et un bouton « Comment lire cette page » explique chaque terme. »

## Assumptions

- Ranking rules (statuses, thresholds, workshop picks) are unchanged; only wording, order and layout change.
