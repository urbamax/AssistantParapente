# Quickstart: Validating Forecast Context Next to Every Verdict

**Contracts**: [ui-context](contracts/ui-context.md) | **Data model**: [data-model.md](data-model.md)

## 1. Automated checks (all must pass before merge — constitution Principle IV)

```bash
npm run lint && npm run format:check && npm run typecheck
npm test          # provenance, staleness, agreement per hour, radius/location, migrations
npm run test:e2e  # context line, stale warning + refresh, agreement, Boulogne notice, radius max
npm run build
```

Expected coverage: SC-001–SC-008 (see spec). Request counting: a unit test asserts that the
primary and secondary requests only contain sites within the radius plus favourites.

## 2. Manual check

1. `python3 -m http.server 8000`, open `http://localhost:8000/?mode=SITES` in a fresh profile
   (no saved preferences), GPS refused.
   - Expected: radius 50 km, notice « Recherche centrée sur Boulogne-sur-Mer… », about 21 sites.
2. Open a popup and a site card: model, retrieval time and run time are shown; the reminder from
   spec 001 is still there.
3. Add two favourites and open « Comparer »: agreement per site; move the slider and see it change.
4. Move the radius slider to the end: it stops at « 200 km »; no « Illimité ».
5. In the console, set the provenance `fetchedAt` of the loaded forecasts to 4 hours ago
   (debug only) and wait one minute: every verdict shows the staleness warning; « Actualiser »
   reloads and removes it.
6. Select « Sélection automatique (Open-Meteo, multi-modèles) »: no run time is shown.
7. In the Network panel, count Open-Meteo locations requested: only sites in the radius +
   favourites, for each of the two models.
