# Contract: Verdict Display States

Applies to every place a verdict is shown: map marker and popup, the site's card in the list
(weather row, slots line, 120-hour timeline bar, expanded details), favourites comparison table.
There is no separate "site sheet" component: the expanded list card plays that role. Texts live in
`js/i18n/fr.js`; the wording below is indicative and final in the catalogue.

| Outcome | Marker / bar colour | Label | Extra |
|---------|--------------------|-------|-------|
| `loading` | grey (unchanged) | « Chargement… » | — |
| `incomplete` | hollow marker (transparent core, 2 px dashed `#94a3b8` border, « ? » glyph) / hatched bar; distinct from the filled grey loading marker and from night | « Prévision incomplète » | Detail names every missing value: « Indisponible : rafales, direction du vent » |
| `unflyable` | unchanged per reason code (night, rain, orientation, other) | unchanged | New reason `STORM_RISK`: « Risque d'orage » |
| `flyable` + `ORIENTATION_UNKNOWN` | yellow (existing warning colour), no pulse | « Orientation du décollage inconnue : à vérifier » | No score, no Excellent/Bon/Passable |
| `flyable` (known orientation) | unchanged | unchanged (score + rating) | — |

## Rules

- Colours and icons are chosen from `status` / `reasonCode`, never by comparing French text.
- A missing value is displayed as « — », never as `null`, `NaN` or `0`
  (e.g. « Vent — km/h (raf. —) »).
- Every display showing a flyable or unflyable verdict also shows the reminder
  (FR-010b + Principle II), once per map popup, list card and comparison table (plus next to the legend):
  « Avis basé sur des prévisions, risque d'orage estimé : la décision vous appartient,
  vérifiez sur place. »
- Slots line: when the window has no complete hour → « Aucune prévision fiable pour ce site »
  instead of « Aucun créneau favorable… » (FR-009).
- Comparison table "Confiance" column: « Indisponible » when either model is incomplete.
- Legend gains an entry « Prévision incomplète ».
- All dynamic text is inserted with `textContent` or `escapeHTML()` (Principle VI).
