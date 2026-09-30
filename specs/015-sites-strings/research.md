# Research: Sites Screen Texts

- Proof of no visible change: Vitest snapshots recorded on the unchanged code (same as spec 014).
- The spec 014 check missed patterns present here (text before a closing backtick, `setAttribute('aria-label', …)`, `label:` lists, ternaries, `.placeholder =`); rules added and re-run on the logbook (still 0).
- Remaining blind spots (plain variable assignments such as `text = 'Maintenant'`, word arrays) are handled by reading the whole file; the snapshot proves the result.
