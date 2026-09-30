import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import LogbookView from '../../js/views/logbook.js';
import SitesView from '../../js/views/sites.js';
import SafetyView from '../../js/views/safety.js';
import LibraryEngine from '../../js/views/manual.js';
import SitesService from '../../js/services/sites_service.js';
import GdprEngine from '../../js/gdpr_engine.js';
import { FirebaseAuthEngine } from '../../js/services/firebase_service.js';

// Spec 020 : chaque commande (data-action…) doit avoir un destinataire qui existe, un seul, et des
// arguments qui ne sont pas du code. Les erreurs corrigées à la main par les specs 016 à 019
// (avertissements « Unregistered action », « Mot de passe oublié ? » branché sur une méthode
// absente, réglages du QCM exécutés deux fois, data-args="this.value") font échouer ce test.

const root = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function listFiles(dir, exts) {
    return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
        const rel = path.join(dir, entry.name);
        if (entry.isDirectory()) return listFiles(rel, exts);
        return exts.some((ext) => entry.name.endsWith(ext)) ? [rel] : [];
    });
}

const ATTR = /data-(action|change-action|input-action|enter-action|backdrop-action)\s*=\s*\\?["']([^"'\\]*)\\?["']/g;
const ARGS = /data-args\s*=\s*\\?["']([^"'\\]*)\\?["']/g;

/** Every action name used in the given sources, with its kind and location. */
export function collectUsed(sources) {
    const used = [];
    const args = [];
    for (const [file, src] of Object.entries(sources)) {
        src.split('\n').forEach((line, i) => {
            for (const m of line.matchAll(ATTR)) {
                // Nom construit à l'exécution (${…}) : ignoré, il reprend des noms déjà listés.
                if (!m[2].includes('${')) used.push({ kind: m[1], name: m[2], at: `${file}:${i + 1}` });
            }
            for (const m of line.matchAll(ARGS)) args.push({ value: m[1], at: `${file}:${i + 1}` });
        });
    }
    return { used, args };
}

