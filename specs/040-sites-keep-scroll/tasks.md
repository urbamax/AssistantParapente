# Tasks: Sites Screen Keeps Its Scroll Position

- [ ] T001 Write `tests/views/sites_keep_scroll.test.js`: `filterByTag` and `filterByType` apply the filter, update badges and markers, and do not call `scrollTo` on `#sites-screen`; `scrollToTop` still does; run it and see it fail
- [ ] T002 Remove the `scrollTo` calls at the end of `filterByTag` and `filterByType` in `js/views/sites.js`; test green
- [ ] T003 Verify in the browser (scroll 1200 px, touch a wind tag and a type badge, position kept), then `npx vitest run`, lint, format check, typecheck, `npm run verify`
