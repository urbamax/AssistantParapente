# Research: Forecast Context Next to Every Verdict

**Feature**: [spec.md](spec.md) | **Date**: 2026-09-29

## R1. How many requests does a page load cost?

**Finding**: Open-Meteo counts one API call per location in a multi-location request (free tier:
~600/min, 5 000/hour, 10 000/day). Sites within a radius, from `js/data/sites_data.json`
(1 983 displayed sites):

| Centre | ≤ 50 km | ≤ 100 km | ≤ 200 km | all |
|--------|--------:|---------:|---------:|----:|
| Boulogne-sur-Mer | 21 | 47 | 112 | 1 983 |
| Annecy | 147 | 380 | 738 | 1 983 |
| Grenoble | 124 | 365 | 786 | 1 983 |

Today the default radius is "unlimited" (value 210) **and** the radius filter is skipped when no
position is known (`getGeoFilteredSites`: `if (userLocation && radiusLimit < 210)`), so a first
load requests ~1 983 locations; two or three loads in an hour exceed the hourly limit (observed:
HTTP 429 on 2026-09-29). Adding a second model for every displayed site would double this.

**Decision**: default radius 50 km, maximum 200 km, fallback centre Boulogne-sur-Mer, so the filter
always applies. Worst realistic case (200 km in the Alps, both models): ~1 600 calls per load,
which stays under the hourly limit for two loads and is served from the 10-minute cache
afterwards; the default case (50 km) costs 20–300 calls with both models.

**Alternatives considered**: keeping "unlimited" with a warning (owner rejected: it alone exhausts
the quota); fetching weather lazily per visible card (larger refactor, loses the list sorting by
flyable hours).

## R2. Fallback position when no GPS / address

**Decision**: `DEFAULT_LOCATION = { lat: 50.7264, lng: 1.6147, name: 'Boulogne-sur-Mer', isDefault: true }`
(town centre), defined once in `js/data/weather_config.js`, used by `SitesService` whenever
`userLocation` is unset. A GPS fix or a geocoded address replaces it; the UI shows a notice while
`isDefault` is true (owner decision, spec FR-017).

## R3. Model run time (FR-003)

**Finding**: Open-Meteo publishes per-model metadata at
`https://api.open-meteo.com/data/{model}/static/meta.json`, CORS-enabled
(`access-control-allow-origin: *`), with `last_run_initialisation_time` (UTC seconds) and
`update_interval_seconds`. Observed 2026-09-29:

| App model key | Endpoint used | Metadata model | Run | Update interval |
|---------------|---------------|----------------|-----|-----------------|
| `meteofrance` | `meteofrance` (seamless AROME + ARPEGE) | `meteofrance_arome_france_hd` | 06 UTC | 3 h |
| `iconeu` | `dwd-icon` + `icon_eu` | `dwd_icon_eu` | 06 UTC | 3 h |
| `icon` | `dwd-icon` + `icon_global` | `dwd_icon` | 06 UTC | 6 h |
| `ecmwf` | `ecmwf` | `ecmwf_ifs025` | 00 UTC | 6 h |
| `gfs` | `gfs` (seamless) | `ncep_gfs025` | 00 UTC | 6 h |
| `best_match` (was `meteoblue`) | `forecast` (automatic selection) | — | not shown | — |

Seamless endpoints blend models (e.g. AROME then ARPEGE beyond ~48 h); the run shown is the one
of the high-resolution component and is labelled with that component's name
(« run AROME de 08 h »). The automatic multi-model selection has no single run: nothing is shown
(FR-003 "nothing MUST suggest a run time").

**Decision**: one metadata request per model and per page load (cached 30 min, failures ignored
silently: no run time is then shown).

**Alternatives considered**: deducing the run from the forecast's first hour (wrong: Open-Meteo
returns data from 00:00 local regardless of run).

## R4. Retrieval time and cache (FR-002, FR-004)

**Finding**: `fetchWeatherForSites` already stores `{ timestamp, results }` per chunk URL in
`_weatherCache` (TTL 10 min); the timestamp is the original network retrieval.

**Decision**: each site's forecasts get `provenance = { modelKey, fetchedAt, runAt }`, with
`fetchedAt` = the chunk's cache timestamp (never `Date.now()` when read from cache). Different
chunks may have different `fetchedAt`; each site shows its own.

## R5. Staleness (FR-005–FR-007)

**Decision**: `STALE_AFTER_MS = 3 h` (owner, Q2). A 60-second timer in `SitesView` refreshes only
the age labels and staleness flags (no re-fetch, no full re-render). The refresh action calls
`fetchWeatherForSites({ force: true })`, bypassing the cache; on failure (offline, 429 cooldown)
the flag stays with the reason (reuses the existing cooldown message).

## R6. Model agreement for the displayed hour (FR-009–FR-012)

**Finding**: `getModelAgreement` compares the secondary model's **current** hour
(`weatherForecastsSecondary[id]` = one hour, nearest to now) with the primary model's hour at
`forecastOffset`: wrong as soon as the slider moves. The secondary request covers favourites only,
2 days.

**Decision**: the secondary fetch returns the same hourly window and the same hour alignment as
the primary one (same `time` axis index → same `forecastOffset`), for the same site set (sites in
the radius + favourites), chunked and cached like the primary fetch, and stopped by the same 429
cooldown. `getModelAgreement(site, offset)` compares both models at `offset`; `null` (unavailable)
if either hour is missing or incomplete. Secondary model: GFS, or AROME when GFS is primary
(unchanged); agreement is not computed when both are the same.

## R7. "Meteoblue (Multi-modèle)" label (FR-008)

**Finding**: `_resolveModelEndpoint('meteoblue')` calls Open-Meteo's generic `forecast` endpoint
(automatic best-match selection); Meteoblue is never used.

**Decision**: rename the key to `best_match` and the label to « Sélection automatique
(Open-Meteo, multi-modèles) »; saved preferences holding `meteoblue` are migrated to
`best_match` when loaded (local and cloud), like the radius migration.

## R8. Favourites and the radius

**Decision**: `getGeoFilteredSites` always keeps favourite sites, whatever their distance, so the
comparison table and the pilot's favourites never disappear when the radius shrinks (spec
assumption). Weather is requested for exactly the geo-filtered set.

## R9. Preference migration (FR-018)

**Decision**: a pure helper `migrateSitePrefs(prefs)` in `SitesService` maps `radiusLimit >= 210`
(or missing) → 50 and `weatherModel === 'meteoblue'` → `best_match`; applied when loading local
preferences and when merging cloud preferences (`firebase_service.js` defaults move to 50 as well).
