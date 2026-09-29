# Contract: Forecast Evaluation

Shared by the web app (`js/weatherScoring.js`) and the notification function
(`functions/shared/weatherScoring.mjs`, generated copy). See [data-model.md](../data-model.md)
for field definitions.

## `normalizeForecastValue(value, kind) → number | null`

- `kind` ∈ `windSpeed`, `windGust`, `windDir`, `precipitation`, `cape`.
- Returns `null` for `null`, `undefined`, `''`, non-numeric, `NaN`, `±Infinity`, negative values,
  and for `windDir` values outside 0–360; otherwise the number (wind values rounded to integers,
  as today).
- Used by every place that builds an `HourlyForecast` from a provider response.

## `getSiteOrientations(site) → string[]`

Returns the recognised orientation labels of a site (possibly empty = unknown).

## `evaluateSpotForecast(site, weather, userPreferences) → EvaluationOutcome`

**Inputs**

- `site`: site object (orientation fields, optional `orientation_ideale_deg`).
- `weather`: `HourlyForecast` or `null`.
- `userPreferences`: `{ vMin, vMax, deltaRafaleMax, filterMode, wings? }`. `wings` is the list
  of the pilot's wings, provided by the caller when `filterMode === 'hardware'`. The function
  MUST NOT read any storage.

**Guarantees**

1. Pure: same inputs → same output; no I/O, no DOM, no storage, runs in browser and Node.
2. Never returns `status: 'flyable'` or `'unflyable'` when a required value is missing.
3. Never substitutes a default for a missing value.
4. `missing` lists every missing required value, in the fixed order
   `windSpeed, windGust, windDir, precipitation, cape, daylight`.
5. For a site with unknown orientation: never a `score`, never `EXCELLENT/GOOD/FAIR`.
6. For complete inputs and known orientation: `flyable`, `score`, `reason` identical to the
   pre-change implementation (regression suite).

## `STORM_CAPE_THRESHOLD`

Exported named constant, `1000` (J/kg), with a comment citing its source: FFVL, Commissions
Nationales Sécurité et Technique, "Canicule, vague de chaleur et vol libre", 2026-07-31
(research R3, FR-010a).

## Server usage (`functions/index.js`)

- Builds each `HourlyForecast` with `normalizeForecastValue` and daylight → `null` when
  sunrise/sunset is missing.
- Sends a "becomes flyable" notification only when the outcome `status === 'flyable'` and
  `orientationUnknown === false`; an `incomplete` outcome is stored as "unknown", never as
  flyable or unflyable, so it cannot trigger a transition.
