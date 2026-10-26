# Research: Import Several Flights At Once

## R1 — Where is the batch logic?

- **Decision**: a pure service, `js/services/igc_batch_import.js`, with no DOM: reading a file into a row
  (`prepareRow`), the duplicate rules, the starting values of a row, and building the stored flight from a row
  (`buildFlight`). The table view (`js/views/logbook_batch_import.js`) only renders rows and reacts to events.
- **Rationale**: constitution VIII; the single import mixes parsing and DOM (`_processIgcFile` writes into the
  form), so it cannot be reused for rows. Services return `{ success, data, error }`.
- **Alternatives**: loop over the form (open the form per file, fill, save): that is the one-by-one flow the
  owner rejected and it would need the DOM for non-visible rows.

## R1b — Independent rows, no shared state (FR-014)

- **Decision**: `prepareRow(text, name)` is a pure function of ONE file's text: it returns the row with its own
  `trace` (raw text, points, statistics) and touches no instance field. The existing single-import fields
  (`currentRawIgc`, `currentIgcStats`, `currentSensorStats`, `currentTraceInfo`, `currentTraceData`) are not
  used by the batch at all; they stay for the one-flight form only. Everything a row needs travels in the row.
  `buildFlight(row)` is likewise pure. Sensor pairing is a pure function of the whole selection, not of any
  loop state.
- **Rationale**: those fields are exactly why the form can hold one flight at a time; reusing them would mix
  files as soon as reads overlap.

## R1c — Sensor pairing by content (FR-009)

- **Decision**: `pairSensors(rows, sensorFiles)` parses every `.sdf` once (`SdfParser.parse`), then for every
  (sensor, trace) pair computes `offset = SdfParser.alignToTrace(records, points)` and keeps the pair only when
  `SdfParser.matchesTrace(records, points, offset)` holds (the existing thresholds: 90 % of points sampled every
  5 s within 30 m and 15 m, duration within 2 min). Pairs are then resolved: a sensor with exactly one matching
  trace and a trace with exactly one matching sensor are attached; a sensor with 0 matches is "not attached"; a
  sensor with 2 or more matching traces, or a trace with 2 or more matching sensors, are all left unattached
  and listed as "ambiguous". File names and selection order are never read.
- **Cost**: S sensors × T traces comparisons, each sampling every 5 s of a flight: for 30 × 30 that is 900
  cheap comparisons (milliseconds each); a cheap pre-check (first-record position within 1 km of the trace's
  take-off) skips most pairs.

## R2 — Starting values: sharing the form's habit rules

- **Problem**: the learned defaults (`applyLearnedDefaults`) are written against the DOM (reads fields, writes
  fields, tracks touched fields). A row has no DOM.
- **Decision**: extract the *computation* into a pure function `suggestDefaults(sessions, context)` in a new
  `js/services/logbook_defaults.js` (context: session type, place, datetime, school and course typed so far)
  returning the proposed values with their reasons. The batch uses it. The form keeps its DOM code for now but
  a **parity test** runs the form and `suggestDefaults` over the same logbooks and requires the same
  proposals, so the two cannot drift. Moving the form onto the function is a later refactor, not part of this
  feature.
- **Within a batch**: rows are processed in date order and each row sees the logbook **plus the rows before it**
  as already-known sessions, which gives "flight close in time at the same site gets the same pilots and
  course" (spec 038 rules) for free.
- **Alternatives**: refactor the form onto the function now (large diff on a screen just reworked in 038);
  re-implement a simplified version (rules would diverge from the form).

## R3 — Reading many files without freezing the screen

- **Decision**: files are read one after another (`FileReader`/`File.text()`), the parse of a 400 KB trace takes
  a few tens of ms; between files the loop yields to the browser (`await` on a macrotask) and a progress
  line "n / N" is shown. Sensor files (`.sdf`) are read after the traces and paired with the existing
  `SdfParser.alignToTrace` / `matchesTrace` checks.
- **Rationale**: no worker is needed at this size; keeps code simple and testable.

## R4 — Site of a row

- **Decision**: same order as the single import: nearest known site within 500 m of the detected take-off
  (`findNearbySites` logic, moved to a pure helper that takes the site list); otherwise a place name by reverse
  geocoding **only when online and only after the table is shown** (rows show "searching…" then the name; a
  failure leaves the site empty and marked "to fill"). Requests are made one at a time to respect the
  geocoder's rate limit.
- **Rationale**: the table appears immediately and works offline.

## R5 — Duplicates

- **Decision**: a row is a duplicate of another row of the batch, or of a logbook flight, when its take-off time
  is within 5 minutes and its take-off point within 500 m (when the existing flight has no position, its site
  name is compared with the row's site instead; time alone never flags). Duplicates start unticked. Inside the
  batch the pairs are found on the rows sorted by take-off time, and of two duplicates the one with more
  points (then the earlier file name) is kept, so the result does not depend on the selection order.
- **Rationale**: re-selecting yesterday's folder is the realistic accident. Time + place avoids flagging two
  different pilots' flights of the same minute at different places, which cannot happen for one pilot's logbook.

## R6 — Adding many flights

- **Decision**: add `LogbookService.addFlights(flights)`: assigns ids and `updatedAt`, normalises, appends,
  sorts once and calls `saveFlights()` **once**, instead of N times (each `saveFlights()` rewrites the whole
  logbook and starts a sync). Traces go through the existing IndexedDB path of `saveFlights()`.
- **Failure**: the service returns which flights were added; if storage fails nothing is half-written
  (flights are added in memory, then saved once; on save failure they are removed from memory again and the rows
  stay in the table).
- **Double activation**: the import button is disabled as soon as the import starts.

## R7 — What a row stores

- Same fields as `submitForm` for a flight: type `vol`, `datetime`, `site`, `voile`, `sellette`, `duree`,
  `typeVol`, `techDecollage`, `treuilleur` (empty), `ecole`, `moniteur`, `stageName`, `stageSpecialty`,
  `accompagnateur`, `pilotes`, `typeExercice`, `lat`/`lon` of the first trace point, the IGC statistics
  (`distanceKm`, `maxClimbRate`, `maxSpeedKmh`, `avgSpeedKmh`, `igcStats`, `instrument`), altitude max and
  gain, `varioInFlight`/`varioOffInFlight` from the trace flags, `rawIgc` and `traceUpdatedAt`, `sensorStats`
  when a `.sdf` is paired. No `altOffset`. A test builds the same flight through the form and through
  `buildFlight` and compares the stored objects (FR-007, SC-004).

## R8 — Open points for the owner

See "Decisions to confirm" in the specification: apply-to-other-rows action, duplicate thresholds, instructors
and companions as columns.
