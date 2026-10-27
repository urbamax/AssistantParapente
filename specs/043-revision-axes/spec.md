# Feature Specification: Axes de Révision Anti-Bachotage (`043-revision-axes`)

**Feature Branch**: `043-revision-axes`
**Created**: 2026-10-27
**Status**: Approved
**Input**: User request: *"Via les statistiques du qcm, j'aimerai que l'app nous propose des axes de revision. Reflechis a une bonne maniere de reviser sans faire de bachotage pur. Je pense que 'Axe de révision' devrait etre carrement un sous menu de QCM. 1 axe de revision, 2 tout. Tu connais spec kit ? Tu vas etudier exactement avec quelle precision Claude implemente des choses et tu vas implementer tout ca en local."*

## Context & Pedagogical Problem

Les statistiques actuelles du QCM (`STATS`) affichent la maîtrise par grand thème (Météo, Mécavol, Pilotage, Matériel, Réglementation, Facteurs humains, Milieu naturel) et un bouton « Réviser mes points faibles ». Cependant :
1. **Un thème entier est trop vaste** : dire à un élève qu'il est à 54 % en Météo (110 questions) ou en Pilotage (188 questions) ne lui indique pas *quel chapitre précis* travailler (ex. *Brises, effets de relief & fœhn* vs *Nuages & masses d'air*).
2. **Enchaîner des QCM d'erreurs encourage le bachotage pur** : relancer en boucle les questions ratées pousse le pilote à mémoriser visuellement la position de la bonne réponse (A/B/C/D) plutôt qu'à comprendre le phénomène physique ou réglementaire sous-jacent.

La fonctionnalité **Axes de révision** (`REVISION_AXES`) transforme le diagnostic statistique du QCM en un **parcours d'étude structuré en 3 étapes par sous-chapitre (axe)** :
1. **Étape 1 — Lire le cours officiel ciblé** : liens directs vers les manuels PDF FFVL/EFVL et les numéros de pages exacts (`courses/<fichier>.pdf#page=N`) correspondant aux notions de l'axe (uniquement à partir des associations vérifiées `verifiedPage`, conformément au Principe III de la Constitution).
2. **Étape 2 — Points clés à retenir (sans QCM)** : accordéon dépliable regroupant les explications pédagogiques des notions de l'axe où le pilote bute ou hésite, **sans afficher l'énoncé du QCM ni les choix A/B/C/D** pour empêcher toute mémorisation visuelle.
3. **Étape 3 — Atelier ciblé de vérification (5 à 8 questions)** : lancement d'une courte session d'entraînement sur l'axe qui mélange les questions fragiles/à revoir avec 1 à 2 questions déjà acquises du même axe (pour éviter la réponse par élimination) et brasse l'ordre des choix.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Accéder au sous-menu « Axes de révision » et diagnostiquer ses priorités par chapitre (Priority: P1)

Depuis la barre de sous-navigation **Théorie** (`#theory-sub-bar`) ou depuis un bouton de raccourci dans **Stats** (`#stats-screen`), le pilote ouvre l'écran **Axes de révision** (`REVISION_AXES`).
Il visualise les sous-chapitres officiels correspondant à son niveau sélectionné (`BI`, `BP`, `BPC`, `TREUIL`, `ALL`), classés par priorité pédagogique :
- **Priorité 1 — Points de blocage & hésitations (`BLOCKER`)** : chapitres où des questions tentées sont en échec (`mastery < 0.5` ou série `streak === 0` après plusieurs essais) ou hésitantes (`0.5 <= mastery < 0.85`).
- **Priorité 2 — Acquis à rafraîchir (`REFRESH`)** : chapitres maîtrisés dont certaines questions arrivent à échéance de répétition espacée (`isDue`).
- **Priorité 3 — Chapitres à découvrir (`EXPLORE`)** : chapitres comportant encore des questions jamais tentées.
- **Maîtrisé (`MASTERED`)** : chapitres acquis et à jour (`masteryPct >= 85%`, aucun blocage ni révision échue).

Le pilote peut filtrer les axes par statut (`ALL`, `BLOCKER`, `REFRESH`, `EXPLORE`, `MASTERED`).

