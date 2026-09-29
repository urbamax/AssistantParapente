// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Spec 009 : aucun appel à un serveur tiers au démarrage, liens externes protégés, pas
// d'identifiant Analytics, et fichiers hébergés identiques aux versions vérifiées (SRI d'origine).
const read = (p) => readFileSync(p, 'utf8');
const sri = (algo, path) => `${algo}-${createHash(algo).update(readFileSync(path)).digest('base64')}`;
const THIRD_PARTY = [
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdn.jsdelivr.net',
    'unpkg.com',
    'wordpress.com',
    'federation.ffvl.fr/sites',
];

describe('no third-party resource at start-up (spec 009, FR-001)', () => {
    it.each([['index.html'], ['components/header.html'], ['components/footer.html']])(
        '%s loads nothing from a third party',
        (file) => {
            const html = read(file);
            const loads = [...html.matchAll(/<(?:link|script|img)\b[^>]*\b(?:href|src)="([^"]+)"/gi)].map((m) => m[1]);
            for (const host of THIRD_PARTY) {
                expect(loads.filter((u) => u.includes(host))).toEqual([]);
            }
        },
    );
});

describe('hosted libraries are the audited versions (spec 009, FR-003)', () => {
    it.each([
        ['sha256', 'vendor/leaflet-1.9.4/leaflet.css', 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='],
        ['sha256', 'vendor/leaflet-1.9.4/leaflet.js', 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='],
        [
            'sha384',
            'vendor/remixicon-3.5.0/remixicon.css',
            'sha384-2+8OcleUOxnP/2cYXK9FBoMe12ojS0iPrrJy9Um4ICFk2AXl8iODUaIoUKI6TmGj',
        ],
    ])('%s %s', (algo, path, expected) => {
        expect(sri(algo, path)).toBe(expected);
    });
});

describe('external links and analytics (spec 009, FR-004, FR-005)', () => {
    it.each([['index.html'], ['components/header.html'], ['components/footer.html']])(
        '%s: every target=_blank link has rel="noopener noreferrer"',
        (file) => {
            const unsafe = [...read(file).matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)]
                .map((m) => m[0])
                .filter((tag) => !/rel="[^"]*noopener[^"]*noreferrer[^"]*"/.test(tag));
            expect(unsafe).toEqual([]);
        },
    );

    it('the Firebase configuration has no Google Analytics identifier', () => {
        expect(read('js/firebase_config.js')).not.toMatch(/measurementId|G-[A-Z0-9]{6,}/);
    });
});
