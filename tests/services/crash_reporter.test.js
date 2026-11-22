import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    isIgnoredError,
    computeErrorSignature,
    shouldReportCrash,
    sendCrashReport,
    initCrashReporter,
    _resetCrashReporterForTesting,
    CRASH_REPORTER_LIMITS,
} from '../../js/services/crash_reporter.js';

describe('CrashReporter Service (spec 050)', () => {
    beforeEach(() => {
        _resetCrashReporterForTesting();
        vi.restoreAllMocks();
    });

    describe('isIgnoredError', () => {
        it('identifie les erreurs provenant d extensions navigateur', () => {
            expect(
                isIgnoredError({
                    message: 'Cannot read property of null',
                    filename: 'chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/contentscript.js',
                }),
            ).toBe(true);

            expect(
                isIgnoredError({
                    message: 'Error in moz-extension://12345/script.js',
                }),
            ).toBe(true);
        });

        it('ignore les erreurs de boucle bénignes ResizeObserver', () => {
            expect(
                isIgnoredError({
                    message: 'ResizeObserver loop completed with undelivered notifications.',
                }),
            ).toBe(true);
        });

        it('ignore les erreurs réseau lors des pertes de connexion', () => {
            expect(isIgnoredError({ message: 'TypeError: Failed to fetch' })).toBe(true);
            expect(isIgnoredError({ message: 'NetworkError when attempting to fetch resource.' })).toBe(true);
        });

        it('ne filtre pas les vrais crashs de l application', () => {
            expect(
                isIgnoredError({
                    message: "TypeError: Cannot read properties of undefined (reading 'render')",
                    filename: 'https://assistantparapente.fr/js/views/logbook.js',
                    stack: 'at LogbookView.render (https://assistantparapente.fr/js/views/logbook.js:42:15)',
                }),
            ).toBe(false);
        });
    });

    describe('computeErrorSignature', () => {
        it('génère la même signature pour la même erreur au même endroit', () => {
            const errA = {
                message: 'ReferenceError: foo is not defined',
                filename: '/js/views/sites.js',
                lineno: 102,
                colno: 4,
            };
            const errB = {
                message: 'ReferenceError: foo is not defined',
                filename: 'https://site.fr/js/views/sites.js?v=2',
                lineno: 102,
                colno: 4,
            };
            expect(computeErrorSignature(errA)).toBe(computeErrorSignature(errB));
        });

        it('génère une signature distincte si la ligne change', () => {
            const errA = { message: 'ReferenceError: foo is not defined', filename: '/js/views/sites.js', lineno: 102 };
            const errB = { message: 'ReferenceError: foo is not defined', filename: '/js/views/sites.js', lineno: 103 };
            expect(computeErrorSignature(errA)).not.toBe(computeErrorSignature(errB));
        });
    });

    describe('shouldReportCrash', () => {
        it('autorise le signalement pour un crash valide', () => {
            const err = { message: 'SyntaxError: unexpected token', filename: '/js/core/router.js', lineno: 50 };
            expect(shouldReportCrash(err)).toBe(true);
        });

        it('refuse si le quota maximum par session est atteint', () => {
            const err = { message: 'Error A', filename: 'app.js', lineno: 1 };
            expect(shouldReportCrash(err, { reportCount: CRASH_REPORTER_LIMITS.MAX_REPORTS_PER_SESSION })).toBe(false);
        });

        it('refuse si l erreur a déjà été transmise dans la même session', () => {
            const err = { message: 'Error B', filename: 'app.js', lineno: 2 };
            const set = new Set([computeErrorSignature(err)]);
            expect(shouldReportCrash(err, { reportedSignaturesSet: set })).toBe(false);
        });
    });

    describe('sendCrashReport', () => {
        it('utilise sendBeacon si disponible et retourne true', async () => {
            let beaconSent = null;
            const mockBeacon = vi.fn((url, blob) => {
                beaconSent = { url, blob };
                return true;
            });

            const err = {
                name: 'TypeError',
                message: 'Boom',
                filename: 'https://assistantparapente.fr/js/views/quiz.js',
                lineno: 42,
                colno: 12,
                stack: 'TypeError: Boom\n    at quiz.js:42:12',
            };

            const result = await sendCrashReport(err, {
                endpoint: '/api/feedback',
                sendBeaconImpl: mockBeacon,
            });

            expect(result).toBe(true);
            expect(mockBeacon).toHaveBeenCalledTimes(1);
            expect(beaconSent.url).toBe('/api/feedback');

            // Deuxième envoi de la même erreur doit être refusé (dé-doublonnage)
            const secondResult = await sendCrashReport(err, {
                endpoint: '/api/feedback',
                sendBeaconImpl: mockBeacon,
            });
            expect(secondResult).toBe(false);
            expect(mockBeacon).toHaveBeenCalledTimes(1);
        });

        it('bascule sur fetch avec keepalive si sendBeacon est indisponible', async () => {
            let capturedBody = null;
            const mockFetch = vi.fn(async (url, init) => {
                capturedBody = JSON.parse(init.body);
                return { ok: true, json: async () => ({ success: true }) };
            });

            const err = {
                name: 'RangeError',
                message: 'Invalid array length',
                filename: 'js/views/map.js',
                lineno: 88,
            };

            const result = await sendCrashReport(err, {
                endpoint: '/api/feedback',
                sendBeaconImpl: null,
                fetchImpl: mockFetch,
            });

            expect(result).toBe(true);
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(capturedBody.category).toBe('crash');
            expect(capturedBody.subject).toContain('RangeError in map.js:88');
        });

        it('ajoute le message en tête quand la pile WebKit ne le contient pas', async () => {
            let capturedBody = null;
            const mockFetch = vi.fn(async (_url, init) => {
                capturedBody = JSON.parse(init.body);
                return { ok: true };
            });

            await sendCrashReport(
                {
                    name: 'TypeError',
                    message: "undefined is not an object (evaluating 'a.b')",
                    filename: 'https://assistantparapente.fr/js/views/webkit_case.js',
                    lineno: 7,
                    colno: 3,
                    stack: 'render@https://assistantparapente.fr/js/views/webkit_case.js:7:3',
                },
                { endpoint: '/api/feedback', sendBeaconImpl: null, fetchImpl: mockFetch },
            );

            expect(capturedBody.description).toBe(
                "TypeError: undefined is not an object (evaluating 'a.b')\n" +
                    'render@https://assistantparapente.fr/js/views/webkit_case.js:7:3',
            );
        });

        it('ne duplique pas le message quand la pile V8 le contient déjà', async () => {
            let capturedBody = null;
            const mockFetch = vi.fn(async (_url, init) => {
                capturedBody = JSON.parse(init.body);
                return { ok: true };
            });

            await sendCrashReport(
                {
                    name: 'TypeError',
                    message: 'Kaboom',
                    filename: 'https://assistantparapente.fr/js/views/v8_case.js',
                    lineno: 9,
                    colno: 1,
                    stack: 'TypeError: Kaboom\n    at v8_case.js:9:1',
                },
                { endpoint: '/api/feedback', sendBeaconImpl: null, fetchImpl: mockFetch },
            );

            expect(capturedBody.description).toBe('TypeError: Kaboom\n    at v8_case.js:9:1');
        });

        it('supprime les paramètres et fragments URL sensibles (ICE, migration) avant envoi', async () => {
            let capturedBody = null;
            const mockFetch = vi.fn().mockImplementation(async (_url, opts) => {
                capturedBody = JSON.parse(opts.body);
                return { ok: true };
            });

            await sendCrashReport(
                {
                    name: 'Error',
                    message: 'Failed at https://assistantparapente.fr/?mode=ICE#n=Dupont&al=Penicilline',
                    filename: 'https://assistantparapente.fr/js/views/ice_viewer.js?v=1#secret=123',
                    lineno: 12,
                    colno: 4,
                    stack: 'Error: boom\n    at https://assistantparapente.fr/#migration=g.SUPERSECRETBASE64:12:4',
                },
                {
                    endpoint: '/api/feedback',
                    sendBeaconImpl: null,
                    fetchImpl: mockFetch,
                },
            );

            expect(capturedBody.description).not.toContain('Dupont');
            expect(capturedBody.description).not.toContain('Penicilline');
            expect(capturedBody.description).not.toContain('SUPERSECRETBASE64');
            expect(capturedBody.subject).not.toContain('secret=123');
        });
    });

    describe('initCrashReporter', () => {
        it('attache et détache correctement les écouteurs sur la fenêtre', () => {
            const listeners = {};
            const fakeWindow = {
                addEventListener: vi.fn((evt, cb) => {
                    listeners[evt] = cb;
                }),
                removeEventListener: vi.fn((evt) => {
                    delete listeners[evt];
                }),
            };

            const cleanup = initCrashReporter({ windowObj: fakeWindow });
            expect(fakeWindow.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
            expect(fakeWindow.addEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));

            cleanup();
            expect(fakeWindow.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function));
            expect(fakeWindow.removeEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
        });
    });
});
