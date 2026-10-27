# Tasks: Axes de Révision Anti-Bachotage (`043-revision-axes`)

**Input**: Design documents from `/specs/043-revision-axes/`

## Phase 1: Service Domaine & Tests Unitaires (Test-First)

- [x] **T001** [P] Écrire les tests unitaires `tests/services/revision_axes.test.js` couvrant :
  - Le rattachement exhaustif des 777 questions Parapente de `js/data/qcm_ffvl.csv` aux 21 axes (0 question orpheline).
  - Le filtrage par niveau (`BI`, `BP`, `BPC`, `TREUIL`, `ALL`).
  - La classification des questions (`struggling`, `hesitant`, `due`, `unattempted`, `mastered`) et le statut/tri des axes (`BLOCKER`, `REFRESH`, `EXPLORE`, `MASTERED`).
  - L'agrégation des lectures de cours vérifiées (`courseReadings`), le formatage des plages de pages (`formatPageRanges`) et le rejet strict des pages non vérifiées.
  - L'extraction des `takeaways` (« Points clés à retenir ») sans choix QCM et avec nettoyage de la mention `Aucune source trouvée...`.
  - La sélection d'atelier `pickWorkshopQuestions` mélangeant points faibles et consolidation.
- [x] **T002** Implémenter `js/services/revision_axes.js` et inscrire `./js/services/revision_axes.js` dans `CRITICAL_ASSETS` de `sw.js`.
- [x] **T003** Exécuter `npx vitest run tests/services/revision_axes.test.js` et vérifier le passage à 100 %.

## Phase 2: Internationalisation (`fr.js`, `fr_html.js`, `sync:functions`)

- [x] **T004** Ajouter les chaînes UI de la fonctionnalité dans `js/i18n/fr.js` (`FR.common.axesDeRevision`, `FR.quiz.axes.*`) et dans `js/i18n/fr_html.js`.
- [x] **T005** Exécuter `npm run sync:functions` pour synchroniser `functions/shared/fr.mjs`.

## Phase 3: Squelette HTML, Routeur & Vue (`REVISION_AXES`)

- [x] **T006** [P] Écrire les tests unitaires de vue `tests/views/quiz_axes.test.js` vérifiant :
  - Le rendu du tableau de bord des axes de révision (`renderRevisionAxes`) avec bandeau pédagogique anti-bachotage, compteurs et filtres.
  - La présence des liens PDF vérifiés avec ancre `#page=N` (Étape 1).
  - L'ouverture/fermeture de l'accordéon « Points clés à retenir » (`QuiztoggleAxisTakeaways`) et l'absence de choix A/B/C/D (Étape 2).
  - Le filtrage par statut (`QuizsetAxesFilter`).
  - Le lancement d'un atelier ciblé (`QuizstartAxisWorkshop`) (Étape 3) et le bouton de retour aux axes en fin de QCM.
- [x] **T007** Mettre à jour `index.html` (bouton `#theory-sub-bar` + `#revision-axes-screen`), `js/core/ui_manager.js`, `js/core/main.js` et `tests/core/route_code_splitting.test.js`.
- [x] **T008** Implémenter `js/views/quiz_axes_html.js` (et l'inscrire dans `sw.js` ainsi que dans `tests/views/inline_strings.test.js`).
- [x] **T009** Étendre `js/views/quiz_stats.js`, `js/views/quiz_stats_html.js` et `js/views/quiz.js` pour supporter `REVISION_AXES`, le raccourci depuis `STATS`, et le retour à `REVISION_AXES` après un atelier ciblé.

## Phase 4: Tests E2E & Validation Finale

- [x] **T010** Créer le test E2E Playwright `tests/e2e/revision_axes.spec.js`.
- [x] **T011** Exécuter la suite complète de vérification (`npm run sync:functions`, `npm run format`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`).
