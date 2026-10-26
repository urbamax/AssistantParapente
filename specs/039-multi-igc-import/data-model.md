# Data Model: Import Several Flights At Once

Nothing new is stored. The batch lives in memory until the import; the result is ordinary logbook flights.

## Import row (in memory)

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | local row id, not the flight id |
| `fileName` | string | shown on the row |
| `status` | `ready` \| `fix` \| `duplicate` \| `known` \| `unreadable` \| `unsupported` | `fix`: a mandatory value missing; `duplicate`: same flight earlier in the batch; `known`: already in the logbook |
| `reason` | string | plain-language reason for any status other than `ready` (French, from the strings module) |
| `included` | boolean | default `true` for `ready` and `fix`; `false` for the others; `unreadable` and `unsupported` can never be included |
| `values` | object | editable: `datetime` (datetime-local), `site`, `duree` (min, integer ≥ 1), `voile`, `sellette`, `typeVol`, `ecole`, `stageName`, `stageSpecialty`, `pilotes` (list); carried: `techDecollage`, `moniteur` (list), `accompagnateur` (list) |
| `edited` | set of field names | fields the pilot changed on this row; never overwritten by suggestions or "apply to others" |
| `learned` | map field → reason | why a value was proposed (same reasons as the form) |
| `trace` | object | `rawIgc`, parsed points, statistics, `takeoffIndex`, flags `startsAirborne` / `endsAirborne`, `takeoffAlt`, `landingAlt`; dropped when the batch ends |
| `sensor` | object \| null | `sensorStats` from a paired `.sdf`, and the file name |
| `warnings` | list | e.g. "starts in the air: check date and duration" |

Validation on import (per included row, as in the form): `datetime` non-empty, `site` non-empty, `voile`
non-empty, `duree` integer ≥ 1. A row failing any of them has status `fix` and blocks the import.

## Unpaired sensor file (in memory)

`{ fileName, reason }`, listed under the table.

## Resulting flight

Exactly the flight `submitForm` produces for a trace import (see research R7); `id`, `updatedAt` and
`syncPending` are set by `LogbookService.addFlights`.
