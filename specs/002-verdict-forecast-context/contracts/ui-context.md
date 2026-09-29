# Contract: Forecast Context on Verdict Displays

Applies to the map popup, the site card in the list (weather block) and the favourites comparison
table — the same displays as the spec 001 reminder. Texts in `js/i18n/fr.js`; wording indicative.

## Context line (under the verdict, before the spec 001 reminder)

« {Modèle} · récupérée à {HH h MM}{ · run {composant} de {HH h}} »

- `{Modèle}`: `WeatherModel.label`.
- Run part only when `runAt` is known (FR-003).
- Times in local time; prefix the day (« hier », « lun. ») when not today.
- Comparison table: one context line above the table when all favourites share the same
  provenance, otherwise per row.

## Staleness (retrieved > 3 h ago)

The context line gets class `forecast-context--stale` and the text
« Prévision récupérée il y a {âge} — peut être dépassée » plus a button « Actualiser »
(`data-action="SitesrefreshWeather"`). On failure: « Actualisation impossible : {raison} ».
Age format: « 3 h 20 », « 1 j 2 h ». Updated every minute without re-render of the whole list.

## Model agreement (sites in the radius + favourites)

| State | Display |
|-------|---------|
| `agree` | « ✓ {second modèle} d'accord » |
| `disagree` | « ⚠ {second modèle} n'est pas d'accord : {verdict du second modèle} » (warning colour, text + icon) |
| `unavailable` | « Comparaison {second modèle} indisponible » (muted) |
| `not_compared` | nothing |

Shown for the displayed hour (`forecastOffset`), recomputed when the slider moves.

## Default location notice

While `userLocation.isDefault`: « Recherche centrée sur Boulogne-sur-Mer — activez le GPS ou
saisissez une adresse. » near the radius control.

## Radius control

Slider 10–200 km, step 10, default 50; label « {n} km »; the « Illimité » label disappears.
