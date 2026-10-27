# Tasks: Map Marker Jumps to Site Card

- [x] T001 Add unit test in `tests/views/sites_keep_scroll.test.js` verifying that clicking a map marker scrolls `#site-card-<id>` into view and adds `.highlight-glow`
- [x] T002 Add `id="site-card-${site.id}"` to `.site-card` in `js/views/sites_list.js` and call `this.jumpToSiteCard(site.id)` on marker click in `js/views/sites_map.js`
- [x] T003 Update render snapshots in `tests/views/__snapshots__/sites_render.test.js.snap` and run `npx vitest run`, lint, format check, and typecheck