**Independent Test**: Naviguer vers `REVISION_AXES` avec un profil contenant des réponses en échec sur `A78`–`A110` (Brises & aérologie) et des réponses échues sur `E30`–`E65` (Polaire & finesse) ; vérifier le tri par priorité, les compteurs de résumé et le filtrage par statut.

**Acceptance Scenarios**:

1. **Given** l'utilisateur est sur n'importe quel écran de la section Théorie (`QCM`, `LIBRARY`, `STATS`), **When** il clique sur l'onglet « Axes de révision » dans `#theory-sub-bar`, **Then** le routeur active le mode `REVISION_AXES`, affiche `#revision-axes-screen` et met en surbrillance le bouton « Axes de révision ».
2. **Given** l'utilisateur change de niveau dans l'en-tête (`BI` → `BP` → `TREUIL`), **When** `#revision-axes-screen` est actif, **Then** la liste des axes et leurs métriques sont recalculées immédiatement pour les questions du niveau sélectionné.
3. **Given** l'utilisateur clique sur un filtre de statut (`BLOCKER`, `REFRESH`, `EXPLORE`, `MASTERED`, `ALL`), **When** le rendu se met à jour, **Then** seuls les axes correspondant au filtre sélectionné sont affichés.

---

### User Story 2 — Étudier un axe sans bachotage : Cours PDF aux pages exactes + Points clés à retenir (Priority: P1)

Sur chaque carte d'axe de révision, le pilote dispose de deux outils d'étude conceptuelle avant même de refaire un QCM :
1. **Étape 1 — Lire le cours officiel** : la carte affiche le ou les manuels PDF de référence associés aux questions de l'axe (prioritairement les questions fragiles/hésitantes/à revoir, puis l'ensemble de l'axe), avec les plages de pages vérifiées (ex. `p. 18–20`) et des boutons/puces cliquables ouvrant directement `courses/<fichier>.pdf#page=N`.
2. **Étape 2 — Points clés à retenir** : un bouton permet de déplier/replier les fiches de synthèse extraites des explications pédagogiques (`explication`) des notions à travailler dans cet axe, nettoyées de toute mention technique (`Aucune source trouvée...`) et **sans jamais afficher les choix A/B/C/D ni la lettre de réponse**.

**Independent Test**: Afficher un axe ayant des questions en échec dotées d'explications et de `coursePage` vérifiées ; vérifier que les liens PDF pointent vers `#page=N` et que le panneau « Points clés à retenir » affiche les explications conceptuelles avec leur lien de page mais aucun choix de réponse QCM.

**Acceptance Scenarios**:

1. **Given** un axe contenant des questions avec `courseId` et `coursePage` vérifiés, **When** la carte de l'axe est rendue, **Then** la section « Étape 1 — Lire le cours officiel » affiche chaque manuel avec ses plages de pages compactées et des liens directs `href="courses/...#page=N"`.
2. **Given** une question dont le mapping dans `question_course_mapping.json` n'a pas de `verifiedPage` entier positif, **When** l'axe est construit, **Then** aucune page non vérifiée n'est exposée (respect strict du Principe III de la Constitution).
3. **Given** l'utilisateur clique sur « Voir les points clés à retenir » d'un axe, **When** l'accordéon s'ouvre, **Then** les explications pédagogiques des notions ciblées s'affichent sous forme de liste de synthèses conceptuelles sans énoncé QCM ni options A/B/C/D.

---

### User Story 3 — Lancer un Atelier ciblé (5 à 8 questions) sur un axe (Priority: P1)

Après avoir relu le cours et les points clés, le pilote clique sur le bouton **« Vérifier ma compréhension »** (Étape 3) de la carte d'un axe.
L'application lance une session QCM courte (5 à 8 questions) en mode entraînement sur cet axe :
- Sélectionne en priorité les questions en blocage (`struggling`), hésitantes (`hesitant`) et à rafraîchir (`due`) — ou non vues (`unattempted`) si le chapitre est en découverte.
- Ajoute jusqu'à 2 questions déjà maîtrisées du même axe (consolidation) pour éviter que le pilote ne réponde par élimination sur les seules questions qu'il sait avoir ratées.
- Mélange l'ordre des questions et l'ordre des propositions de réponse.
- En fin d'atelier, un bouton permet de revenir directement aux **Axes de révision** (`REVISION_AXES`) avec les statistiques et priorités mises à jour.

