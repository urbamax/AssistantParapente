# Feature Specification: Content-Security-Policy Without Inline Scripts

**Feature Branch**: `chore/csp-no-inline-scripts`
**Status**: Draft
**Related**: Constitution v1.0.0 — Principle VI (web security: no raw `innerHTML` with unescaped data, SRI on CDN scripts), VII (every file fetched at run time is listed in `STATIC_PATHS`).

## Problem

`index.html` declares a Content-Security-Policy, but its `script-src` still allows `'unsafe-inline'`.
The comment next to it justifies this by inline `onclick`/`onchange` attributes, which no longer
exist (a test forbids them). The only remaining inline scripts are two blocks in `<head>`. While
`'unsafe-inline'` stays, the policy does not stop an injected `<script>` or `javascript:` URL from
running, which is the main thing a CSP is for.

## Changes

- The two inline `<script>` blocks move to files: `js/theme_boot.js` (applies the saved theme before
  the first paint) and `js/error_overlay.js` (the global error banner). They stay classic, blocking
  scripts at the top of `<head>`, so the theme is still set before the first paint.
- `script-src` loses `'unsafe-inline'`. Allowed script sources are `'self'` and the two hosts that
  are still needed: `https://unpkg.com` (MapLibre and deck.gl, loaded on demand with a Subresource
  Integrity hash) and `https://apis.google.com` (kept because the bundled Firebase SDK can load it).
- `style-src` keeps `'unsafe-inline'`: the app and its libraries rely on `style=""` attributes
  (about 850 of them), and the print report is rendered in a `srcdoc` frame with a `<style>` block.
- The two new files are added to `STATIC_PATHS` (build) and to the service worker's precache list
  (offline start-up).

## Requirements

- **FR-1**: `script-src` contains neither `'unsafe-inline'` nor `'unsafe-eval'`.
- **FR-2**: `index.html` contains no inline `<script>` and every external script is served from an
  origin allowed by `script-src`.
- **FR-3**: The theme is still applied before the first paint, and the error banner still works.
- **FR-4**: No Content-Security-Policy violation is reported while using the main screens.

## Out of Scope

- Removing `'unsafe-inline'` from `style-src` (would mean replacing the `style=""` attributes).
- Removing `https://apis.google.com` (needs a test with a real Firebase sign-in).
- A debugging banner that shows raw error stacks to users stays as it is (separate decision).
