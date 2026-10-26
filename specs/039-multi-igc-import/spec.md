# Feature Specification: Import Several Flights At Once

**Feature Branch**: `feat/multi-igc-import` (to be cut from `feat/logbook-courses`, on which it depends)

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "Add several sessions at the same time by uploading several files at once. One editable table, one row per flight, where at least the wing, the course and the pilots are edited directly on the row before everything is imported in one go. No one-by-one form, no direct import without validation. The starting values of each row come from the trace and from the habits the app already learned."

## Problem

After a day of flying, or a whole course, a pilot has ten or twenty flight files to enter. Today the
import takes one file at a time through the "add a session" form, and when several files are selected or
dropped together **only the first one is used and the others are silently ignored** — the pilot is not even
told. Entering a day of flights means opening the form, importing, completing and saving, again and again,
for fields that are almost always the same (wing, harness, school, course, pilots).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Check and import a batch of flights from one table (Priority: P1)

The pilot selects (or drops) several flight files. Instead of the one-flight form, a single table opens with
one row per flight, already filled in from each trace and from what the app has learned of their habits. The
pilot corrects what is wrong directly on the rows, then imports every row in one action. The flights appear
in the logbook as if each had been added through the form.

**Why this priority**: it is the request. Without it nothing else in this feature has value.

**Independent Test**: select three valid flight files; a table with three rows opens; edit the wing of one
row; import; the logbook shows three new flights with their traces, one of them with the edited wing.

**Acceptance Scenarios**:

1. **Given** two or more flight files selected or dropped, **When** the files are read, **Then** one table
   opens with one row per file, ordered by flight date, instead of the one-flight form.
2. **Given** one single flight file, **When** it is selected, **Then** the existing one-flight form is used,
   unchanged.
3. **Given** the table, **When** the pilot imports, **Then** each included row becomes a logbook flight with
   the same data a flight added through the form would have (trace, statistics, altitude, gain, take-off
   position, type, school, course, pilots), and the weather of each is fetched afterwards as for any flight.
4. **Given** the table, **When** the pilot cancels or closes it, **Then** nothing is added.
5. **Given** the import is done, **Then** the pilot sees how many flights were added and the logbook opens on
   them.

---

### User Story 2 - Edit each row, with sensible starting values (Priority: P1)

Every row starts from the trace (date and time, duration, site found near the take-off, flight type
suggested from the trace) and from the learned habits (wing, harness, take-off technique, school, course,
instructors, pilots), by the same rules as the one-flight form. The pilot can change on the row: the date and
time, the site, the duration, the wing, the harness, the flight type, the school session and course, and the
pilots.

**Why this priority**: the table is only faster than the form if the rows are right from the start and
cheap to correct; "wing, course and pilots" are the fields the pilot said they must be able to edit.

**Independent Test**: import a batch for a pilot whose logbook shows a usual wing and a known course; the
rows come with that wing and that course; changing the course on a row pre-fills the school, instructors and
pilots of that course on that row, as in the form.

**Acceptance Scenarios**:

1. **Given** a row, **When** it is shown, **Then** its wing, harness, school, course and pilots are the ones
   the one-flight form would have proposed for a new session at that site and time, and a flight close in time
   to another flight of the same batch, at the same site, gets the pilots and the course of that flight.
2. **Given** a row, **When** the pilot picks a known course name, **Then** the school, specialty, instructors,
   companions and pilots of that course are filled on that row, without replacing what the pilot already
   edited on it (same rules as spec 038).
3. **Given** a row, **When** the pilot edits the wing, harness, flight type, site, date, duration, school
   session, course or pilots, **Then** only that row changes.
4. **Given** the pilot sets a value on a row, **When** they ask to apply it to the other rows (the same
   column), **Then** the other rows take it, except those the pilot already edited for that column.
5. **Given** the wing is empty on an included row, **When** the pilot imports, **Then** the import does not
   start, the row is marked, and a message says what is missing (the wing is mandatory for a flight, as in the
   form).

---

### User Story 3 - Trouble in the batch does not lose the good flights (Priority: P1)

Some files will not be flights: an empty file, a corrupted one, a trace too short to be a flight, the same
file twice, or a flight the logbook already has. The table shows these rows as such, explains why, and lets
the good flights go through.

**Why this priority**: a batch is only usable if one bad file does not block or silently corrupt the others,
and a silent skip is exactly the defect being fixed.

**Independent Test**: select two valid files, one corrupted file and a copy of an already imported flight; the
table shows four rows, the corrupted one cannot be included, the duplicate is unticked and flagged; importing
adds only the two new flights.

**Acceptance Scenarios**:

1. **Given** a file that cannot be read as a flight, **When** the table opens, **Then** its row says why in
   plain words, cannot be included, and does not stop the other rows.
2. **Given** a file whose flight matches one already in the logbook (take-off within 5 minutes of the same
   time and from the same place), **When** the table opens, **Then** the row is flagged "already in the
   logbook" and is unticked by default; the pilot can tick it to import it anyway.
