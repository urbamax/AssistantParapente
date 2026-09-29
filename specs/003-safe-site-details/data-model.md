# Data Model: Safe and Faithful Site Details

No new entity or field. Changes to existing data:

- **Site detail fields** (`dangers`, `restrictions`, `observations`, `acces_topo`,
  `secours_acces`, `aerologie_ideale`, `reglementation`, `praticabilite`, `conventionnement`,
  `structure_gestionnaire`): same values, rendered through `renderSiteText`; broken Windows-1252
  characters repaired in `js/data/sites_data.json` (all string fields, not only these).
- **`url`** (FFVL page): used only through `safeHttpUrl`.
- **Quiz texts** (question, choices, explanation): unchanged data, rendered escaped.
