// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Spec 010 (audit C7) : tout élément cliquable non focalisable par nature doit être un « bouton »
// accessible au clavier. Exception : les barres de la frise horaire (le curseur d'heure les
// remplace au clavier), masquées aux lecteurs d'écran.
function listFiles(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? listFiles(join(dir, e.name)) : e.name.endsWith('.js') ? [join(dir, e.name)] : [],
    );
}
const FILES = ['index.html', 'components/header.html', 'components/footer.html', ...listFiles('js')];
const CLICKABLE =
    /<(div|span|li|td|tr|a|i|img|label|p|h[1-6]|section|article)\b([^>]*?)data-action=("[^"]*"|'[^']*')([^>]*)>/gs;

function offenders() {
    const out = [];
    for (const file of FILES) {
        const src = readFileSync(file, 'utf8');
        for (const m of src.matchAll(CLICKABLE)) {
            const tag = m[0];
            if (/\bhref=/.test(tag)) continue;
            const line = src.slice(0, m.index).split('\n').length;
            if (/timeline-hour-dot/.test(tag)) {
                if (!/aria-hidden="true"/.test(tag)) out.push(`${file}:${line} barre de frise sans aria-hidden`);
                continue;
            }
            if (!/role="button"/.test(tag) || !/tabindex="0"/.test(tag)) out.push(`${file}:${line} ${m[3]}`);
        }
    }
    return out;
}

describe('keyboard access (spec 010, FR-001, FR-004, FR-005)', () => {
    it('every non-focusable clickable element is a keyboard button', () => {
        expect(offenders()).toEqual([]);
    });
});
