# Spec 054 — One-time Discord server announcement

**Status**: Implemented
**Branch**: `feat/discord-announce-banner`
**Date**: 2026-11-21
**Availability**: all users (no role gate)

## Context

The community Discord server is open (spec 051 added the header, footer and feedback-modal links).
Pilots who never look at the header icon don't know it exists. A small, non-blocking card tells
them once, then never comes back.

## User story (P1)

As a pilot opening the app, I see once a small card announcing the Discord server, so I can join
it or dismiss it, without it ever interrupting what I'm doing.

### Acceptance criteria

- Card `#discord-announce` (an `<aside>`, not a modal), built by `js/core/discord_announce.js`,
  styled with the app's tokens (`--bg-surface`, `--text-main`, `--text-secondary`,
  `--radius-lg`) and the Discord blurple already used by spec 051; works in light and dark themes.
- Content (French, `discordAnnounce.*` in `js/i18n/fr.js`):
  - title « Assistant Parapente a son Discord »;
  - text « Pour regrouper vos retours, signaler un bug ou discuter vols et matos entre pilotes. Le
    lien reste aussi accessible en haut à droite de l'appli. »;
  - link « Rejoindre » → `https://discord.gg/z6vc8ARNk`, `target="_blank"`,
    `rel="noopener noreferrer"`;
  - close button `×` with `aria-label` « Fermer l'annonce ».
- Clicking « Rejoindre » or `×` removes the card and stores `ap_discord_banner_dismissed_v1` in
  localStorage (`StorageService.KEYS.DISCORD_ANNOUNCE_DISMISSED`). With the flag set the card is
  never built again.
- Shown 4 s after boot, and only when nothing blocks it: question series or exam
  (`#qcm-screen.active`), flight form open, any open `<dialog>` (manual, auth, settings, PWA help…),
  consent banner, update screen, course viewer, or offline. While blocked, it rechecks every 10 s
  and when the tab comes back to the foreground.
- If one of those opens while the card is on screen, CSS (`body:has(...)`) hides it without
  dismissing it; it reappears when the pilot is free.
- Placement: above the bottom navigation bar, never over it. Desktop: bottom right, 360 px wide.
  Mobile (< 768 px): full width with 12 px gutters, clear of the bar and the safe-area inset.
- localStorage blocked or failing: no error, the card still works; once closed it stays closed for
  the session (in-memory flag).
- No `backdrop-filter` (it freezes Linux WebKit painting in CI e2e).

## Privacy

The flag is a functional UI preference stored on the device only, like the theme. Nothing is sent
anywhere; Discord is only contacted if the pilot clicks « Rejoindre ».

## Manual impact

None. The manual does not describe Discord, and a one-time announcement is not a feature to
document. The Discord copy of the manual (`#guide-utilisation`) is unchanged.

## Discord notice (`#mises-a-jour`)

> 📣 L'appli annonce désormais le serveur Discord aux pilotes : une petite carte s'affiche une seule
> fois, sans gêner un examen ou une saisie de vol. Bienvenue aux nouveaux venus !

## Tests

`tests/core/discord_announce.test.js`: content and link attributes, dismissal by `×` and by
« Rejoindre », waiting while blocked (exam, dialog, consent, course), appearing once free, blocked
localStorage.
