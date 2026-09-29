# Tasks: Opened Courses and Viewed Map Offline

**Tests**: REQUIRED (constitution Principle IV).

- [X] T001 [P] [US1] Create `tests/e2e/offline_storage.spec.js` (service worker enabled): load `/`, wait for `navigator.serviceWorker.ready` and a controller; `page.goto` a course PDF (e.g. `courses/TREUIL/…/1-fh-check-list.pdf`, path from `js/data/courses_data.js`) online; set the context offline; `page.evaluate(fetch(pdfUrl))` returns status 200 with the full byte length, also with a `Range: bytes=0-99` header; a never-opened PDF fetch offline rejects or returns a non-HTML error (never `index.html`)
- [X] T002 [P] [US2] In `tests/e2e/offline_storage.spec.js`: open the sites screen online (map shown); wait until `caches.open('parapente-tiles-v1')` has at least one entry; offline, `fetch(oneStoredTileUrl, { mode: 'cors' })` returns 200; skip the test only if the Esri tile server is unreachable at start
- [X] T003 Run `npx playwright test tests/e2e/offline_storage.spec.js`; confirm T001–T002 fail
- [X] T004 [US1] In `sw.js`: `COURSE_CACHE`, `TILE_CACHE`, `TILE_CACHE_MAX = 1500`, `RUNTIME_CACHES`; activation deletes only caches that are neither `CACHE_NAME` nor runtime caches (FR-006); course PDF strategy per plan, placed before the navigation branch (FR-001–FR-003)
- [X] T005 [US2] In `sw.js`: tile strategy for `server.arcgisonline.com` per plan with trimming (FR-004, FR-005); in `js/views/sites.js` tile layer option `crossOrigin: true`
- [X] T006 Run `npx playwright test` (all, Chromium + WebKit) and `npm test`; all pass
- [X] T007 Update `DOCUMENTATION.md` (service worker: runtime caches for opened courses and viewed map tiles, limit, kept across versions); run lint, format, typecheck, build
