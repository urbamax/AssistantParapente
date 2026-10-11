import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Une classe d'icône qui n'existe pas dans Remix Icon s'affiche sans rien : aucune erreur, juste un trou.
const vendorCss = readFileSync('vendor/remixicon-3.5.0/remixicon.css', 'utf8');
const known = new Set([...vendorCss.matchAll(/\.(ri-[a-z0-9-]+):before/g)].map((m) => m[1]));

function sourceFiles(dir) {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return name === 'data' ? [] : sourceFiles(path);
        return /\.(js|css)$/.test(name) ? [path] : [];
    });
}

describe('Remix Icon classes used by the app', () => {
    const files = ['index.html', ...sourceFiles('js'), ...sourceFiles('css')];

    it('all exist in the bundled Remix Icon 3.5.0', () => {
        const missing = [];
        for (const file of files) {
            const text = readFileSync(file, 'utf8');
            for (const [, icon] of text.matchAll(/\b(ri-[a-z0-9]+(?:-[a-z0-9]+)*-(?:line|fill))\b/g)) {
                if (!known.has(icon)) missing.push(`${file}: ${icon}`);
            }
        }
        expect([...new Set(missing)]).toEqual([]);
    });
});
