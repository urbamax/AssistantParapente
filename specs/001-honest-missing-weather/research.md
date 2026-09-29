# Research: Honest Handling of Missing and Unknown Weather Data

**Feature**: [spec.md](spec.md) | **Date**: 2026-09-29

## R1. How often is forecast data actually missing?

**Finding** (live Open-Meteo requests, 8-day window, point 45.9 N / 6.1 E, 2026-09-29):

| Endpoint used by the app | Empty hours / 192 | Last hour with data |
|--------------------------|------------------:|--------------------:|
| `meteofrance` (AROME, app default) | 83 | h108 |
| `dwd-icon` + `icon_eu` | 65 | h126 |
| `dwd-icon` + `icon_global` | 11 | h180 |
| `gfs`, `ecmwf`, `forecast` | 0 | h191 |

The app requests `forecast_days=8` and keeps up to 168 hours. With the default model, **every
hour after ~4.5 days is `null`** for wind, gusts and direction. Today `Math.round(null)` turns
them into 0 km/h, shown as "Vent hors limites" and a red bar: gap A1 is not a corner case, it
happens on every load.

**Decision**: treat `null`, `undefined`, non-numeric, non-finite and physically impossible values
as missing, at parsing time (service) and again at evaluation time (scoring), so that neither
layer can turn a gap into a number.

**Rationale**: defence in depth; the scoring function is also used by the server and by tests
with hand-built objects.

**Alternatives considered**: trimming the forecast window to the model's horizon (hides the
problem for one cause only, not for sporadic gaps); interpolating missing hours (invents data,
forbidden by Principle I).

## R2. Is the thunderstorm indicator (CAPE) available?

**Finding**: `hourly=cape` is accepted by every endpoint the app uses and has exactly the same
coverage as wind (same empty hours, table above). The secondary-model request and the server
request can add it the same way.

**Decision**: request `cape` in the three places that fetch hourly forecasts (primary fetch,
secondary model for the confidence index, server notification function) and treat it as a
required value (missing → incomplete hour).

**Alternatives considered**: `lifted_index` (not available on all endpoints, less familiar to
pilots); `weather_code` thunderstorm codes (describe observed/forecast weather type, coarse,
and not a risk measure).

## R3. Is the 1000 J/kg threshold supported by an admissible source? (FR-010a)

**Finding**:

- Library: full-text search of the 40 PDFs in `courses/` finds no mention of CAPE or J/kg;
  thunderstorms are taught through observable signs (cumulus congestus, cumulonimbus, anvil).
- Official FFVL document: **"Canicule, vague de chaleur et vol libre"**, FFVL Commissions
  Nationales Sécurité et Technique, federation.ffvl.fr, 2026-07-31 (read through the Internet
  Archive copy of 2026-08-24, the site blocks automated access). It describes CAPE as the
  measure of available convective energy and, in a worked example on a take-off, treats a CAPE
  "dépassant largement la valeur de 1000" (with strong gusts and no cloud) as a sign of brutal
  aerology and explosive convection, advising to take off very early or not fly. It also links
  a very high CAPE to explosive thunderstorm development.

**Decision** (owner chose to look for an official source first, option C): keep
`STORM_CAPE_THRESHOLD = 1000` J/kg and cite this FFVL article in the constant's comment and in
`DOCUMENTATION.md`.

**Nuance recorded**: the FFVL uses 1000 as a reference value in an example, not as a formal
flying limit; the reminder shown to pilots (FFVL-sourced estimate, confirm on site) states this
honestly. Any change of value is a spec change.

**Alternatives considered**: a lower, unsourced value (rejected, Principle III); `lifted_index`
(no official reference found).

## R4. Sharing the evaluation with the server function (FR-011, FR-012)

**Finding**: `functions/` is a separate CommonJS package (Node 20) deployed on its own; it cannot
import files from `js/`. It already relies on a manual copy of `sites_data.json`. Its
`isFlyable` is a hand-written simplification with the same flaws as the client.

**Decision**: make `js/weatherScoring.js` and its imports (`js/utils/geo_utils.js`,
`js/utils/i18n.js`, `js/i18n/fr.js` — the last two since R5) self-contained ES modules with no
browser dependency, and copy them into `functions/shared/` as `.mjs` with a small Node script (`scripts/sync_functions_shared.mjs`),
run by a `predeploy` hook in `firebase.json`. `functions/index.js` loads them with dynamic
`import()`. A unit test fails if the copies differ from the sources (also covers the existing
`sites_data.json` copy).

**Rationale**: one implementation, identical outcomes by construction (FR-012), no build step
for the web app (Principle VII), drift caught by CI (Principle IV).

**Alternatives considered**: converting `functions/` to ESM and importing `../js` (not deployed:
Firebase uploads only `functions/`); an npm workspace package (heavier tooling for two files);
keeping two implementations with shared tests (drift remains possible).

## R5. Where do French texts live? (Language constraint)

**Finding**: no strings module exists. Verdict reasons are French literals inside
`weatherScoring.js`, and `sites.js` picks colours by comparing those literals
(`status.reason === 'Mauvaise orientation'`).

**Decision**: the scoring returns stable **codes** (`reasonCode`, `missing[]`) plus the existing
`reason` text for compatibility; texts come from a new `js/i18n/fr.js` catalogue through a tiny
`t(key, params)` helper (`js/utils/i18n.js`). Views choose colours from codes, never from text.
Only strings touched by this feature move to the catalogue.

**Rationale**: the server needs outcomes, not French text; codes make colour logic robust;
starts the strings module the constitution requires without a big-bang migration.

## R6. Equipment ("hardware") mode reads storage inside the scoring (audit C5)

**Decision**: since this feature rewrites the scoring function, `SitesService` reads the
pilot's wings and passes them in `userPreferences.wings`; the scoring stays pure (Principle
VIII; constitution rule "code touched by a change is brought into compliance").

## R7. Constitution rule for touched code: decision reminder (audit A4)

**Finding**: FR-010b adds a reminder to every verdict display. Principle II also requires, on
the same displays, that the decision belongs to the pilot and must be checked on site.

**Decision**: a single reminder line covers both: "Avis basé sur des prévisions, risque d'orage
estimé : la décision vous appartient, vérifiez sur place." (exact text in the catalogue).
Showing the model, forecast time and model disagreement (A6) stays in its own specification;
see Complexity Tracking in the plan.
