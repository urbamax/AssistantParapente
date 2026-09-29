# Research: Last Forecast Available Offline

## R1. Where to store

**Decision**: IndexedDB, existing `keyval` store of `AssistantParapente_IDB` (`js/services/idb_storage.js`),
one record per site: key `forecast:{siteId}`, value `{ siteId, modelKey, fetchedAt, forecasts }`.
New helpers `setValues(entries)` (one transaction), `getValuesByPrefix(prefix)`, `deleteValues(keys)`;
all resolve to empty results when IndexedDB is unavailable (existing fallback pattern).

**Rationale**: size (default 50 km ≈ 20–150 sites × up to 169 hours) exceeds what LocalStorage
comfortably holds (~5 MB) in the Alps at 200 km; IndexedDB already stores the logbook.

**Alternatives**: LocalStorage (quota), service-worker caching of Open-Meteo responses (the
response would be replayed as if fresh: loses the original retrieval time and hides the offline state).

## R2. When to save and restore

- Save after each successful primary fetch, deferred (`setTimeout 0`) so it never delays display;
  errors are logged and ignored (FR-007).
- Restore when a fetch fails (network error, 429 cooldown, provider error) and no forecast is in
  memory; past hours are dropped by comparing each hour's local time string with the current hour;
  records with no future hour are deleted (FR-005). `state.forecastSource = 'saved'`,
  `state.forecastProvenance` rebuilt from records, secondary forecasts cleared (comparison
  unavailable, FR-006).

## R3. Offline vs provider failure wording

`navigator.onLine === false` → « Hors ligne », otherwise « Service météo indisponible ». Both say
the forecast shown is the one saved on the device and when it was retrieved.
