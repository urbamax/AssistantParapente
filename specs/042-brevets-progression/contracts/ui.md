# UI Contract: Pilot Certifications (Brevets) & Progression Tracking

## 1. School Session Form (`js/views/logbook_checklists.js`)

Inside `#lb-ecole-group`:
- `<select id="lb-brevet-prepare">` with options:
  - `""` (`— Aucun / Non précisé —`)
  - `"BI"` (`BI — Brevet Initial`)
  - `"BP"` (`BP — Brevet de Pilote`)
  - `"BPC"` (`BPC — Brevet de Pilote Confirmé`)
  - `"TREUIL"` (`Qualification Treuil`)
- Registered in `LEARNED_FIELD_IDS['lb-brevet-prepare'] = 'brevetPrepare'` with `data-input-action="markFieldTouched"` and `data-change-action="markFieldTouched"`.

## 2. Logbook Statistics — "Mes Brevets & Progression" (`js/views/logbook_stats.js`)

Rendered at the top of `renderStats()` inside `[data-brevets-stats]`:
- Displays 4 cards (`[data-brevet-card="BI|BP|BPC|TREUIL"]`), visible even when the logbook has 0 sessions.
- Each card shows:
  - Title & code badge (`BI`, `BP`, `BPC`, `TREUIL`)
  - Status badges:
    - Practical status: `Brevet validé le [date]` (green) or `En préparation` / `Non commencé`
    - Theory status: `Théorie validée ([score]/[total] — [%])` (blue/green) or `Théorie à passer`
  - Linked school training metrics (when sessions exist with `brevetPrepare === code`):
    - Flights count & flight time, Ground handling count & time, schools/instructors
    - Clickable button `data-action="filterHistoryByStat"` with `data-args='["brevet","BI"]'` to filter `Historique`
  - Action buttons:
    - `data-action="openBrevetModal"` with `data-args="BI"` (`Configurer / Valider`)
    - If unassigned school sessions exist (`!s.brevetPrepare && s.ecole`), a button `data-action="openBrevetBatchModal"` with `data-args="BI"` (`Rattacher des sessions école`)

## 3. Brevet Edit Modal & Batch Assign Modal (`js/views/logbook_stats.js`)

- **Edit Modal (`#lb-brevet-modal`)**:
  - Practical section: checkbox `#lb-brevet-practical-validated`, `#lb-brevet-practical-date`, `#lb-brevet-practical-school`, `#lb-brevet-practical-instructor`, `#lb-brevet-practical-notes`
  - Theory section: checkbox `#lb-brevet-theory-passed`, `#lb-brevet-theory-date`, `#lb-brevet-theory-score`, `#lb-brevet-theory-total`, `#lb-brevet-theory-pct`, `#lb-brevet-theory-school`, `#lb-brevet-theory-examiner`
  - Live score calculation (`data-input-action="updateBrevetModalPct"`): typing `score` and `total` updates `#lb-brevet-theory-pct`
  - Save button: `data-action="saveBrevetModal"`
  - Close button: `data-action="closeBrevetModal"`
- **Batch Assign Modal (`#lb-brevet-batch-modal`)**:
  - Lists unassigned school sessions (`ecole` non-empty, `!brevetPrepare`) with checkboxes (`[data-brevet-batch-item]`), pre-checked when session date `<= practical.date` (or all pre-checked if no date is set)
  - Toggle all button: `data-action="toggleAllBrevetBatchSessions"`
  - Apply button: `data-action="applyBrevetBatchAssign"`
  - Close button: `data-action="closeBrevetBatchModal"`

## 4. QCM Setup & Quiz Stats Banner (`js/views/quiz.js`, `js/views/quiz_stats.js`)

- In `#qcm-setup-screen` (inside or right below the level selector) and in `#stats-screen`:
  - Renders `[data-quiz-brevet-banner]`:
    - When the currently selected level's theory is validated: displays official badge (`Examen théorique [level] validé le [date] — [score]/[total] ([pct]%)`) and an edit button `data-action="openBrevetModal"` (`data-args="BI"`).
    - When the currently selected level's theory is NOT yet validated: displays a prompt (`Vous avez passé l'examen théorique officiel [level] ?`) with a button `data-action="openBrevetModal"` (`Enregistrer mon résultat officiel`).
- When selecting a level via `selectLevel(lvl)` whose theory is already validated (`BrevetService.isTheoryValidated(lvl)`):
  - Automatically switches `this.selectedMode` to `'REVISION'` (Consolidation des acquis) and updates the mode cards UI.

## 5. Sites Pre-Flight Brief (`js/views/sites_list.js`)

- In `buildPreFlightBriefHtml()`:
  - Determines the pilot's practical flight level via `BrevetService.getPracticalPilotLevel() || GlobalState.get('level') || 'BI'`.
