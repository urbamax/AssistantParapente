# UI Contract: Logbook Courses

The app has no external API; the contract is what the pilot sees and what the tests assert.

## Session form (school block)

- **School session** box → school name, then **Instructors** (new), **It's a course** box.
- **Instructors**: chips with a remove button, an add field with suggestions (instructors already in
  the logbook, most used first), an "Add" button; Enter or a suggestion picked adds the name; a name
  typed but not added is added on save.
- **Course name**: text field with suggestions (`#stages-list`, known course names, most used first);
  **Specialty**: select (unchanged).
- Element ids (stable for tests): `lb-ecole-check`, `lb-ecole`, `lb-moniteur-group`, `lb-moniteur-new`,
  `lb-moniteur-options`, `lb-stage-check`, `lb-stage-nom`, `stages-list`, `lb-stage-specialite`,
  `lb-accompagnateur-group`, `lb-pilotes-group`.
- Saved chips are checkboxes `name="lb-moniteur"` (hidden, checked), read like the other lists.

## Pre-fill (new session only)

| Trigger | Result |
|---------|--------|
| Course box ticked and a known name typed or picked | school (box ticked), specialty, instructors, companions, pilots of the latest session of that course, for each field the pilot has not touched |
| Course not touched, a course session at the same place less than 3 h away | course box ticked, name and specialty set, then as above |
| The place or the date changes and no course session is close any more | a course pre-filled by this rule is removed |

The explanation line ("Pré-rempli d'après tes vols : …") lists the course and the fields filled from it
with the reason "comme ton stage" (course) or "comme ta session de moins de 3 h ici" (nearby session).
Editing an existing session never pre-fills.

## History card

- School line: `<course name or "Stage"> | <school>` (unchanged), **Instructors** line lists every
  instructor, comma-separated.
- Filter banner with `stage`: "Filtre actif : <course name>" and the count; `stageUnnamed`: label
  "Stage sans nom".

## Statistics

- New card **Stages**, after "Sessions en école", only if a course session exists.
- One tile per course: course name (or "Stage sans nom"), school, specialty when set, **Vols : N (durée)**,
  **Gonflage : N (durée)**; tile is a button: `data-action="filterHistoryByStat"`,
  `data-stat-type="stage"` (or `stageUnnamed`), `data-stat-value`, title "Filtrer par <name>".
- Header subtitle: "<N> sessions en stage sur <total> au total".
- Order: most sessions first, ties by most recent.

## Texts (all in `FR.logbook`)

New keys: `form.instructorPlaceholder` (reworded for the list), `form.learned.fields.stage`,
`form.learned.fields.specialite`, `form.learned.reasons.course`, `history.unnamedCourse`,
`stats.courses`, `stats.courseShare`, `stats.courseSpecialty`. Final wording is fixed when the tests are
written; `tests/views/inline_strings.test.js` guards against inline text.