3. **Given** two selected files that are the same flight (same take-off time within 5 minutes and same
   take-off place: two recorders, or the same file chosen twice), **When** the table opens, **Then** one row
   stands for the flight and the other is flagged as a duplicate of it and unticked; which of the two is kept
   does not depend on the order the files were selected.
4. **Given** rows the pilot does not want, **When** they untick or remove them, **Then** they are not imported.
5. **Given** a trace that already starts in the air or ends in the air, **When** its row is shown, **Then** the
   row says that date or duration must be checked, as the one-flight form already warns.
6. **Given** at least one row cannot be imported, **When** the pilot imports, **Then** the other rows are added
   and the pilot is told exactly which rows were not.

---

### User Story 4 - Sensor files go with their flight (Priority: P2)

Syride `.sdf` files can be selected with the flight files. Each one is paired with the flight it belongs to
**by its content, never by its name or by the order of selection**: it is tried against every trace of the
batch with the same checks as the one-flight import, and attached only to a trace it follows. Its load-factor
and temperature statistics are saved with that flight.

**Why this priority**: it keeps parity with the existing single import for pilots who own the sensor, but most
batches have no `.sdf`.

**Independent Test**: select two traces and the `.sdf` of the second one; the second row shows the sensor data
is attached and, after import, the flight has its sensor statistics.

**Acceptance Scenarios**:

1. **Given** flight files and `.sdf` files selected together, in any order and with any names, **When** the
   table opens, **Then** each `.sdf` is attached to the row whose trace it matches; the row says so.
2. **Given** several flights from the same take-off on the same day, each with its `.sdf`, selected in a
   shuffled order, **When** the table opens, **Then** every flight carries the sensor data of its own `.sdf`
   and no other.
3. **Given** a `.sdf` that matches no trace of the batch, **When** the table opens, **Then** it is listed as
   "not attached" with the reason, and nothing is saved from it.
4. **Given** a `.sdf` that matches two traces (or a trace that matches two `.sdf`), **When** the table opens,
   **Then** it is attached to none of them and listed as ambiguous with the reason.

---

### Edge Cases

- A very large batch (30 files or more): the table stays usable by scrolling, reading and importing do not
  freeze the screen, and progress is visible while the files are read.
- No network: the import works; the site of a row is the nearest known site when there is one, otherwise left
  empty and marked "to fill" (the site is mandatory), and the weather is fetched later if the network returns.
- The site of a row cannot be found (neither a known site nor a place name): the row is marked "to fill" and
  the import is blocked until the pilot gives one or unticks the row.
- Two flights of the batch at the same site on the same day: they are separate rows (their take-offs are more
  than 5 minutes apart); the second proposes the pilots and the course of the first (close in time, same
  place), and each keeps its own trace, statistics and sensor data.
- Files selected in a different order, or renamed, give the same table (same rows, same pairing, same flags);
  the order only matters for the display order, which is by flight date.
- Files of an unsupported type selected with the others: listed as not supported, ignored, others continue.
- The pilot edits a row, then changes the wing of another row: the first row is not touched.
- The pilot closes the table by mistake after editing many rows: they are asked to confirm before the edits
  are lost.
- The batch is imported twice in a row (double click): the flights are added once.
- Storage is full or an error happens while adding flights: the pilot is told how many were added and which
  were not; flights already added are not removed and the others stay in the table to retry.
- The table on a phone: it remains usable (rows readable one under the other, fields reachable, import button
  reachable), in light and dark themes, with the keyboard.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Selecting or dropping two or more flight files MUST open one editable table with one row per
  file instead of the one-flight form; one file MUST keep using the one-flight form; no file MUST ever be
  ignored without being listed.
- **FR-002**: Each readable row MUST start with: flight date and time, duration, site (nearest known site to
  the detected take-off, otherwise the nearest place name when online), flight type suggested from the trace,
  and wing, harness, take-off technique, school, course, instructors and pilots by the rules of the
  one-flight form (spec 038 included), computed for that row's site and time.
- **FR-003**: Every row MUST allow editing, at least: date and time, site, duration, wing, harness, flight
  type, school session and course, and pilots. Picking a known course on a row MUST fill that row's school,
  specialty, instructors, companions and pilots like the one-flight form, without replacing what was edited.
- **FR-004**: The table MUST offer, for the editable columns, a way to apply a value to the other rows that the
  pilot has not edited for that column.
- **FR-005**: The pilot MUST be able to include or exclude each row, and to remove it.
- **FR-006**: Importing MUST add every included row at once; the mandatory fields of a flight (date, site,
  wing, duration) MUST be checked first and the rows lacking one MUST be marked and block the import until
  fixed or excluded.
- **FR-007**: Each imported flight MUST be identical to one added through the form: same stored fields, trace
  kept for "Voir la trace" and "Télécharger l'IGC", statistics, altitude correction left unset, trace sync
  date set, and weather fetched afterwards. Nothing MUST be added before the pilot confirms.
