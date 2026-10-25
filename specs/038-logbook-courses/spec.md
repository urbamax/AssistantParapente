# Feature Specification: Logbook Courses — Memory, Several Instructors, Statistics

**Feature Branch**: `feat/logbook-courses`

**Created**: 2026-10-25

**Status**: Draft

**Input**: User description: "Logbook school courses (stages): (1) remember course names so that choosing a known course name (suggestion list ranked by use) pre-fills the school, specialty, instructors, companions and pilots from its latest session, and a session close in time and place to a course session pre-fills the course too; (2) allow several instructors per school session (like companions; legacy single-string `moniteur` sessions must keep working, shown and edited); (3) show courses in the statistics (per course: sessions, flights, flight time, ground time; clicking filters the history by course), which today ignore them."

## Problem

A pilot who follows a multi-day course (a "stage": initiation, SIV, progression…) records every
flight and ground-handling session of it in the logbook as a school session. Three things get in the
way today:

- **The course is retyped every time.** The course name is a free text with no suggestions, and
  picking it does not bring back anything else. The school, the instructors, the companions and the
  pilots of the course have to be entered again for each of the ten or twenty sessions of the course,
  although the form already pre-fills the school, the instructor and the pilots from the pilot's
  habits and from a session close in time and place. The course itself is the one thing it never
  pre-fills.
- **A school session accepts only one instructor.** Courses are often supervised by two instructors
  (or one instructor and a trainee), and only one can be recorded. Companions already accept several
  names; instructors do not.
- **Courses do not appear in the statistics.** The statistics show schools, wings, places, flight
  types and exercises, but a course recorded on many sessions is invisible there, so the pilot cannot
  see what a course amounted to (how many sessions, how many flights, how much flying time).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Re-use a known course in one gesture (Priority: P1)

A pilot is in the second day of a course and adds the next session. They type the first letters of the
course name, pick the known course from the suggestions, and the school, specialty, instructors,
companions and pilots of that course are filled in from its latest session. They only have to check
the date and the duration.

**Why this priority**: this is where the time is lost today (every session of a course repeats the
same five fields) and it is the request that motivated the feature.

**Independent Test**: record one school session with a course name, a specialty, two instructors, a
companion and two pilots; open a new session form, tick "school session" and "course", pick the course
name in the suggestions; the school, specialty, instructors, companions and pilots are filled in.

**Acceptance Scenarios**:

1. **Given** a logbook with a course session, **When** the pilot opens the course name field in a new
   session, **Then** the known course names are suggested, the most used first.
2. **Given** a known course, **When** the pilot picks its name, **Then** the school, the specialty, the
   instructors, the companions and the pilots of its most recent session are filled in, and the
   form says where they come from (the same explanation line as the other pre-filled fields).
3. **Given** a field the pilot has already filled or changed in this form, **When** they pick a known
   course, **Then** that field is left as the pilot entered it.
4. **Given** a known course whose latest session had no companion, **When** the pilot picks it,
   **Then** no companion is added and nothing else is affected.
5. **Given** the pilot edits a session that already exists, **When** the form opens, **Then** nothing
   is pre-filled over the saved values (same rule as the other learned fields).

---

### User Story 2 - A session in a row of a course starts with the course ticked (Priority: P1)

The pilot flies five times in the morning during a course, at the same place. When they add the
second flight, the form already shows the school session ticked, the course name and its specialty,
like it already shows the school and the pilots of a session close in time and place.

**Why this priority**: it removes the first manual step (ticking the course and choosing it) for the
most common case, a series of flights in a row.

**Independent Test**: record a course session, then open a new session form with the same place and a
date within three hours; the course box is ticked with the name and the specialty.

**Acceptance Scenarios**:

1. **Given** a course session at a place, **When** the pilot adds a session at the same place less than
   three hours apart, **Then** the course is ticked with the same name and specialty, and the other
   fields of the course (instructors, companions, pilots) follow as in User Story 1.
