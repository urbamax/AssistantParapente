# Data Model: Honest Handling of Missing and Unknown Weather Data

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

## HourlyForecast

One site, one hour, as built by `SitesService` from the provider response (and by the server
function the same way).

| Field | Type | Missing when | Notes |
|-------|------|--------------|-------|
| `time` | ISO string | — | Always present (provider time axis) |
| `windSpeed` | number \| null | null, non-finite, < 0 | km/h, rounded only if present |
| `windGust` | number \| null | null, non-finite, < 0 | km/h |
| `windDirDeg` | number \| null | null, non-finite, outside 0–360 | degrees |
| `windCard` | string \| null | derived; null when `windDirDeg` is null | N, NE, … NO |
| `precipitation` | number \| null | null, non-finite, < 0 | mm |
| `cape` | number \| null | null, non-finite, < 0 | J/kg (new) |
| `isDaytime` | boolean \| null | sunrise or sunset missing for that day | was defaulting to `true` |
| `sunriseText`… | string | — | unchanged display fields |

**Rule**: no field is ever replaced by a default. `null` means "provider gave nothing usable".

## Site orientation

Derived from `orientations_vent` (array or comma string) or `orientation`. Each label is
upper-cased and trimmed; only the eight labels N, NE, E, SE, S, SO, O, NO are recognised.

- **Known**: at least one recognised label.
- **Unknown**: no field, empty field, or no recognised label.

## EvaluationOutcome (returned by `evaluateSpotForecast`)

| Field | Type | Meaning |
|-------|------|---------|
| `status` | `'flyable' \| 'unflyable' \| 'incomplete' \| 'loading'` | New, authoritative |
| `flyable` | boolean | Kept for compatibility: `status === 'flyable'` |
| `reasonCode` | string | Stable code, see below |
| `reason` | string | French text for `reasonCode` (from the catalogue) |
| `missing` | string[] | Codes of missing values, empty unless `incomplete` |
| `orientationUnknown` | boolean | Site orientation unknown |
| `score` | number \| null | 0–100; `null` if incomplete or orientation unknown |
| `class`, `icon`, `warning` | string, string, boolean | Display hints (as today) |

**Missing value codes**: `windSpeed`, `windGust`, `windDir`, `precipitation`, `cape`,
`daylight`. `windDir` counts only when the site's orientation is known (FR-002).

**Reason codes**: `LOADING`, `INCOMPLETE`, `NIGHT`, `RAIN`, `WIND_OUT_OF_LIMITS`,
`WIND_OUT_OF_EQUIPMENT_LIMITS`, `GUST_OUT_OF_LIMITS`, `STORM_RISK`, `WRONG_ORIENTATION`,
`ORIENTATION_UNKNOWN`, `EXCELLENT`, `GOOD`, `FAIR`.

## Evaluation order (state logic)

```text
no forecast object            → loading
any required value missing    → incomplete (missing = all of them)       [FR-002, FR-004]
not daytime                   → unflyable NIGHT
precipitation > 0             → unflyable RAIN
wind outside limits           → unflyable WIND_OUT_OF_LIMITS / …_EQUIPMENT_LIMITS
gust delta over limit         → unflyable GUST_OUT_OF_LIMITS
cape > STORM_CAPE_THRESHOLD   → unflyable STORM_RISK                      [FR-010]
orientation known, wind not in it → unflyable WRONG_ORIENTATION
orientation unknown           → flyable, ORIENTATION_UNKNOWN, score null, warning  [FR-007]
otherwise                     → flyable EXCELLENT / GOOD / FAIR with score (unchanged) [FR-013]
```

"Required values" = windSpeed, windGust, precipitation, cape, daylight, plus windDir when the
orientation is known.

## Aggregates over a site's forecast window (`SitesService`)

- `flyableHours`, `maxConsecutiveHours`, `flyableSlots`, `conditionScore`: count only
  `status === 'flyable'`; an `incomplete` hour ends a consecutive run and a slot but is never
  counted as unflyable (FR-008).
- `completeHours` (new): number of non-incomplete hours in the window; `0` → the site shows
  "no reliable forecast" instead of "no flyable slot" (FR-009).
- `getModelAgreement(site)`: `null` (shown as unavailable) when either model's outcome is
  `incomplete`.
