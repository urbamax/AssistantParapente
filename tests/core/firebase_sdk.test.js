// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Spec 013 : le SDK Firebase est hébergé par l'application (plus de www.gstatic.com), et chaque
// fichier hébergé est prouvé identique à la version officielle 12.19.0 (écart d'audit C1).
const VERSION = '12.19.0';
const DIR = `vendor/firebase-${VERSION}`;
const CDN_APP_IMPORT = `from"https://www.gstatic.com/firebasejs/${VERSION}/firebase-app.js"`;
const LOCAL_APP_IMPORT = 'from"./firebase-app.js"';

const sha384 = (buf) => `sha384-${createHash('sha384').update(buf).digest('base64')}`;

// official : empreinte du fichier du paquet npm firebase@12.19.0 (identique à gstatic, vérifié le
// 2026-09-30). hosted : empreinte de la copie hébergée, qui diffère seulement par l'import de
// firebase-app.js réécrit en chemin local (voir vendor/firebase-12.19.0/README.md).
const FILES = {
    'firebase-app.js': {
        official: 'sha384-RJIsoe0CFvPanuqLw3NPVreeQfBNBS6DotHoCTfrxasRhbZXK3oIK/kWJLO/hCaU',
        rewritten: false,
    },
    'firebase-auth.js': {
        official: 'sha384-AgtBGZZ/u/7uqnj2oxrSf5J+QuQXF4sEG1w/6PUzbyR3RIG7mkXR2z8Tpdeqay0t',
        rewritten: true,
    },
    'firebase-firestore.js': {
        official: 'sha384-sHPqHH0juNEgAdc08GltxAO7hXh1m6l79EG3kVc04m9yh0n7gPu0bciliVhHtIlL',
        rewritten: true,
    },
    'firebase-messaging.js': {
        official: 'sha384-HsS3lh0KUKsuQIXBXufaNGz/H1l0/+22Ziy/TZcMn+Oz1wtMOoCAwQE6CKISILEc',
        rewritten: true,
    },
    'firebase-app-compat.js': {
        official: 'sha384-aUtWR1iCiOCHS8pn1nKNXMZm3I/eDrV63IXWXgE+mHHqJfYTWYV+jGk0sCXz57+U',
        rewritten: false,
    },
    'firebase-messaging-compat.js': {
        official: 'sha384-/QOgDjfwEvqJ0UAwKZH8I3TZ4W8ebk7PDk6UWIYc2hGanbyE65QrNB0VQuDeVkGe',
        rewritten: false,
    },
};

describe('hosted Firebase SDK is the official 12.19.0 release (spec 013, FR-003, FR-005)', () => {
    it.each(Object.entries(FILES))('%s', (name, { official, rewritten }) => {
        const hosted = readFileSync(`${DIR}/${name}`, 'utf8');
        if (rewritten) {
            // Exactement un import réécrit, et plus aucune adresse gstatic.
            expect(hosted.split(LOCAL_APP_IMPORT).length - 1, `${name}: local import count`).toBe(1);
            expect(hosted, name).not.toContain('gstatic.com');
        }
        const original = rewritten ? hosted.replace(LOCAL_APP_IMPORT, CDN_APP_IMPORT) : hosted;
        expect(sha384(Buffer.from(original, 'utf8')), `${name} differs from the official file`).toBe(official);
    });

    it('hosts only the expected files, with the licence and the update notes', () => {
        const expected = [...Object.keys(FILES), 'LICENSE', 'README.md'].sort();
        expect(readdirSync(DIR).sort()).toEqual(expected);
        expect(readFileSync(`${DIR}/LICENSE`, 'utf8')).toContain('Apache License');
    });
});

describe('one Firebase version, no CDN address (spec 013, FR-001, FR-004)', () => {
    it('the page, the service worker and the hosted folder use the same version', () => {
        const page = readFileSync('js/services/firebase_service.js', 'utf8').match(
            /const FIREBASE_VERSION = '([^']+)'/,
        );
        const worker = readFileSync('sw.js', 'utf8').match(
            /const FIREBASE_SDK_DIR = '\.\/vendor\/firebase-([^/']+)\/'/,
        );
        expect(page?.[1]).toBe(VERSION);
        expect(worker?.[1]).toBe(VERSION);
        expect(existsSync(DIR)).toBe(true);
    });

    it.each([['js/services/firebase_service.js'], ['sw.js'], ['index.html']])(
        '%s has no Firebase CDN address',
        (file) => {
            expect(readFileSync(file, 'utf8')).not.toMatch(/gstatic\.com/);
        },
    );

    it('the page security policy no longer allows scripts from www.gstatic.com (FR-006)', () => {
        const csp = readFileSync('index.html', 'utf8').match(/script-src ([^;]+);/)?.[1] ?? '';
        expect(csp).not.toContain('gstatic');
    });
});
