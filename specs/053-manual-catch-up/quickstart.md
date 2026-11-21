# Quickstart: Checking the Manual Catch-Up

## Automated

```bash
npx vitest run tests/views/manual_content.test.js tests/views/manual_by_role.test.js tests/views/static_texts.test.js
```

Expected: all green. Before the text change, `manual_content.test.js` fails on every required
and forbidden phrase of [contracts/manual-content.md](contracts/manual-content.md).

```bash
npx playwright test tests/e2e/manual.spec.js
```

Expected: the manual opens; Sécurité shows four tabs and the Fiche ICE part; Général shows
install, feedback and Discord.

Full check before pushing (same as CI):

```bash
npm run verify
```

## In the app (dev preview)

1. Signed out: open « Mode d'emploi », read every tab. No mention of calculated weather or
   flying sites; every topic in the contract is found in its tab.
2. With a `beta` account: Calcul Volabilité is visible and matches the app.
3. With the `owner` account: Sites de vol is visible and matches the screen.
4. From a screen (logbook, safety, quiz…), open the contextual manual: it opens on the matching tab.
5. Light and dark themes; keyboard only (Tab, Enter, Escape).

## Audit

`audit.md` has one row per manual part with its result and evidence (SC-001).

## After deployment (owner only)

1. Review the updated Discord cards (public parts only), then republish `#guide-utilisation`
   with the local tooling.
2. Approve the notice text, then post it to `#mises-a-jour`.
