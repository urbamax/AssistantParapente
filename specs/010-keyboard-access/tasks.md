# Tasks: Keyboard Access

- [ ] T001 Create `tests/core/keyboard_access.test.js` (node): scan `index.html`, `components/*.html`, `js/**/*.js` for `data-action` on non-focusable tags without `href`; each must have `role="button"` and `tabindex="0"`, except `timeline-hour-dot` which must have `aria-hidden="true"` (FR-001, FR-004, FR-005)
- [ ] T002 In `tests/core/events.test.js` (happy-dom): Enter and Space on a `div[role=button][data-action]` dispatch once; Space `preventDefault`; Enter on a native `button[data-action]` is not dispatched twice by the keydown delegate
- [ ] T003 In `tests/e2e/keyboard.spec.js`: focus the footer « Mentions Légales » and press Enter → legal modal visible; on the sites screen focus a tag/type filter chip and press Space → filter applied; open quiz stats and activate a mastery filter with Enter
- [ ] T004 Run T001–T003; confirm they fail
- [ ] T005 Implement the keydown delegate in `js/core/events.js`
- [ ] T006 Add the attributes in `index.html`, `components/header.html`, `components/footer.html`, `js/views/quiz.js`, `js/views/sites.js`, `js/views/logbook.js`; `aria-hidden="true"` on timeline bars
- [ ] T007 Add `[role="button"][tabindex="0"]:focus-visible` outline in `css/components.css`
- [ ] T008 Run everything (`npm test`, `npm run test:e2e`, lint, format, typecheck, build); update `DOCUMENTATION.md` (event delegation: keyboard rule)
