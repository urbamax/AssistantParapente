# Research: Logbook Screen Texts

- **Proof of no visible change**: a snapshot of the render functions' output recorded before the move, compared after (Vitest `toMatchSnapshot`, committed). Alternative (review by eye) rejected: 240 texts.
- **Stored values**: option values and saved categories are data (synced to Firestore, used in statistics). Translating them would need a migration; only their labels move.
- **Escaping**: `escapeHTML` turns `'` and `&` into entities; the browser shows the same text and `innerHTML` serialises it the same way, so snapshots stay identical.
- **Guard heuristics**: target the places where text reaches the user (text nodes, 4 attributes, dialogs, text properties) rather than every string (CSS, class names and ids would be false positives).
