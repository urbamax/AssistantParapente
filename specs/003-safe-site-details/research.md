# Research: Safe and Faithful Site Details

**Feature**: [spec.md](spec.md) | **Date**: 2026-09-29

## R1. What markup does the site data really contain?

**Finding** (`js/data/sites_data.json`, 1 983 displayed sites): 6 fields contain `<`:

| Site | Field | Content |
|------|-------|---------|
| COL DES LIMOUCHES — COL DU TRALLU (`col-des-limouches-728`) | reglementation | `<b>…</b>` (intended bold) |
| MATHAY — Belvédère (`mathay-13452`) | restrictions | `<<corniches calcaires du Doubs>>` (text, lost today) |
| NOTRE-DAME-DE-LA-MER ×2 (`-13610`, `-1098`) | restrictions, observations | `<br>`, `<a href="https://…">…</a>` (intended) |
| SORGIA — Les Prés Gelés (`sorgia-602`) | restrictions | `<Les terrains concédés …` (text, lost today) |

Quiz CSV files (`qcm_ffvl.csv`, `qcm_ffvl_explanations.csv`): 0 tags.

**Decision**: an allowlist renderer for site details — escape everything, then restore only
`<br>`, `<b>…</b>` and `<a href="http(s)://…">…</a>` (link rendered with `target="_blank"
rel="noopener noreferrer"`). Any other markup stays visible as text; a link with a non-`http(s)`
address keeps its text but is not a link. Quiz texts: plain `escapeHTML`.

**Alternatives considered**: plain text everywhere (loses the charter and decree links pilots
need); a DOM-based sanitizer / DOMPurify (new dependency or DOM-only code, while the renderer must
stay a pure string function testable anywhere); `textContent` rendering (would require rewriting
the card templates).

## R2. Broken characters

**Finding**: 246 string fields contain C1 control characters `0x80 0x85 0x91 0x92 0x93 0x94 0x95
0x96 0x97 0x9c`: Windows-1252 bytes decoded as Latin-1 upstream (e.g. `\x92` = ’).

**Decision**: `repair_cp1252(text)` in a new `scripts/text_repair.py`, mapping each C1 character
to its Windows-1252 meaning (€ … ‘ ’ “ ” • – — œ and the other defined ones); used by the
`clean()` of `scripts/import_ffvl_sites.py` and `scripts/refresh_paraglidingearth.py` (FR-007),
and applied once to `js/data/sites_data.json` (then `npm run sync:functions` for the server copy).
A Vitest data test fails if any C1 character remains (runs in CI). A `unittest` file covers the
Python helper (`python3 -m unittest`, stdlib only; not in CI).

## R3. Site links

**Decision**: `safeHttpUrl(url)` in `js/core/security.js` returns the URL only when it parses as
`http:`/`https:`, else `''`; the « Fiche FFVL » buttons (map popup and card) are rendered only
for a non-empty result, with the URL escaped.

## R4. Line breaks from `\n`

**Finding**: details also contain `\n` (normalised by `clean()`), collapsed into spaces today.

**Decision**: unchanged (FR-008: sites without markup look exactly as before).
