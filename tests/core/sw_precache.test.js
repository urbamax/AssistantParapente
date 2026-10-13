// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Le pré-cache du service worker racine est une liste écrite à la main (le build Vite, lui, la
// régénère). Sans ce garde-fou, un nouveau module JS oublié dans la liste n'est disponible hors
// ligne que s'il a déjà été ouvert une fois en ligne.
const SW_SOURCE = readFileSync('sw.js', 'utf8');
const listMatch = SW_SOURCE.match(/const CRITICAL_ASSETS = \[([\s\S]*?)\];/);
const precached = new Set([...listMatch[1].matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]));

/** Tous les fichiers .js sous `dir`, en chemins relatifs à la racine du projet. */
function jsFiles(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return jsFiles(path);
        return entry.name.endsWith('.js') ? [path] : [];
    });
}

describe('pré-cache du service worker (sw.js)', () => {
    it('contient chaque module JavaScript de js/', () => {
        const missing = jsFiles('js').filter((file) => !precached.has(file));
        expect(missing).toEqual([]);
    });

    it('ne référence aucun fichier inexistant', () => {
        const unknown = [...precached].filter((file) => {
            try {
                readFileSync(file);
                return false;
            } catch {
                return true;
            }
        });
        expect(unknown).toEqual([]);
    });
});