2. **Given** the nearest session at the same place is not part of a course, **When** the pilot adds a
   session, **Then** the course box stays unticked.
3. **Given** the pilot unticks the course box or changes the course name, **When** the form is
   re-evaluated (new date, new place), **Then** their choice is kept.

---

### User Story 3 - Several instructors on a school session (Priority: P1)

A course is led by two instructors. The pilot adds both to the session, like companions: a name field
with suggestions (the instructors already recorded, the most frequent first) and a button to add, each
name shown as a removable tag.

**Why this priority**: today the second instructor simply cannot be recorded; it is a data-loss
limitation, and the course pre-fill of User Story 1 must carry all the instructors.

**Independent Test**: add two instructors to a school session, save it, reopen it for edit: both are
there; the history shows both.

**Acceptance Scenarios**:

1. **Given** a school session being added or edited, **When** the pilot adds two instructor names,
   **Then** both are saved and shown as tags, and the history card lists both.
2. **Given** a session recorded before this feature with a single instructor, **When** it is shown in
   the history or opened for edit, **Then** its instructor is shown (one tag when editing), and saving
   it without changes keeps that instructor.
3. **Given** a name typed in the instructor field but not yet added when the pilot saves, **When**
   the session is saved, **Then** the name is added rather than lost (same behaviour as the other
   lists).
4. **Given** the pilot unticks "school session", **When** the session is saved, **Then** no instructor
   is kept (same as today).
5. **Given** several sessions of the same school, **When** the pilot opens a new session for that
   school, **Then** the instructors of the latest session of that school (preferably at that place)
   are pre-filled, as the single instructor is today.

---

### User Story 4 - Courses in the statistics (Priority: P2)

On the statistics screen the pilot sees a "Courses" block listing each course with its number of
sessions, its flights and flying time, and its ground sessions and ground time. Touching a course
shows only its sessions in the history.

**Why this priority**: it is read-only and depends on nothing else, but it only matters once courses
are recorded properly (User Stories 1–3).

**Independent Test**: record sessions in two courses; open the statistics; each course appears with
the right counts; touch one; the history shows only its sessions with the filter banner.

**Acceptance Scenarios**:

1. **Given** sessions belonging to courses, **When** the pilot opens the statistics, **Then** a block
   lists each course with its school, its number of flights and flying time, its number of ground
   sessions and ground time, the most active course first.
2. **Given** no session belongs to a course, **When** the pilot opens the statistics, **Then** the
   block is not shown.
3. **Given** a course in the block, **When** the pilot touches it, **Then** the history opens filtered
   on that course, with the banner telling which course is shown and how many sessions match, and the
   filter can be cleared as for the other statistics.
4. **Given** the same course typed with different capital letters or extra spaces in different
   sessions, **When** the statistics are shown, **Then** they count as a single course.
5. **Given** sessions with a specialty but no course name, **When** the statistics are shown, **Then**
   they are grouped in a single "unnamed course" entry rather than dropped.

---

### Edge Cases

- A course recorded with a different school in two sessions: the pre-fill takes the school of the
  latest session of that course; the statistics show the course once, with the school of its latest
  session.
- Two courses with the same name in different years (a yearly "Stage été"): they are one course by
  name. The pilot can tell them apart by giving different names; the statistics do not split by date.
- A course name picked from the suggestions while the school box is unticked: the school box is
  ticked (a course requires a school).
- A course name that is only partly typed and not in the list: nothing is pre-filled, the text is
  kept as a new course.
- An instructor name present twice with different capital letters: kept once (first spelling).
- An instructor list with 0 names: allowed (the instructor stays optional).
- Sessions synchronised from another device that only have the single-instructor text: shown and
  edited like any legacy session; nothing is migrated in bulk.
