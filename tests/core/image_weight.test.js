import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Les images de img/ sont chargées (et mises en cache hors ligne) à chaque visite : une image
// de plusieurs centaines de Ko, affichée à 80 px de haut, pèse sur le premier chargement mobile.
const MAX_BYTES = 250_000;

function images(dir) {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return images(path);
        return /\.(png|jpe?g|webp|gif|svg)$/i.test(name) ? [path] : [];
    });
}

describe('images shipped with the app', () => {
    it(`weigh less than ${MAX_BYTES / 1000} KB each`, () => {
        const heavy = images('img')
            .map((path) => ({ path, kb: Math.round(statSync(path).size / 1000) }))
            .filter(({ kb }) => kb * 1000 > MAX_BYTES);
        expect(heavy).toEqual([]);
    });
});
