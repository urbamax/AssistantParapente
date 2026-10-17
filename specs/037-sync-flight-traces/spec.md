# Feature Specification: Synchronise Flight Traces Between Devices

**Feature Branch**: `feat/sync-flight-traces`
**Status**: Draft
**Related**: Constitution v1.0.0 (privacy, offline-first, Spark plan), spec 008 (offline storage), global audit 2026-10 §4.4

## Problem

A flight imported from an IGC file keeps its raw trace only in the device's IndexedDB. The Firestore
sync sends the flight's figures (duration, site, altitudes, date) but never the trace. A pilot who
imports a flight on a laptop then opens the logbook on a phone at the take-off sees the flight, but
without the "Voir la trace" and "Télécharger l'IGC" buttons, and nothing says why.

## What the code really does today (measured, not assumed)

The audit said only the flight's figures are sent. A probe against the real `syncLogbookData` shows
otherwise: it writes the whole in-memory flight with `setDoc(docRef, session)`, and an in-memory
flight carries `rawIgc` (hydrated from IndexedDB, or just imported). So the raw trace already
travels **inside the flight document**, in a way that is accidental and fragile:

- It depends on timing: the sync path that reads the flights back from LocalStorage (no `rawIgc`)
  overwrites the same document without the trace; the last write wins.
- Every `saveFlights()` re-sends every flight that carries its trace, whole documents of hundreds of
  KB each, plus a read of the whole logbook.
- A cloud document carrying `rawIgc` is merged into LocalStorage (5 MB quota) by the full sync.
- A flight whose document is over 1 MiB cannot be sent at all.

So the fix is not a second channel next to this one: the trace must **never** travel inside the flight
document, and the traces already stored that way (the pilot's existing flights) must be recovered.

## Decisions

- **No trace in the flight document**: every path that writes a flight to Firestore
  (`syncLogbookData`, `syncLogbookEntry`, the full sync) strips `rawIgc` first.
- **Recovery of existing data**: a cloud flight document that still carries `rawIgc` is read once: the
  trace is saved locally (IndexedDB) if the device has none, removed from the document, and uploaded
  to `igcTraces` like any other trace. Such a flight is therefore migrated without any action.
- **Cloud documents never put a trace into LocalStorage**: the merge strips `rawIgc` before saving.

- **Storage**: Cloud Firestore, collection `users/{uid}/igcTraces`. Cloud Storage is not an option:
  it needs the paid Blaze plan, the project is on Spark.
- **Format**: the raw IGC text is gzip-compressed (`CompressionStream`), base64-encoded, and cut into
  parts of at most 700 000 characters (a Firestore document is limited to 1 MiB). A 3-hour flight at
  1 Hz is about 390 KB of text and about 138 KB once encoded: a single part. At most 12 parts per
  flight; a larger trace is not uploaded (the flight keeps working locally). Without
  `CompressionStream` the text is only base64-encoded (`identity-base64`).
- **Document ids**: `{flightId}_{index}`; flight ids are UUIDs. Each part holds `flightId`, `index`,
  `total`, `encoding`, `data`, `updatedAt`.
- **Upload**: during the existing logbook sync, after the flights are merged. At most 2 flights per
  sync (the first sync after the update uploads the existing backlog over a few syncs). A trace is
  uploaded when the flight has a local trace and no `traceCloud`, or when the trace was replaced
  (`traceUpdatedAt` newer than `traceCloud.at`).
- **Publication**: parts are written first; the flight document gets `traceCloud`
  (`{ at, parts, bytes, digest, encoding }`) only after every part succeeded, so another device never
  sees a half-uploaded trace. A failed upload (offline, rules not deployed) changes nothing and is
  retried at the next sync.
- **Download**: on demand, when the pilot opens the trace or downloads the IGC of a flight that has
  `traceCloud` but no local copy; the result is cached in IndexedDB. Never in advance (read quota,
  mobile data).
- **Deletion**: deleting a flight also deletes its trace parts (ids `{flightId}_0` to `_11`; deleting
  a document that does not exist is harmless). Replacing a trace by a shorter one removes the extra
  parts.
- **Rules**: owner-only access to `users/{uid}/igcTraces/{partId}`, with the shape and size of the
  document checked on write. The rules must be published **before** the app version that uploads;
  without them uploads are refused and retried, nothing is lost.
- **UI**: the "Voir la trace" and "Télécharger l'IGC" buttons also appear for a flight whose trace is
  only in the cloud. While it downloads the button says so; if it cannot be fetched (offline) a
  message explains.
- **Privacy**: a flight trace is a precise location history. The privacy policy now says that the
  logbook, including flight traces, is stored in Firestore for signed-in users who consented to
  cloud sync, and that deleting a flight deletes its trace. The sentence saying GPS coordinates are
  "never stored on our servers" is narrowed to the pilot's current position, which is still true.

## Requirements

- **FR-1**: A flight imported on one device shows the trace buttons on another device signed in to
  the same account, after a sync.
- **FR-2**: The trace opened on the second device is identical to the imported file (digest checked).
- **FR-3**: A flight is never shown as having a cloud trace unless all its parts are stored.
- **FR-4**: An upload failure never blocks or loses the flight sync.
- **FR-5**: Deleting a flight removes its parts from the cloud.
- **FR-6**: Only the signed-in owner can read or write `igcTraces`; shape and size are enforced by
  the rules and tested on the emulator.
- **FR-7**: Nothing is downloaded before the pilot asks for the trace.

## Out of scope

- Account deletion ("delete my data") does not exist in the app today; when it does it must delete
  `igcTraces`.
- Syncing the SDF sensor file (Syride) is not done: only the IGC trace.
