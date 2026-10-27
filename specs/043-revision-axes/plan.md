# Implementation Plan: Axes de Révision Anti-Bachotage (`043-revision-axes`)

**Branch**: `043-revision-axes` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/043-revision-axes/spec.md`

## Summary

Ajouter un sous-menu dédié **« Axes de révision »** (`REVISION_AXES`) sous la section **Théorie**, complété par un raccourci depuis l'écran **Stats** (`STATS`). La fonctionnalité segmente les 777 questions Parapente en 21 sous-chapitres pédagogiques, diagnostique les priorités à partir des statistiques (`struggling`, `hesitant`, `due`, `unattempted`, `mastered`) et guide l'élève selon une méthode anti-bachotage en 3 étapes sur chaque carte d'axe :
1. **Lire le cours officiel aux pages exactes** (`courses/<file>.pdf#page=N`, pages vérifiées uniquement).
2. **Points clés à retenir** (synthèses conceptuelles extraites des explications sans l'énoncé QCM ni les choix A/B/C/D).
3. **Atelier ciblé de 5 à 8 questions** (mélangeant les questions fragiles/à revoir et 1 à 2 questions de consolidation du même axe, avec brassage des réponses).

## Technical Context

**Language/Version**: JavaScript ES2022 (`"type": "module"`), HTML5, CSS3 (Tailwind + styles applicatifs).
**Primary Dependencies**: Modules existants (`js/services/quiz_service.js`, `js/services/mastery.js`, `js/services/review_scheduler.js`, `js/data/courses_data.js`, `js/utils/sanitize.js`, `js/i18n/fr.js`). Aucune nouvelle dépendance npm.
**Storage**: Lecture seule de `parapente_quiz_stats` (`Storage.getJSON(STORAGE_KEYS.QUIZ_STATS)`) ; écriture standard des statistiques de session QCM lors de l'atelier ciblé.
**Testing**: Vitest (`npm test` — unitaires + garde-fous d'architecture) et Playwright (`tests/e2e/revision_axes.spec.js`).
**Target Platform**: PWA offline-first (navigateurs modernes desktop et mobile).
**Constraints**: Respect absolu des 7 principes de `.specify/memory/constitution.md` (i18n exhaustif + `sync:functions`, `escapeHTML`, liens de cours vérifiés uniquement, précachage `sw.js`, unicité de propriétaire `data-action`, accessibilité clavier, tests d'abord).

## Constitution Check

- **Principe I — Catalogue Français Unique (`js/i18n/fr.js` & `fr_html.js`)** : Toutes les chaînes dynamiques seront ajoutées sous `FR.quiz.axes` dans `js/i18n/fr.js` et synchronisées vers `functions/shared/fr.mjs` via `npm run sync:functions`. Toutes les chaînes statiques de `index.html` porteront `data-i18n` et seront déclarées dans `js/i18n/fr_html.js`.
- **Principe II — XSS & Construction DOM Sûre** : Toutes les valeurs interpolées dans `js/views/quiz_axes_html.js` passeront par `escapeHTML` ; les URLs de cours seront validées via `isSafeUrl`.
- **Principe III — Exactitude des Contenus Pédagogiques** : `js/services/revision_axes.js` n'utilise que les associations vérifiées (`q.courseId` + `Number.isInteger(q.coursePage) && q.coursePage > 0` issues de `verifiedPage` dans `question_course_mapping.json`). Aucune page non vérifiée n'est affichée.
- **Principe IV — Discipline Offline-First & Service Worker** : `./js/services/revision_axes.js` et `./js/views/quiz_axes_html.js` seront inscrits dans `CRITICAL_ASSETS` de `sw.js`.
- **Principe V — Câblage Explicite des Actions & Accessibilité** :
  - `navigate` (déjà dans `main.js`) pour l'onglet `#theory-sub-bar`.
  - `QuizsetAxesFilter`, `QuiztoggleAxisTakeaways`, `QuizstartAxisWorkshop`, `QuizshowRevisionAxes` déclarés exclusivement dans `QuizView.handleClick` (`js/views/quiz.js`).
  - Utilisation d'éléments `<button type="button">` natifs pour toutes les actions interactives.
- **Principe VI — Qualité, Typage & Garde-Fous** : Annotations JSDoc `// @ts-check` compatibles sur `js/services/revision_axes.js` et `js/views/quiz_axes_html.js`.
- **Principe VII — Approche Test-First** : Écriture préalable de `tests/services/revision_axes.test.js` et `tests/views/quiz_axes.test.js`.

## Project Structure

### Documentation (this feature)

```text
specs/043-revision-axes/
├── spec.md              # Spécification fonctionnelle et critères d'acceptation
├── plan.md              # Plan d'architecture et vérification constitutionnelle
├── data-model.md        # Modèle de données des axes, lectures et ateliers
├── contracts/
│   └── ui.md            # Contrat DOM, routes, actions et clés i18n
└── tasks.md             # Découpage séquentiel des tâches (Test-First)
```

### Source Code (repository root)

```text
index.html                              # Bouton sous-menu REVISION_AXES + #revision-axes-screen
sw.js                                   # Ajout de revision_axes.js et quiz_axes_html.js à CRITICAL_ASSETS
js/
├── core/
│   ├── main.js                         # Enregistrement AppRouter.register('REVISION_AXES', quizModule)
│   └── ui_manager.js                   # Ajout de 'REVISION_AXES' aux modes activant l'onglet Théorie
├── i18n/
│   ├── fr.js                           # Clés FR.quiz.axes.* et FR.common.axesDeRevision
│   └── fr_html.js                      # Clés statiques index.html pour #revision-axes-screen
├── services/
│   └── revision_axes.js                # Service pur : taxonomie des 21 axes, diagnostic, cours PDF, points clés, sélection d'atelier
└── views/
    ├── quiz.js                         # Route REVISION_AXES, mount/unmount, actions handleClick, lancement atelier
    ├── quiz_stats.js                   # Méthodes showRevisionAxesScreen(), renderRevisionAxes(), setAxesFilter(), toggleAxisTakeaways(), startAxisWorkshop()
    ├── quiz_stats_html.js              # Bouton raccourci « Explorer mes axes de révision » dans l'écran Stats
    └── quiz_axes_html.js               # Templates HTML purs des cartes d'axes (Étapes 1, 2, 3) et bandeaux de synthèse
tests/
├── core/
│   └── route_code_splitting.test.js    # Autoriser REVISION_AXES sur quizModule
├── views/
│   ├── inline_strings.test.js          # Inclure js/views/quiz_axes_html.js et js/services/revision_axes.js
│   └── quiz_axes.test.js               # Tests unitaires du rendu et des interactions de la vue Axes de révision
├── services/
│   └── revision_axes.test.js           # Tests unitaires complets du service revision_axes.js (couverture des 777 questions incluse)
└── e2e/
    └── revision_axes.spec.js           # Test E2E Playwright du parcours complet
```
