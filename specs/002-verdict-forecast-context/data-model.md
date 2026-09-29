# Data Model: Forecast Context Next to Every Verdict

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

## WeatherModel (configuration, `js/data/weather_config.js`)

| Field | Example | Notes |
|-------|---------|-------|
| `key` | `meteofrance` | Saved in preferences |
| `label` | « AROME (Météo-France) » | From the strings catalogue |
| `metaModel` | `meteofrance_arome_france_hd` \| `null` | Open-Meteo metadata id; `null` = no run shown |
| `runLabel` | « AROME » | Component named next to the run time |

Keys: `meteofrance`, `iconeu`, `icon`, `ecmwf`, `gfs`, `best_match` (replaces `meteoblue`).

## ForecastProvenance (per site, `SitesService.state.forecastProvenance[siteId]`)

| Field | Type | Rule |
|-------|------|------|
| `modelKey` | string | Model of the primary forecast |
| `fetchedAt` | number (ms) | Original network retrieval of the chunk; unchanged when read from cache (FR-004) |
| `runAt` | number (ms) \| null | Model run from metadata; `null` when unknown (FR-003) |

Derived (never stored): `ageMs = now − fetchedAt`; `isStale = ageMs > STALE_AFTER_MS` (3 h).

## Secondary forecasts (`SitesService.state.weatherForecastsSecondary[siteId]`)

Now an **array of hours** aligned with the primary array (same index = same hour), instead of a
single "current hour" object. Plus `secondaryModelKey`.

## ModelAgreement (`getModelAgreement(site, offset)`)

`{ state: 'agree' | 'disagree' | 'unavailable' | 'not_compared', secondaryModelKey, secondaryOutcome }`

- `not_compared`: primary and secondary models are the same.
- `unavailable`: either hour missing, loading or `incomplete` (FR-012).
- `agree` / `disagree`: both outcomes are flyable/unflyable; compare `status`.
- The primary outcome is never modified (FR-011).

## Location

`SitesService.state.userLocation = { lat, lng, name?, isDefault? }`. When unset,
`DEFAULT_LOCATION` (Boulogne-sur-Mer, `isDefault: true`) is used. A GPS fix or geocoded address
replaces it.

## Site preferences (migration)

| Field | Old | New |
|-------|-----|-----|
| `radiusLimit` | default 210 (= unlimited), range 10–210 | default 50, range 10–200; ≥ 210 or missing → 50 |
| `weatherModel` | `meteoblue` possible | `meteoblue` → `best_match` |
