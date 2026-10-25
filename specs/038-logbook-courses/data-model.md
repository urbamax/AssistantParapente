# Data Model: Logbook Courses

No new stored record. Two stored fields of a session are read differently; the course is derived.

## Session (stored, existing)

| Field | Before | After | Notes |
|-------|--------|-------|-------|
| `ecole` | text | unchanged | a course requires it |
| `moniteur` | text (`''` or one name) | text **or** list of names | read through `instructorsOf`; written as a list (empty list when none) |
| `stageName` | text | unchanged | `''` when not a course |
| `stageSpecialty` | text | unchanged | one of the specialties, or `''` |
| `accompagnateur` | text or list | unchanged | already tolerant |
| `pilotes` | list | unchanged | |

Validation (on save, as today): `ecole`, `moniteur`, `stageName`, `stageSpecialty`, `accompagnateur`
are emptied when the school box is unticked; `stageName` / `stageSpecialty` are emptied when the course
box is unticked.

## Derived values (not stored)

- **Instructors of a session**: `instructorsOf(session)` → names trimmed, empty ones dropped,
  duplicates ignoring case dropped (first spelling kept), order kept. Accepts text, list or nothing.
- **Course key**: `courseKey(session)` → `stageName` trimmed and lower-cased, `''` for the unnamed course.
- **Is course session**: `isCourseSession(session)` → has `ecole` and (`stageName` or `stageSpecialty`).
- **Course entry (statistics)**:

  | Field | Meaning |
  |-------|---------|
  | `key` | `courseKey`, `''` for unnamed |
  | `name` | spelling of the most recent session, `''` for unnamed |
  | `school` | `ecole` of the most recent session |
  | `specialty` | `stageSpecialty` of the most recent session |
  | `flights`, `flightMinutes` | sessions of type `vol`, sum of `duree` |
  | `groundSessions`, `groundMinutes` | sessions of type `gonflage`, sum of `duree` |
  | `sessions` | flights + ground sessions |

  The sum of `sessions` over all entries equals the number of course sessions in the logbook.

## Compatibility

- A session saved by the previous version (`moniteur: 'Gilbert'`) reads as `['Gilbert']`; opening it and
  saving without change writes `['Gilbert']`.
- A session saved by this version read by the previous version shows the list as one text. See research R1.
- Cloud rules put no shape constraint on logbook documents; no rules change.
