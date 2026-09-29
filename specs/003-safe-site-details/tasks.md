---
description: "Task list for safe and faithful site details"
---

# Tasks: Safe and Faithful Site Details

**Input**: `specs/003-safe-site-details/` ([plan](plan.md), [spec](spec.md), [research](research.md),
[contract](contracts/sanitizer.md), [quickstart](quickstart.md))

**Tests**: REQUIRED (constitution Principle IV): write first, run, see them fail, then implement.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [ ] T001 [P] Create `tests/core/security.test.js` importing `escapeHTML`, `renderSiteText`, `safeHttpUrl` from `js/core/security.js` (empty describe blocks filled by later tasks)
- [ ] T002 [P] Create `tests/scripts/__init__.py` (empty) so `python3 -m unittest discover -s tests/scripts` finds the Python tests

---

## Phase 2: Foundational — renderer and safe URLs (serves US1 and US2)

- [ ] T003 [P] [US2] In `tests/core/security.test.js`, test `renderSiteText` per `contracts/sanitizer.md`: keeps `<br>`, `<br/>`, `<br />`, `<b>x</b>`, `<a href="https://a.fr/p?x=1&y=2">t</a>` (→ `target="_blank" rel="noopener noreferrer"`); shows as text « <Les terrains », « <<corniches>> », « < 25 km/h », unclosed `<b>`; at least 10 attack patterns produce no element other than `br`/`b`/`a[href^=http]` and no attribute other than `href`/`target`/`rel` (parse the output with `document.createElement('div').innerHTML`): `<script>`, `<img src=x onerror=…>`, `<svg onload=…>`, `<a href="javascript:…">`, `<a href="data:…">`, `<a href="https://x" onclick="…">`, `<b onmouseover=…>`, `<iframe>`, `"><script>`, `<a href='https://x'>` (single quotes), `<A HREF="HTTPS://X">` (case); a non-http link keeps its text without link; `null`/`undefined` → `''`
- [ ] T004 [P] [US2] In `tests/core/security.test.js`, test `safeHttpUrl`: `http(s)` kept, `javascript:`, `data:`, relative, empty, malformed → `''`
- [ ] T005 [US2] Run `npx vitest run tests/core/security.test.js`; confirm T003–T004 fail
- [ ] T006 [US2] Implement `renderSiteText` and `safeHttpUrl` in `js/core/security.js` exactly as `contracts/sanitizer.md`
- [ ] T007 [US2] Run `npx vitest run tests/core/security.test.js`; all pass

---

## Phase 3: User Story 1 - Full safety text visible (Priority: P1) 🎯 MVP

**Independent Test**: whole-database text equality; SORGIA / MATHAY / NOTRE-DAME-DE-LA-MER in the browser.

- [ ] T008 [P] [US1] Create `tests/data/sites_data_text.test.js`: for every site of `js/data/sites_data.json` and every detail field (`dangers, restrictions, observations, acces_topo, secours_acces, aerologie_ideale, reglementation, praticabilite, conventionnement, structure_gestionnaire`), `div.innerHTML = renderSiteText(v)` then `div.textContent` equals `v` with only the restored tags removed (SC-001)
- [ ] T009 [P] [US1] Create `tests/views/sites_details.test.js`: `SitesView.buildSiteCardHtml(...)` for `sorgia-602`, `mathay-13452`, `notre-dame-de-la-mer-1098` (loaded from `js/data/sites_data.json`) contains « <Les terrains concédés » / « <<corniches calcaires du Doubs>> » as text, the charter link with `rel="noopener noreferrer"`; `col-des-limouches-728` keeps its bold (`<b>`); a site with `url: 'javascript:alert(1)'` renders no « Fiche FFVL » link; `buildMapPopupHtml` likewise
- [ ] T010 [US1] In `tests/e2e/sites_flow.spec.js`: with saved favourites `sorgia-602` and `notre-dame-de-la-mer-1098` (favourites are always shown), expand SORGIA's card and « Voir plus d'infos »: « <Les terrains concédés » is visible; NOTRE-DAME-DE-LA-MER shows a link to `thermiquefrancilien.org` with `target="_blank"` and a proper apostrophe « l’objectif » (US3, after T022)
- [ ] T011 [US1] Run `npx vitest run tests/data/sites_data_text.test.js tests/views/sites_details.test.js` and `npx playwright test tests/e2e/sites_flow.spec.js --project=chromium`; confirm T009–T010 fail (T008 passes: it tests the renderer on real data)
- [ ] T012 [US1] In `js/views/sites.js`, render the 10 detail fields (around lines 2289–2406) with `renderSiteText(site.<field>)` and the two « Fiche FFVL » links (around lines 827 and 2217) only when `safeHttpUrl(site.url)` is non-empty, with the URL escaped
- [ ] T013 [US1] Run `npm test` and `npx playwright test tests/e2e/sites_flow.spec.js --project=chromium`; T008–T010 pass

