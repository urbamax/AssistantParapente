# UI Contract: Import Several Flights At Once

## Entry

- The "add a session" button's file picker, the drop zone of the form and the global file input accept several
  files. One flight file: unchanged one-flight form. Two or more flight files (plus any `.sdf`): the batch
  dialog opens instead. If the selection holds only `.sdf` files, the existing message applies.

## Batch dialog

- Title "Importer plusieurs vols"; a progress line while files are read ("Lecture 3 / 12…").
- A table, one row per file, ordered by flight date, with a header row and these columns:
  1. **Include** checkbox (disabled for unreadable / unsupported rows)
  2. **File** name, with the row status badge and its reason below when not ready
  3. **Date et heure** (datetime field)
  4. **Site** (text with the sites suggestions; "à renseigner" when empty)
  5. **Durée (min)**
  6. **Voile** (select of the equipment, plus "Autre" with a free text, like the form)
  7. **Sellette** (same)
  8. **Type de vol** (select)
  9. **Stage** (course name with suggestions; picking a known course fills the school, specialty, instructors,
     companions and pilots on the row); a small "école" text appears under it when the row is a school session
  10. **Pilotes** (tags with remove, add field with suggestions, like the form)
  11. **Remove row** button
- Under a column header, an "Appliquer à toutes" action for wing, harness, flight type, course and pilots: it
  copies the value of the first included row to the other rows that were not edited in that column.
- Footer: summary "N vols prêts, M à vérifier, K ignorés", [Annuler], [Importer N vols] (disabled while no row
  is included or a read is in progress; blocked with a message and the offending cells marked when a mandatory
  value is missing).
- Below the table, the sensor files not attached (no matching trace) or ambiguous (several matching traces), each with its reason.
- On phones the rows stack: each row is a card with the same fields in the same order.

## Behaviour

- Editing a cell changes only its row and marks the field as edited on it.
- Row status updates live (a missing wing becomes ready when filled).
- Closing with edited rows asks for confirmation; "Annuler" adds nothing.
- After the import: the dialog closes, the history tab opens, a message tells "N vols ajoutés" and lists rows
  that were not added; weather of each added flight is fetched afterwards.

## Accessibility

- Table semantics (`table`, `th scope`), every control labelled with its column and file name, status changes
  announced in a polite live region, keyboard order row by row, focus returned to the add button on close.

## Texts

All in `FR.logbook.batch.*` (title, column headers, statuses and reasons, buttons, messages); no inline text.