- **FR-008**: A file that cannot be read, a trace that is not a flight, an unsupported file, a duplicate inside
  the batch and a flight already in the logbook MUST each appear as a row (or, for sensor files, a listed
  entry) with a plain-language reason; duplicates MUST be unticked by default; one bad file MUST NOT block or
  alter the others.
- **FR-009**: `.sdf` files selected with the traces MUST be paired with a trace **by content only** (each
  `.sdf` tried against each trace with the one-flight import's verification: positions, altitudes, duration,
  share of matching points), never by file name or selection order; a `.sdf` MUST be attached only to a trace
  it matches, saved with that flight only, and shown on the row; a `.sdf` matching no trace MUST be listed as
  not attached, and one matching several traces (or a trace matching several `.sdf`) MUST be attached to none
  and listed as ambiguous. A flight selected twice counts as one trace for this rule: its `.sdf` MUST be
  attached to the kept row, never to the flagged copy, and MUST NOT be listed as ambiguous because of the copy.
- **FR-014**: Every row MUST be built from its own file alone: nothing read from one file (trace, statistics,
  sensor data, site, altitude) may reach another row, whatever the number of files or their order, and the
  table MUST be identical for any order or naming of the same selection (except the file order of equal dates).
- **FR-015**: Two files that are the same flight (take-off time within 5 minutes and take-off place within
  500 m) MUST give one row and one flagged duplicate; a flight whose take-off time is within 5 minutes of a
  logbook flight's, from the same place, MUST be flagged "already in the logbook" and unticked; two flights of
  the same pilot at the same site on the same day with take-offs more than 5 minutes apart MUST stay two
  separate rows.
- **FR-016**: Rows MUST be ordered by flight date and time, and each row MUST have its own include/exclude
  checkbox.
- **FR-010**: Cancelling MUST add nothing; closing the table with edited rows MUST ask for confirmation.
- **FR-011**: After the import the pilot MUST be told how many flights were added and which rows, if any, were
  not; a second activation of the import button MUST NOT add the flights twice.
- **FR-012**: The feature MUST work offline, keep all data on the device and in the pilot's own synced
  account only (no new third-party call), and show names with escaping (site, wing, pilots, course).
- **FR-013**: All new text MUST be in the centralised French strings; the table MUST be usable on mobile and
  desktop, in light and dark themes, with the keyboard, and announce row problems to assistive technology.

### Key Entities *(include if feature involves data)*

- **Import batch**: the set of files selected together; exists only until it is imported or cancelled.
- **Import row**: one file's flight as it will be added: file name, status (ready, to fix, duplicate, already
  in the logbook, unreadable, unsupported), the editable values, whether it is included, the sensor file
  attached, and the trace read from the file. It becomes one logbook flight.
- **Logbook flight**: unchanged; an imported row yields exactly what the form yields.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A pilot with a day of 10 flights from one wing and one course can import all of them in under
  2 minutes from selecting the files, correcting at most one column of the table.
- **SC-002**: No selected file is ever lost without a visible row explaining it: for any selection of N files,
  the table accounts for N rows (or listed files).
- **SC-003**: For a batch with unreadable files or duplicates, 100 % of the valid, new flights are imported and
  0 flights are added twice.
- **SC-004**: A flight imported from the table is indistinguishable in the logbook from the same flight added
  through the form (same fields, same trace buttons, same statistics).
- **SC-005**: Cancelling at any moment leaves the logbook exactly as it was.
- **SC-006**: For any selection of flight and sensor files, shuffling the order or renaming the files does not
  change which sensor data goes to which flight; in a day of several flights from the same take-off, 0
  sensor files end up on the wrong flight.

## Decisions to confirm

The specification takes the following defaults; each one changes behaviour the pilot will see, so they are
listed for the owner to confirm or change before planning is frozen:

1. **Apply to the other rows**: a per-column action on the table ("fill down" the value of the first row, or
   of a chosen row), never automatic. *Alternative*: no bulk action at all, the starting values being enough.
2. **Duplicate rule**: take-off times within 5 minutes and take-off places within 500 m (an existing flight
   without a position is compared on time and site name instead); duplicates start unticked but can be
   ticked.
3. **Instructors and companions** are not columns: they come with the course (as in spec 038) and are edited by
   opening the flight afterwards. *Alternative*: add them as columns.

## Assumptions

- The one-flight form keeps its own single import; this feature only changes what happens when more than one
  file is selected or dropped.
- File types are those the app accepts today (`.igc`, `.gpx`, `.sdf`); a `.gpx` that the app cannot read as a
  flight shows as unreadable.
- The learned habits and the course rules of spec 038 are those used for each row; this feature depends on
  spec 038 being in place.
- Flights of a batch are added to the logbook with their own ids, in date order; the logbook sorts by date as
  always.
- Typical size is up to a few dozen files, a few hundred KB each; reading is done in the browser, file by
  file, with visible progress.
- Altitude correction (real altitude of landing or take-off) is not offered in the table; it stays available by
  opening a flight afterwards.