---

## Phase 4: User Story 2 - Quiz texts shown as text (Priority: P1)

- [ ] T014 [P] [US2] Create `tests/views/quiz_escaping.test.js`: with a question whose text, choices and explanation contain `<img src=x onerror=…>`, `QuizView.showAnswerFeedback`, `renderStats`, `renderExamHistory` and `renderExamResults` (`js/views/quiz.js`) produce no `img` element and show the markup as text
- [ ] T015 [US2] Run `npx vitest run tests/views/quiz_escaping.test.js`; confirm it fails
- [ ] T016 [US2] In `js/views/quiz.js`, wrap with `escapeHTML` the insertions at lines ~1045 (`qObj.explication`), ~1067 (`displayText`), ~1258 (`opt.text`), ~1266 (`q.question`), ~1281 (`expl`), ~1572 (`result.question.explication`), ~1687 (`c.text`)
- [ ] T017 [US2] Run `npm test`; T014 passes

---

## Phase 5: User Story 3 - Broken characters repaired (Priority: P2)

- [ ] T018 [P] [US3] In `tests/data/sites_data_text.test.js`, add: no string field of `js/data/sites_data.json` or `functions/sites_data.json` contains a character U+0080–U+009F (SC-003)
- [ ] T019 [P] [US3] Create `tests/scripts/test_text_repair.py` (`unittest`): `repair_cp1252('l\x92objectif')` → `l’objectif`; `\x95`→`•`, `\x85`→`…`, `\x80`→`€`, `\x9c`→`œ`, `\x96`→`–`, `\x97`→`—`, `\x93\x94`→`“”`; undefined `\x81` removed; plain text unchanged; idempotent; `None` → `None`
- [ ] T020 [US3] Run `npx vitest run tests/data/sites_data_text.test.js` and `python3 -m unittest discover -s tests/scripts`; confirm T018–T019 fail
- [ ] T021 [US3] Create `scripts/text_repair.py` with `repair_cp1252`; import it in `clean()` of `scripts/import_ffvl_sites.py` and `scripts/refresh_paraglidingearth.py`
- [ ] T022 [US3] Apply `repair_cp1252` once to every string field of `js/data/sites_data.json` (keep `ensure_ascii=False, indent=2`, trailing newline, key order), then `npm run sync:functions`
- [ ] T023 [US3] Run `npm test` and `python3 -m unittest discover -s tests/scripts`; all pass

---

## Phase 6: Polish

- [ ] T024 [P] Update `DOCUMENTATION.md` (security policy: `renderSiteText` for data with limited formatting, `safeHttpUrl` for addresses; data pipeline: `repair_cp1252`)
- [ ] T025 Run `npm run lint`, `npm run format:check`, `npm run typecheck` (configs `eslint.config.mjs`, `.prettierrc.json`, `jsconfig.json`), `npm test`, `npm run test:e2e` (`playwright.config.js`, Chromium + WebKit), `npm run build` (`vite.config.mjs`); all green
- [ ] T026 Follow `specs/003-safe-site-details/quickstart.md` §2 in the browser (light and dark)

## Dependencies

Phase 2 → US1 → US2 (quiz) → US3 → Polish. US2 quiz (T014–T017) and US3 (T018–T023) touch
different files and could run in parallel after Phase 2.
