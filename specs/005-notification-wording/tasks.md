# Tasks: Honest Favourite-Site Notification

**Tests**: REQUIRED (constitution Principle IV).

- [X] T001 [US1] In `tests/functions/notifications.test.js`, test `buildNotification(site, weather, timeMs)` from `functions/evaluate.mjs`: title « Mont Test : conditions favorables annoncées », never « volable »; body contains « à 14 h » for 12:00 UTC in summer (Europe/Paris), « S 15 km/h (rafales 20) », « Sélection automatique (Open-Meteo, multi-modèles) » and ends with « Avis basé sur des prévisions : la décision vous appartient, vérifiez sur place. »; missing name → « Site favori »; missing values → « — »; body ≤ 240 characters; `buildHourlyForecast` returns `timeMs` of the selected hour
- [X] T002 [US1] Run `npx vitest run tests/functions/`; confirm T001 fails
- [X] T003 [US1] Add `notification.title`, `notification.body`, `notification.reminder`, `notification.defaultSite` to `js/i18n/fr.js`; implement `buildNotification` and `timeMs` in `functions/evaluate.mjs` (import `t` from `./shared/i18n.mjs`); use it in `functions/index.js`; run `npm run sync:functions`
- [X] T004 [US1] Run `npm test`, `npm run lint`, `npm run format:check`, `npm run typecheck` (configs `eslint.config.mjs`, `jsconfig.json`); all green
