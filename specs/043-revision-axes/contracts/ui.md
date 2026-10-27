# UI & Action Contract: Axes de Révision (`043-revision-axes`)

## 1. Navigation & Route (`REVISION_AXES`)

- **Sous-menu Théorie (`#theory-sub-bar` dans `index.html`)** :
  ```html
  <button
      class="sub-nav-item"
      data-target="REVISION_AXES"
      data-action="navigate"
      data-args="REVISION_AXES"
  >
      <i class="ri-compass-3-line"></i>
      <span data-i18n="common.axesDeRevision">Axes de révision</span>
  </button>
  ```
- **Écran conteneur (`index.html`)** :
  ```html
  <div id="revision-axes-screen" class="mode-screen">
      <div class="max-w-4xl mx-auto py-8 px-4">
          <div id="revision-axes-content"></div>
      </div>
  </div>
  ```
- **Raccourci depuis l'écran Statistiques (`#stats-screen` / `js/views/quiz_stats_html.js`)** :
  - Ajout d'un bouton `data-action="QuizshowRevisionAxes"` permettant de basculer directement vers `REVISION_AXES`.

## 2. Actions Déclaratives (`QuizView.handleClick`)

Toutes les actions spécifiques à `REVISION_AXES` sont gérées exclusivement dans `QuizView.handleClick` (`js/views/quiz.js`) :

| `data-action` | `data-args` | Comportement |
|---|---|---|
| `QuizshowRevisionAxes` | *(aucun)* | Navigue vers la route `REVISION_AXES` via `AppRouter.navigate('REVISION_AXES')` (ou affiche `#revision-axes-screen` en environnement de test sans routeur). |
| `QuizsetAxesFilter` | `'ALL' \| 'BLOCKER' \| 'REFRESH' \| 'EXPLORE' \| 'MASTERED'` | Met à jour `this._axesStatusFilter` et re-rend `#revision-axes-content`. |
| `QuiztoggleAxisTakeaways` | `<axisId>` | Bascule l'ouverture de l'accordéon « Points clés à retenir » pour `<axisId>` dans `this._expandedAxisTakeaways` et re-rend `#revision-axes-content`. |
| `QuizstartAxisWorkshop` | `<axisId>` | Sélectionne 5 à 8 questions de l'axe via `pickWorkshopQuestions`, mémorise `this._activeWorkshopAxisId = axisId`, et lance une session QCM d'entraînement ciblée. |

## 3. Structure DOM d'une Carte d'Axe (`js/views/quiz_axes_html.js`)

Chaque carte d'axe (`.revision-axis-card`, `data-axis-id="<axisId>"`, `data-axis-status="<status>"`) affiche :
1. **En-tête du chapitre** :
   - Badge de thème (`Météo`, `Mécavol`, etc.) + badge de priorité (`Priorité 1 — Points de blocage`, `Priorité 2 — À rafraîchir`, `Priorité 3 — À découvrir`, `Maîtrisé`).
   - Titre et sous-titre du sous-chapitre + jauge de maîtrise (`masteryPct%`) et répartition (`strugglingCount`, `hesitantCount`, `dueCount`, `masteredCount`, `unattemptedCount`).
2. **Étape 1 — Lire le cours officiel aux pages exactes** :
   - Liste des manuels PDF vérifiés (`courseReadings`) avec le titre du cours, les plages de pages (`p. 18–20`) et des liens directs `<a href="courses/...#page=N" target="_blank" rel="noopener noreferrer">` pour chaque page vérifiée.
3. **Étape 2 — Points clés à retenir (sans QCM)** :
   - Bouton `<button type="button" data-action="QuiztoggleAxisTakeaways" data-args="<axisId>" aria-expanded="true|false">` affichant le nombre de points clés.
   - Panneau dépliable listant les synthèses conceptuelles (`takeaways`) avec leur badge d'état (`Blocage`, `Hésitation`, `À rafraîchir`, `Repère du chapitre`), le texte de l'explication pédagogique et le lien direct vers la page du cours si disponible — **sans jamais afficher l'énoncé de la question ni les choix A/B/C/D**.
4. **Étape 3 — Vérifier ma compréhension (Atelier ciblé)** :
   - Bouton `<button type="button" data-action="QuizstartAxisWorkshop" data-args="<axisId>">` indiquant le nombre de questions de l'atelier (ex. `Atelier ciblé (6 questions)`).
