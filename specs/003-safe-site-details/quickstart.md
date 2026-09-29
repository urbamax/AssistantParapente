# Quickstart: Validating Safe and Faithful Site Details

## 1. Automated checks

```bash
npm run lint && npm run format:check && npm run typecheck
npm test            # renderer, safe URLs, whole-database text check, no broken characters, quiz escaping
npm run test:e2e    # SORGIA and NOTRE-DAME-DE-LA-MER details in the browser
python3 -m unittest discover -s tests/scripts   # repair_cp1252 (stdlib only)
npm run build
```

## 2. Manual check

`npx http-server . -p 8001 -c-1`, open `http://localhost:8001/?mode=SITES`, add SORGIA — Les Prés
Gelés, MATHAY — Belvédère and NOTRE-DAME-DE-LA-MER — Les Coursières to favourites (they stay
visible whatever the radius), expand « Voir plus d'infos »:

- SORGIA: « <Les terrains concédés… » visible.
- MATHAY: « <<corniches calcaires du Doubs>> » visible.
- NOTRE-DAME-DE-LA-MER: line breaks, working links (new tab), proper apostrophes and bullets.
