# Feature Specification: Manual Full Audit Against the Code

**Feature Branch**: `docs/058-manual-full-audit`

**Created**: 2026-11-22

**Status**: Draft

**Input**: Owner: « vérifie tout le mode d'emploi en détail, et fais les modif github et discord en cas de besoin ». Spec 053 checked the manual mostly against pull request descriptions and missed three QCM errors (spec 055); this pass checks every claim against the code.

## Context: what the code shows (2026-11-22, `origin/main` after PR 329)

| Tab | Manual says | Code shows | Evidence |
|---|---|---|---|
| Général | Local data include « vos sites favoris » (public text) | Flying sites and favourites are owner-only | `data-requires-role="owner"` on the sites screen |
| Général | Public synced prefs include « vos réglages de recherche de sites (rayon GPS) » | Without a role, only level and theme are synced as preferences | `firebase_service.js` preferences merge (`pilotLevel`, `themeMode`) |
| Général | Cloud data can be deleted « depuis l'Espace Synchro » | No button deletes the account or its cloud data; only the ICE online copy can be deleted | `firebase_service.js`, `fr.js` `account.*` |
| Matériel | Public sync covers « rayon GPS, tri des sites » | Same as above | idem |
| QCM | Exam only for BI, BP, BPC | Also for « Tous les niveaux » (30 questions from the whole base, BI quotas); only Treuil has none | `isExamModeAvailable`, `getExamQuotas` |
| QCM | Keyboard « A à D (ou 1 à 4) » | A to F (or 1 to 6) | `quiz.js` `handleKeydown` |
| QCM | Voice answers by letters only | With the microphone on, the app reads the question then each answer and waits for « oui » or « non », then asks to confirm; letters and commands still work; the feature is marked experimental | `quiz_voice_ui.js`, `quiz.voice.*` |
| QCM | Axis workshop « de 5 à 8 questions » | 6 questions per axis workshop (fewer if the chapter has fewer); anti-trap workshop up to 8, completed to 5 | `startAxisWorkshop`, `startTrapsWorkshop` |
| Bibliothèque | Buttons « Par catégorie », « Par niveau » or « A-Z » | Two buttons: « A-Z » and « Par catégorie » | `index.html` `#sort-TITLE`, `#sort-CATEGORY` |
| Bibliothèque | In a regular browser the PDF opens in a new tab | Every course PDF opens in the built-in viewer, installed app or browser tab | `js/core/course_link.js` |
| Statistiques | Question list sorted by rate, attempts, last answer date or code | Also by streak and by exam appearances | `fr.js` `stats.sortBy*` |

Everything else was checked and still matches (About, level and theme, install, feedback, Discord, logbook including flight types, take-off techniques, approaches, 120 m site match, 3 h session window, PDF export, equipment periodicity and thresholds, Safety and ICE, Révision and Perfectionnement, owner Sites and beta scoring).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Every statement of the manual matches the app (Priority: P1)

**Independent Test**: each row of the table above reads as the « Code shows » column, for the roles that see it; the old wordings are gone.

**Acceptance Scenarios**:

1. **Given** a user without a role, **When** they read Général and Matériel, **Then** no sentence mentions favourites, GPS radius or site sorting.
2. **Given** any user, **When** they look for how to delete their online data, **Then** the manual says to ask the publisher through the feedback form, not a button that does not exist.
3. **Given** any user, **When** they read QCM, Bibliothèque and Statistiques, **Then** the exam levels, keyboard keys, voice flow, workshop sizes, sort buttons, viewer and sort options match the app.

## Requirements *(mandatory)*

- **FR-001**: Each « Manual says » statement above MUST be replaced by the « Code shows » fact, in the HTML and the catalogue (identical text).
- **FR-002**: Public text MUST NOT mention owner-only sites, favourites, GPS radius or site sorting.
- **FR-003**: The Discord guide (public parts) MUST be corrected the same way.

## Success Criteria *(mandatory)*

- **SC-001**: 0 occurrences of the old wordings for every role (tested).
- **SC-002**: The 053 audit file records every corrected row with its evidence.

## User Manual Impact *(mandatory)*

- **Sections checked**: all ten tabs, every claim against the code.
- **Updates required**: the eleven rows above.
- **Outdated content found nearby**: there is no way for a user to delete their cloud data or account in the app (only by asking the publisher); a product gap reported to the owner, not fixed here.
- **Discord guide (`#guide-utilisation`)**: cards « 5. QCM & théorie » (voice), « 6. Bibliothèque » (sort, viewer).

## Release Announcement *(mandatory)*

- **Availability**: All users.
- **Discord notice**: None: corrections of the manual, no new feature.

## Assumptions

- The reference is `origin/main` after PR 329.