/** Names registered in main.js, and for loop registrations the object/method they forward to. */
export function parseRegistrations(mainSrc) {
    const names = new Set();
    const forwards = new Map(); // name → { target, method }
    for (const m of mainSrc.matchAll(/AppEvents\.register\(\s*'([^']+)'\s*,/g)) names.add(m[1]);
    const loops = /\[((?:\s*'[^']+',?)+)\s*\]\.forEach\(\(action\) => \{([\s\S]*?)\n\s*\}\);/g;
    for (const [, list, body] of mainSrc.matchAll(loops)) {
        const actions = [...list.matchAll(/'([^']+)'/g)].map((a) => a[1]);
        const target = /(LogbookView|SitesView|SafetyView|SitesService|GdprEngine|FirebaseAuthEngine)\[action\]/.exec(
            body,
        )?.[1];
        for (const [, prefix = ''] of body.matchAll(/AppEvents\.register\(\s*(?:'([^']*)'\s*\+\s*)?action\s*,/g)) {
            for (const action of actions) {
                names.add(prefix + action);
                if (target) forwards.set(prefix + action, { target, method: action });
            }
        }
    }
    return { names, forwards };
}

/** Action names handled by QuizView.handleClick's switch. */
export function parseQuizCases(quizSrc) {
    const start = quizSrc.indexOf('    handleClick(e) {');
    const end = quizSrc.indexOf('\n    handleChange(', start);
    return new Set([...quizSrc.slice(start, end).matchAll(/case '([^']+)':/g)].map((m) => m[1]));
}

const methodsOf = (obj) => {
    const names = new Set();
    for (let p = obj; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
        for (const n of Object.getOwnPropertyNames(p)) {
            try {
                if (typeof obj[n] === 'function') names.add(n);
            } catch {
                // accesseur qui lève : pas une méthode
            }
        }
    }
    return names;
};

/**
 * @param {object} w
 * @param {{kind:string,name:string,at:string}[]} w.used
 * @param {{value:string,at:string}[]} w.args
 * @param {Set<string>} w.registered
 * @param {Map<string,{target:string,method:string}>} w.forwards
 * @param {Record<string, object>} w.objects  forward targets by name
 * @param {Set<string>} w.engineMethods  fallback engines (any kind)
 * @param {Set<string>} w.screenActions  sites / quiz delegations (data-action only)
 * @param {Set<string>} w.quizCases
 */
export function findProblems({ used, args, registered, forwards, objects, engineMethods, screenActions, quizCases }) {
    const unowned = used
        .filter(
            ({ kind, name }) =>
                name !== 'navigate' &&
                !registered.has(name) &&
                !engineMethods.has(name) &&
                !(kind === 'action' && screenActions.has(name)),
        )
        .map(({ kind, name, at }) => `data-${kind}="${name}" (${at})`);
    const missingMethod = used
        .filter(({ name }) => forwards.has(name))
        .filter(({ name }) => {
            const { target, method } = forwards.get(name);
            return typeof objects[target]?.[method] !== 'function';
        })
        .map(({ name, at }) => `${name} → ${forwards.get(name).target}.${forwards.get(name).method} (${at})`);
    const doubleOwned = [...quizCases].filter((name) => registered.has(name));
    const codeArgs = args.filter(({ value }) => /\bthis\.|\bdocument\./.test(value)).map((a) => `${a.value} (${a.at})`);
    return {
        unowned: [...new Set(unowned)],
        missingMethod: [...new Set(missingMethod)],
        doubleOwned,
        codeArgs,
    };
}

describe('every control is wired to one existing handler (spec 020)', () => {
    const files = ['index.html', ...listFiles('components', ['.html']), ...listFiles('js', ['.js'])];
    const { used, args } = collectUsed(Object.fromEntries(files.map((f) => [f, read(f)])));
    const { names: registered, forwards } = parseRegistrations(read('js/core/main.js'));
    const quizCases = parseQuizCases(read('js/views/quiz.js'));
    const problems = findProblems({
        used,
        args,
        registered,
        forwards,
        objects: { LogbookView, SitesView, SafetyView, SitesService, GdprEngine, FirebaseAuthEngine },
        engineMethods: new Set([
            ...methodsOf(LibraryEngine),
            ...methodsOf(FirebaseAuthEngine),
            ...methodsOf(GdprEngine),
        ]),
        screenActions: new Set([...methodsOf(SitesService), ...methodsOf(SitesView), ...quizCases]),
        quizCases,
    });

    it('reads a plausible number of controls and registrations', () => {
        expect(used.length).toBeGreaterThan(100);
        expect(registered.size).toBeGreaterThan(50);
        expect(forwards.size).toBeGreaterThan(30);
        expect(quizCases.size).toBeGreaterThan(10);
    });

    it('gives every action name an owner', () => {
        expect(problems.unowned).toEqual([]);
    });

    it('forwards every used registered name to a method that exists', () => {
        expect(problems.missingMethod).toEqual([]);
    });

    it('does not register quiz screen actions app-wide too (they would run twice)', () => {
        expect(problems.doubleOwned).toEqual([]);
    });

    it('never passes code text as arguments', () => {
        expect(problems.codeArgs).toEqual([]);
    });

    // Sans markHandled, AppEvents avertit « Unregistered action » pour chaque action que l'écran
    // vient d'exécuter lui-même (specs 016, 018).
    it.each([
        ['js/views/sites.js', '        this._clickHandler = (e) => {', '        this._inputHandler'],
        ['js/views/quiz.js', '    handleClick(e) {', '\n    handleChange('],
    ])('%s tells AppEvents which actions it handled', (file, from, to) => {
        const src = read(file);
        const start = src.indexOf(from);
        expect(start).toBeGreaterThan(-1);
        expect(src.slice(start, src.indexOf(to, start))).toContain('AppEvents.markHandled(e)');
    });
});

// Chaque règle échoue bien sur une erreur connue (specs 016 à 019).
describe('the wiring check catches known mistakes (spec 020)', () => {
    const mainSrc = `
    AppEvents.register('setQcmMode', () => {});
    ['forgotPassword', 'signIn'].forEach((action) => {
        AppEvents.register('FirebaseAuth' + action, (args, e, t) =>
            window.FirebaseAuthEngine && window.FirebaseAuthEngine[action] ? 1 : null,
        );
    });`;
    const html = [
        '<select data-action="renderQcmBank"></select>',
        '<div data-action="FirebaseAuthforgotPassword"></div>',
        '<button data-action="FirebaseAuthsignIn"></button>',
        '<select data-action="changeSortMode" data-args="this.value"></select>',
    ].join('\n');
    const { used, args } = collectUsed({ 'fixture.html': html });
    const { names, forwards } = parseRegistrations(mainSrc);
    const problems = findProblems({
        used,
        args,
        registered: names,
        forwards,
        objects: { FirebaseAuthEngine: { signIn() {} } },
        engineMethods: new Set(),
        screenActions: new Set(['changeSortMode', 'setQcmMode']),
        quizCases: new Set(['setQcmMode']),
    });

    it('parses prefixed loop registrations and their target', () => {
        expect([...names].sort()).toEqual(['FirebaseAuthforgotPassword', 'FirebaseAuthsignIn', 'setQcmMode']);
        expect(forwards.get('FirebaseAuthforgotPassword')).toEqual({
            target: 'FirebaseAuthEngine',
            method: 'forgotPassword',
        });
    });

    it('flags an action nobody handles (spec 017)', () => {
        expect(problems.unowned).toEqual(['data-action="renderQcmBank" (fixture.html:1)']);
    });

    it('flags a name forwarded to a missing method (spec 019)', () => {
        expect(problems.missingMethod).toEqual([
            'FirebaseAuthforgotPassword → FirebaseAuthEngine.forgotPassword (fixture.html:2)',
        ]);
    });

    it('flags a quiz action registered twice (spec 018)', () => {
        expect(problems.doubleOwned).toEqual(['setQcmMode']);
    });

    it('flags code text in arguments (spec 019)', () => {
        expect(problems.codeArgs).toEqual(['this.value (fixture.html:4)']);
    });
});