**Independent Test**: Cliquer sur « Vérifier ma compréhension » sur un axe donné ; vérifier que la session QCM démarre avec 5 à 8 questions appartenant toutes à cet axe, et que l'écran de fin de QCM permet de revenir aux Axes de révision.

**Acceptance Scenarios**:

1. **Given** un axe comportant 15 questions dont 4 en blocage et 11 maîtrisées, **When** l'utilisateur clique sur l'action `QuizstartAxisWorkshop` pour cet axe, **Then** une session QCM de 6 questions (les 4 en blocage + 2 de consolidation du même axe) démarre en mode entraînement.
2. **Given** une session lancée depuis un axe de révision est terminée, **When** l'écran de résultats s'affiche ou que le pilote clique sur « Retour aux axes de révision », **Then** les statistiques enregistrées mettent à jour la maîtrise et le statut de l'axe dans `REVISION_AXES`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La barre de sous-navigation `#theory-sub-bar` dans `index.html` DOIT comporter un bouton « Axes de révision » (`data-target="REVISION_AXES" data-action="navigate" data-args="REVISION_AXES"`).
- **FR-002**: Le routeur (`js/core/main.js`) et le gestionnaire d'interface (`js/core/ui_manager.js`) DOIVENT supporter la route `REVISION_AXES` rattachée au module `quizModule` et maintenir l'onglet principal **Théorie** actif.
- **FR-003**: Le service `js/services/revision_axes.js` DOIT découper les 777 questions Parapente en 21 sous-chapitres (axes) pédagogiques couvrant les 7 thèmes FFVL (Météo, Mécavol, Matériel, Réglementation, Pilotage, Facteurs humains, Milieu naturel) et filtrer automatiquement les axes selon le niveau actif (`BI`, `BP`, `BPC`, `TREUIL`, `ALL`).
- **FR-004**: Chaque axe DOIT calculer ses indicateurs (`totalQuestions`, `attemptedCount`, `masteryPct`, `strugglingCount`, `hesitantCount`, `dueCount`, `unattemptedCount`, `masteredCount`) et déterminer son statut de priorité (`BLOCKER`, `REFRESH`, `EXPLORE`, `MASTERED`).
- **FR-005**: Chaque axe DOIT agréger les lectures de cours vérifiées (`courseReadings`) avec plages de pages compactes (ex. `p. 12–15, 22`) et liens directs `courses/<file>.pdf#page=N`, en ignorant toute entrée non vérifiée.
- **FR-006**: Chaque axe DOIT extraire une liste de synthèses conceptuelles (`takeaways`) à partir des explications des questions de l'axe (en priorisant `struggling`, `hesitant`, `due`), purgée des lignes parasites (`Aucune source trouvée...`) et dépourvue des propositions de réponse QCM.
- **FR-007**: L'action `QuizstartAxisWorkshop` DOIT construire une sélection équilibrée de 5 à 8 questions de l'axe (via `pickWorkshopQuestions`) et démarrer une session QCM d'entraînement avec retour direct possible vers `REVISION_AXES`.
- **FR-008**: L'écran `#stats-screen` DOIT proposer un bouton d'accès rapide permettant d'ouvrir `REVISION_AXES`.
- **FR-009**: Tous les textes visibles DOIVENT provenir de `js/i18n/fr.js` (`FR.quiz.axes`) et `js/i18n/fr_html.js`, synchronisés avec `functions/shared/fr.mjs` via `npm run sync:functions`.

## Success Criteria *(mandatory)*

- **SC-001**: 100 % des 777 questions Parapente sont rattachées à un axe pédagogique explicite dans `js/services/revision_axes.js` (0 question orpheline, vérifié par test unitaire sur `qcm_ffvl.csv`).
- **SC-002**: 0 chaîne de caractères en dur dans `js/views/quiz*.js` et `js/services/revision_axes.js` (`tests/views/inline_strings.test.js` et `tests/views/static_texts.test.js` passent à 100 %).
- **SC-003**: Tous les tests de garde-fous (`sw_precache`, `action_wiring`, `keyboard_access`, `icons_exist`, `route_code_splitting`, `shared_copy`, `quiz_render`) ainsi que les nouveaux tests unitaires et E2E passent sans régression.
