import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Les scripts classiques de index.html (sans type="module") ne passent pas par le regroupement de Vite :
// ils portent vite-ignore (Vite les laisse tels quels et retire l'attribut) et sont recopiés dans dist/
// par STATIC_PATHS (vite.config.mjs). Sans cela, la compilation les signale et ils manqueraient à dist/.
const html = readFileSync('index.html', 'utf8');
const viteConfig = readFileSync('vite.config.mjs', 'utf8');
const classicScripts = [...html.matchAll(/<script\b([^>]*)\bsrc="([^"]+)"[^>]*>/g)]
    .filter(([tag]) => !/type="module"/.test(tag))
    .map(([tag, , src]) => ({ tag, path: src.split('?')[0] }));

describe('classic scripts of index.html and the dist/ build', () => {
    it('finds the classic scripts', () => {
        expect(classicScripts.map((s) => s.path)).toContain('js/error_overlay.js');
    });

    it.each(classicScripts)('$path is marked vite-ignore and copied to dist/', ({ tag, path }) => {
        expect(tag).toMatch(/\bvite-ignore\b/);
        const copied = path.startsWith('vendor/') ? "'vendor'" : `'${path}'`;
        expect(viteConfig).toContain(copied);
    });
});
