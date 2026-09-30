# Tasks: No Third-Party Request Before Consent

- [X] T001 Download (owner-approved) Leaflet 1.9.4 and Remix Icon 3.5.0 from the npm registry, check their SRI hashes against `index.html`, copy the needed files and licences to `vendor/`; download Inter (latin woff2) and its OFL licence to `vendor/inter/`, the two logos to `img/logos/`
- [X] T002 Write `tests/core/third_party.test.js` (no third-party load in `index.html` / components, hosted files match the audited SRI hashes, every `target="_blank"` has `noopener noreferrer`, no `measurementId`) and `tests/e2e/privacy.spec.js` (no request to the five hosts on home and sites pages; font, Leaflet and logos loaded); run them and see them fail
- [X] T003 Implement: `css/fonts.css`, local links in `index.html`, CSP tightened, footer logos + `rel`, FFVL button icon, `measurementId` removed, `vendor` in `STATIC_PATHS` (`vite.config.mjs`) and in the precache list (`sw.js`)
- [X] T004 Run `npm test`, `npm run test:e2e`, lint, format, typecheck, `npm run build` (check `dist/`), browser check
- [X] T005 Update `DOCUMENTATION.md`
