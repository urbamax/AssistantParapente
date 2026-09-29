# Contract: Site Text Rendering (`js/core/security.js`)

## `renderSiteText(text) → string (HTML)`

Pure, no DOM. Input: raw text of a site detail. Output: HTML safe to insert.

1. Escape the whole text with `escapeHTML`.
2. Restore only (case-insensitive):
   - `<br>`, `<br/>`, `<br />` → `<br>`
   - `<b>…</b>` (balanced, non-greedy) → `<b>…</b>`
   - `<a href="URL">…</a>` with `URL` starting with `http://` or `https://` (no whitespace,
     quotes or angle brackets) → `<a href="URL" target="_blank" rel="noopener noreferrer">…</a>`
   - `<a …>TEXT</a>` with any other address or attributes → `TEXT` (text kept, no link)
3. Everything else stays escaped, i.e. visible as text.

Guarantee (tested on the whole database and ≥ 10 attack patterns): the resulting element's
`textContent` equals the source text with only the restored tags removed; no element other than
`br`, `b`, `a[href^="http"]` is ever produced; no attribute other than `href`, `target`, `rel`.

## `safeHttpUrl(url) → string`

Returns `url` when `new URL(url)` succeeds with protocol `http:` or `https:`, otherwise `''`.

## Python `repair_cp1252(text)` (`scripts/text_repair.py`)

Replaces each character U+0080–U+009F that Windows-1252 defines by its Windows-1252 meaning;
characters Windows-1252 leaves undefined (0x81, 0x8D, 0x8F, 0x90, 0x9D) are removed. Other text
unchanged. Idempotent.