- A session whose course name is blank but whose specialty is set: it still counts as a course
  (consistent with the history, which already labels it "Stage").

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The course name field MUST suggest the course names already in the logbook, the most
  used first, case-insensitively de-duplicated.
- **FR-002**: Picking a known course name MUST fill, from the latest session of that course, the
  school, the specialty, the instructors, the companions and the pilots, leaving every field the
  pilot has already filled or changed untouched, and MUST tick the school box if it is unticked.
- **FR-003**: A pre-filled field MUST be reported on the form's explanation line with the reason
  (course), like the other learned fields; the pilot MUST stay able to change or empty any of them.
- **FR-004**: A new session at the same place and less than three hours from a session that belongs
  to a course MUST open with the school box and the course box ticked, the course name and the
  specialty of that session filled in, unless the pilot has chosen otherwise in this form.
- **FR-005**: No pre-fill from FR-002 or FR-004 MUST apply when editing an existing session.
- **FR-006**: A school session MUST accept several instructors, entered and removed like companions,
  with suggestions of the instructors already recorded (most used first).
- **FR-007**: A session recorded with the former single-text instructor MUST be read, displayed and
  edited as an instructor list of one; saving it MUST NOT lose the instructor.
- **FR-008**: The history MUST list all instructors of a session.
- **FR-009**: The instructor pre-fill of a new school session MUST carry all the instructors of the
  chosen reference session (latest of the school, preferably at the same place).
- **FR-010**: The statistics MUST show a block of courses when at least one session belongs to a
  course, each with: course name, school, number of flights and flying time, number of ground sessions
  and ground time; ordered by number of sessions, most active first.
- **FR-011**: Touching a course in the statistics MUST filter the history on that course (same
  filter banner and clearing as the other statistics).
- **FR-012**: Course names MUST be compared without regard to case or surrounding spaces everywhere
  (suggestions, pre-fill, statistics, filter).
- **FR-013**: All new user-facing text MUST be in the centralised French strings, and the block MUST
  be usable on mobile and desktop, in light and dark themes, with the keyboard (constitution).
- **FR-014**: Existing logbook data MUST keep working without any migration, including data
  synchronised between devices running different app versions.

### Key Entities *(include if feature involves data)*

- **Session**: a flight or ground-handling session; may belong to a school, and through it to a
  course.
- **Course (stage)**: identified by its name (case-insensitive); has a specialty, a school, instructors,
  companions and pilots taken from its sessions. It has no record of its own: it is what its sessions
  have in common.
- **Instructor list**: the names of the instructors of a school session (zero, one or several); the
  former single instructor text is one possible stored form of it.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Adding the second and later sessions of a course needs no retyping of the school,
  specialty, instructors, companions or pilots: from a blank form, the pilot picks the course name and
  types only the date and the duration.
- **SC-002**: For a series of sessions at one place within three hours, the course is already ticked
  and named when the form opens (zero manual steps to attach the session to the course).
- **SC-003**: Two instructors can be recorded on a session and are all shown after save and after
  reopening; a session recorded before the feature still shows its instructor.
- **SC-004**: Every session that belongs to a course appears in exactly one entry of the courses block
  of the statistics, and the counts of the block add up to the number of course sessions of the logbook.
- **SC-005**: Touching a course in the statistics shows exactly the sessions counted for it.

## Assumptions

- A course is identified by its name only; no date range or explicit "course" record is added. A
  yearly course with the same name is one course in the statistics (see Edge Cases).
- The statistics block lists flights and ground sessions separately, like the schools block, with
  the time of each; no breakdown by specialty is added in this feature.
- The three-hour window and the "same place" rule are those the form already uses for the pilots of
  a session close in time and place.
- No bulk migration of existing sessions: the former single instructor text is read as a list of one
  wherever instructors are read.
- Importing several flight files at once is a separate feature (not part of this specification).
- The sync between devices carries the session fields as they are; no change to the cloud rules is
  needed (sessions are free-form documents).
