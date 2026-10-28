# Feature Specification: Import the FFVL Intranet Logbook (Excel)

**Feature Branch**: `feat/ffvl-logbook-import`
**Status**: Draft
**Input**: "Here is an export of an FFVL logbook, in Excel (the only format available). Implement the import in our
logbook. On import, the pilot must be able to tell whether a flight was already imported, and to cancel an import."

## Source format

The FFVL Intranet (`Passeport > Carnet de vols > Export Excel`) produces one worksheet, one flight per row, with the
header `Date | Site | Dénivelé | Durée | Analyse | Formateur`:

| Column | Example | Notes |
|--------|---------|-------|
| Date | `46322` (an Excel day number, shown `27/10/2026`) | A date only: the export has **no time of day** |
| Site | `SANARY` | Free text, upper case |
| Dénivelé | `100` | Metres, number |
| Durée | `60 minutes` | Text, minutes |
| Analyse | `Analyse perosnnelle` | Free text (kept as written, typo included) |
| Formateur | a person's name | Instructor; the school/club is **not** in the file |

There is no wing, harness or flight type in the export.

## User Scenarios

### US1 — Import an FFVL export (P1)
The pilot picks the `.xlsx` file from the logbook history. A dialog lists every flight found, with a status, and nothing
is added until they confirm. They may untick rows, correct the site, and give the school the flights were made at.

### US2 — Know what was already imported (P1)
- Each imported flight carries a visible **"Importé FFVL"** mark in the history, with the import date.
- Choosing the same export again (or a newer one with more rows) flags the flights already imported as
  **"Déjà importé"** and leaves them unticked: no duplicates, whatever the number of times the file is imported.
- A flight entered by hand the same day, at the same site, with a similar duration is flagged **"Peut-être déjà au
  carnet"** and left unticked (the pilot may tick it).

### US3 — Cancel an import (P1)
The history lists each import (date, number of flights) with a **"Annuler cet import"** button. After a confirmation
that names the number of flights, and how many were edited since, all the flights of that import — and only those — are
removed (the same removal as deleting a flight: cloud deletion marker included). Flights entered by hand and flights of
other imports are untouched. Importing the same file again afterwards works as a first import.

## Data rules (constitution I: nothing invented, nothing silently altered)

- **Time**: the export has none, so the flight is stored as `YYYY-MM-DDT00:00` with `dateOnly: true`; the history shows
  the date alone. Editing the flight to another time clears `dateOnly`.
- **Wing, harness, flight type**: left empty, not guessed. They are filled by editing the flight.
- **Dénivelé** is a height difference of the flight, not the IGC "gain" (height above take-off): it is not stored in
  `gain`; it is written in the comment, with the analysis and the instructor.
- **Formateur**: stored as `moniteur` when the pilot gives a school in the dialog (a session without school drops its
  instructors when edited); otherwise written in the comment.
- **Site**: a site of the sites database (or already used in the logbook) is written as the logbook writes it;
  otherwise an all-capitals name is written in capitals-and-lower-case (`SANARY` → `Sanary`); the pilot can correct it.
- **Marking**: every imported flight has `import = { source: 'ffvl-xlsx', batchId, importedAt, key }`. `key` is the
  fingerprint of the row (date, site, dénivelé, durée, analyse, formateur) plus the rank among identical rows of the
  file, so two identical flights the same day stay two flights, and the same row has the same key in every export.
  `updatedAt` of a freshly imported flight equals `importedAt`: a different `updatedAt` means "edited since".
- Reading the file needs no network and no library (offline-first): a minimal reader of the `.xlsx` container.

## Out of scope
Importing wings, harnesses or flight types (not in the export); importing from the FFVL API (keys paused); PDF export
of the FFVL logbook; the IGC traces (the export has none; a trace imported later for the same day is a separate flight).

## Success criteria
- The sample export (1 flight) imports in two clicks; importing it again adds nothing and says why.
- Cancelling an import leaves the logbook exactly as it was before it.
- Existing logbook behaviour (add, edit, delete, IGC import, stats) is unchanged; the stats do not show a nameless
  flight type for imported flights.
