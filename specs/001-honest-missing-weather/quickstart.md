# Quickstart: Validating Honest Handling of Missing Weather Data

**Contracts**: [evaluation](contracts/evaluation.md), [UI states](contracts/ui-states.md)

## Prerequisites

```bash
npm ci
npx playwright install chromium
```

## 1. Automated checks (must all pass before merge — Principle IV)

```bash
npm run lint && npm run format:check && npm run typecheck
npm test                 # unit tests, incl. scoring, service aggregates, shared-copy drift
npm run test:e2e         # includes the incomplete-forecast scenario
npm run build
```

Expected: the scoring suite covers every single missing value and every combination of two
(SC-001, SC-002), unknown-orientation sites (SC-003), a reference set of complete forecasts
whose verdicts equal the pre-change results (SC-004), the storm threshold (SC-007), and the
server evaluation on the same fixtures (SC-005, SC-006).

## 2. Manual check with real data (default model)

1. `python3 -m http.server 8000`, open `http://localhost:8000/?mode=SITES`.
2. Keep the AROME model and move the forecast slider beyond ~+110 h.
   - Expected: markers and timeline bars turn to the "Prévision incomplète" appearance; no red
     "Vent hors limites" on those hours; the detail lists the missing values.
3. Open a site without take-off orientation (e.g. filter the list for a site whose sheet shows
   no orientation).
   - Expected: « Orientation du décollage inconnue : à vérifier », no score.
4. Open any popup, list card, sheet and the favourites comparison table.
   - Expected: the reminder line is present once on each.
5. Switch to GFS: incomplete hours disappear (GFS covers 8 days), verdicts appear normally.

## 3. Server function (no deployment needed)

```bash
node scripts/sync_functions_shared.mjs   # regenerates functions/shared/
npm test -- functions                    # server evaluation tests
```

Expected: no "becomes flyable" outcome from incomplete fixtures or unknown-orientation sites;
same outcomes as the app on the shared fixtures.
