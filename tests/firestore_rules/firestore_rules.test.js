// Règles Firestore (firestore.rules) testées sur l'émulateur : npm run test:rules
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, getDocs, collection, collectionGroup, setLogLevel } from 'firebase/firestore';

const ME = 'pilote-A';
const OTHER = 'pilote-B';

let env;

beforeAll(async () => {
    setLogLevel('error');
    env = await initializeTestEnvironment({
        projectId: 'demo-assistantparapente',
        firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    });
});

afterAll(async () => {
    await env.cleanup();
});

beforeEach(async () => {
    await env.clearFirestore();
    // Données de deux pilotes, écrites en contournant les règles (comme la Cloud Function).
    await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        for (const uid of [ME, OTHER]) {
            await setDoc(doc(db, 'users', uid), { fcmToken: 'jeton' });
            await setDoc(doc(db, 'users', uid, 'logbook', 'f1'), { id: 'f1', site: 'Annecy' });
            await setDoc(doc(db, 'users', uid, 'equipment', 'e1'), { id: 'e1' });
            await setDoc(doc(db, 'users', uid, 'stats', 'qcm_stats'), { total: 3 });
            await setDoc(doc(db, 'users', uid, 'preferences', 'user_prefs'), { favoriteSites: [] });
            await setDoc(doc(db, 'users', uid, 'pushState', 'favoriteSitesFlyable'), { a: 1 });
        }
    });
});

const asMe = () => env.authenticatedContext(ME).firestore();
const anonymous = () => env.unauthenticatedContext().firestore();

// Chemins réellement utilisés par js/services/firebase_service.js.
const APP_DOCS = [
    ['logbook', 'f1'],
    ['equipment', 'e1'],
    ['stats', 'qcm_stats'],
    ['stats', 'exam_history'],
    ['preferences', 'user_prefs'],
];

describe('un pilote connecté et ses propres données', () => {
    it.each(APP_DOCS)('lit, écrit et supprime users/{uid}/%s/%s', async (sub, id) => {
        const ref = doc(asMe(), 'users', ME, sub, id);
        await assertSucceeds(setDoc(ref, { id, updatedAt: 1 }));
        await assertSucceeds(getDoc(ref));
        await assertSucceeds(deleteDoc(ref));
    });

    it('lit la liste de son carnet et de son matériel', async () => {
        await assertSucceeds(getDocs(collection(asMe(), 'users', ME, 'logbook')));
        await assertSucceeds(getDocs(collection(asMe(), 'users', ME, 'equipment')));
    });

    it('enregistre son jeton de notification (users/{uid})', async () => {
        await assertSucceeds(setDoc(doc(asMe(), 'users', ME), { fcmToken: 'nouveau' }, { merge: true }));
    });
});

describe("les données d'un autre pilote", () => {
    it.each(APP_DOCS)('sont illisibles et intouchables : users/{autre}/%s/%s', async (sub, id) => {
        const ref = doc(asMe(), 'users', OTHER, sub, id);
        await assertFails(getDoc(ref));
        await assertFails(setDoc(ref, { id }));
        await assertFails(deleteDoc(ref));
    });

    it('ne peuvent pas être listées, ni lues par collectionGroup', async () => {
        await assertFails(getDocs(collection(asMe(), 'users', OTHER, 'logbook')));
        await assertFails(getDocs(collectionGroup(asMe(), 'logbook')));
    });

    it('le document du compte est illisible et non modifiable', async () => {
        await assertFails(getDoc(doc(asMe(), 'users', OTHER)));
        await assertFails(setDoc(doc(asMe(), 'users', OTHER), { fcmToken: 'vol' }, { merge: true }));
    });
});

// Morceaux de trace de vol (specs/037-sync-flight-traces) : propriétaire seulement, forme et taille contrôlées.
const part = (overrides = {}) => ({
    flightId: 'vol-1',
    index: 0,
    total: 1,
    encoding: 'gzip-base64',
    data: 'H4sIAAAAAAAA',
    updatedAt: 1,
    ...overrides,
});
const partRef = (db, uid, id = 'vol-1_0') => doc(db, 'users', uid, 'igcTraces', id);

describe('traces de vol (igcTraces) : le propriétaire', () => {
    it('écrit, relit et supprime un morceau valide', async () => {
        const ref = partRef(asMe(), ME);
        await assertSucceeds(setDoc(ref, part()));
        await assertSucceeds(getDoc(ref));
        await assertSucceeds(deleteDoc(ref));
    });

    it('écrit un morceau sans updatedAt, et un vol en plusieurs morceaux', async () => {
        const withoutDate = part();
        delete withoutDate.updatedAt;
        await assertSucceeds(setDoc(partRef(asMe(), ME), withoutDate));
        await assertSucceeds(setDoc(partRef(asMe(), ME, 'vol-2_0'), part({ flightId: 'vol-2', total: 3 })));
        await assertSucceeds(setDoc(partRef(asMe(), ME, 'vol-2_2'), part({ flightId: 'vol-2', index: 2, total: 3 })));
    });

    it('accepte le codage sans compression et un morceau de 700 000 caractères', async () => {
        await assertSucceeds(setDoc(partRef(asMe(), ME), part({ encoding: 'identity-base64' })));
        await assertSucceeds(
            setDoc(partRef(asMe(), ME, 'gros_0'), part({ flightId: 'gros', data: 'A'.repeat(700000) })),
        );
    });

    it('remplace un morceau existant (nouvelle trace du même vol)', async () => {
        await assertSucceeds(setDoc(partRef(asMe(), ME), part()));
        await assertSucceeds(setDoc(partRef(asMe(), ME), part({ data: 'AAAA', updatedAt: 2 })));
    });
});

describe('traces de vol (igcTraces) : ce qui est refusé même au propriétaire', () => {
    it.each([
        ['un champ en trop', part({ extra: 'x' })],
        ['un champ manquant (data)', (({ data: _d, ...rest }) => rest)(part())],
        ['un champ manquant (total)', (({ total: _t, ...rest }) => rest)(part())],
        ['un numéro de morceau négatif', part({ index: -1 })],
        ['un numéro de morceau trop grand (12)', part({ index: 12, total: 12 })],
        ['un numéro de morceau égal au total', part({ index: 1, total: 1 })],
        ['un total à zéro', part({ total: 0 })],
        ['un total trop grand (13)', part({ total: 13 })],
        ['un numéro décimal', part({ index: 0.5 })],
        ['un codage inconnu', part({ encoding: 'zip' })],
        ['des données vides', part({ data: '' })],
        ['des données qui ne sont pas du texte', part({ data: 12345 })],
        ['des données de 700 001 caractères', part({ data: 'A'.repeat(700001) })],
        ['un identifiant de vol vide', part({ flightId: '' })],
        ['un identifiant de vol de plus de 64 caractères', part({ flightId: 'x'.repeat(65) })],
        ['un updatedAt qui n’est pas un nombre', part({ updatedAt: 'hier' })],
    ])('%s', async (_name, body) => {
        await assertFails(setDoc(partRef(asMe(), ME), body));
    });

    it('un nom de document qui ne correspond pas au vol et au numéro', async () => {
        await assertFails(setDoc(partRef(asMe(), ME, 'autre_0'), part()));
        await assertFails(setDoc(partRef(asMe(), ME, 'vol-1_1'), part({ index: 0 })));
        await assertFails(setDoc(partRef(asMe(), ME, 'vol-1'), part()));
    });

    it('une modification qui rend un morceau invalide', async () => {
        await assertSucceeds(setDoc(partRef(asMe(), ME), part()));
        await assertFails(setDoc(partRef(asMe(), ME), part({ data: 'A'.repeat(700001) })));
    });
});

describe('traces de vol (igcTraces) : les autres', () => {
    beforeEach(async () => {
        await env.withSecurityRulesDisabled(async (context) => {
            await setDoc(partRef(context.firestore(), OTHER), part());
        });
    });

    it('un autre pilote ne lit, n’écrit ni ne supprime les traces d’autrui', async () => {
        await assertFails(getDoc(partRef(asMe(), OTHER)));
        await assertFails(setDoc(partRef(asMe(), OTHER), part({ data: 'AAAA' })));
        await assertFails(deleteDoc(partRef(asMe(), OTHER)));
        await assertFails(getDocs(collection(asMe(), 'users', OTHER, 'igcTraces')));
    });

    it('les traces ne sont pas lisibles par collectionGroup', async () => {
        await assertFails(getDocs(collectionGroup(asMe(), 'igcTraces')));
    });

    it('un visiteur non connecté ne lit ni n’écrit rien', async () => {
        await assertFails(getDoc(partRef(anonymous(), OTHER)));
        await assertFails(setDoc(partRef(anonymous(), ME), part()));
    });

    it('une trace ne peut pas être rangée ailleurs (sous-collection inconnue, ou à la racine)', async () => {
        await assertFails(setDoc(doc(asMe(), 'users', ME, 'traces', 'vol-1_0'), part()));
        await assertFails(setDoc(doc(asMe(), 'igcTraces', 'vol-1_0'), part()));
    });
});

// Fiche d'urgence ICE (données de santé) : propriétaire seulement, forme et longueurs contrôlées.
const ice = (overrides = {}) => ({
    nom: 'Dupont',
    prenom: 'Thomas',
    birthDate: '1988-03-12',
    contact1Name: 'Sophie',
    contact1Phone: '0612345678',
    bloodGroup: 'O+',
    allergies: 'Pénicilline',
    anticoag: '1',
    pays: 'FR',
    ffvl: '1234567',
    federation: 'FFVL',
    updatedAt: 1700000000000,
    consentAt: '2026-11-09T21:00:00.000Z',
    ...overrides,
});
const iceRef = (db, uid, id = 'profile') => doc(db, 'users', uid, 'ice', id);

describe('fiche ICE (ice/profile) : le propriétaire', () => {
    it('écrit, relit, met à jour et supprime sa fiche', async () => {
        const ref = iceRef(asMe(), ME);
        await assertSucceeds(setDoc(ref, ice()));
        await assertSucceeds(getDoc(ref));
        await assertSucceeds(setDoc(ref, ice({ allergies: 'Aspirine', updatedAt: 1700000000001 })));
        await assertSucceeds(deleteDoc(ref));
    });

    it('enregistre une fiche réduite à l’essentiel (champs facultatifs absents)', async () => {
        await assertSucceeds(setDoc(iceRef(asMe(), ME), { updatedAt: 1, consentAt: '2026-11-09T21:00:00.000Z' }));
    });

    it('enregistre une fiche aux longueurs maximales de l’application', async () => {
        await assertSucceeds(
            setDoc(
                iceRef(asMe(), ME),
                ice({ allergies: 'a'.repeat(150), remarques: 'r'.repeat(250), insurance: 'i'.repeat(60) }),
            ),
        );
    });
});

describe('fiche ICE (ice/profile) : ce qui est refusé même au propriétaire', () => {
    it.each([
        ['un champ inconnu', ice({ numeroSecu: '1880375123456' })],
        ['sans consentAt (accord non daté)', (({ consentAt: _c, ...rest }) => rest)(ice())],
        ['sans updatedAt', (({ updatedAt: _u, ...rest }) => rest)(ice())],
        ['un consentAt vide', ice({ consentAt: '' })],
        ['un consentAt trop long', ice({ consentAt: 'x'.repeat(41) })],
        ['un updatedAt qui n’est pas un nombre', ice({ updatedAt: 'hier' })],
        ['un nom qui n’est pas du texte', ice({ nom: 42 })],
        ['un nom de 81 caractères', ice({ nom: 'n'.repeat(81) })],
        ['des allergies de 301 caractères', ice({ allergies: 'a'.repeat(301) })],
        ['des remarques de 501 caractères', ice({ remarques: 'r'.repeat(501) })],
        ['un pays de 3 lettres', ice({ pays: 'FRA' })],
        ['un anticoagulant qui n’est pas une case', ice({ anticoag: 'oui' })],
        ['un champ imbriqué', ice({ contact1Name: { prenom: 'Sophie' } })],
    ])('%s', async (_name, body) => {
        await assertFails(setDoc(iceRef(asMe(), ME), body));
    });

    it('un autre nom de document que « profile »', async () => {
        await assertFails(setDoc(iceRef(asMe(), ME, 'autre'), ice()));
        await assertFails(setDoc(iceRef(asMe(), ME, 'profile2'), ice()));
    });

    it('une modification qui rend la fiche invalide', async () => {
        await assertSucceeds(setDoc(iceRef(asMe(), ME), ice()));
        await assertFails(setDoc(iceRef(asMe(), ME), ice({ nom: 'n'.repeat(81) })));
    });
});

describe('fiche ICE (ice/profile) : les autres', () => {
    beforeEach(async () => {
        await env.withSecurityRulesDisabled(async (context) => {
            await setDoc(iceRef(context.firestore(), OTHER), ice());
        });
    });

    it('un autre pilote ne lit, n’écrit ni ne supprime la fiche d’autrui', async () => {
        await assertFails(getDoc(iceRef(asMe(), OTHER)));
        await assertFails(setDoc(iceRef(asMe(), OTHER), ice({ nom: 'Vol' })));
        await assertFails(deleteDoc(iceRef(asMe(), OTHER)));
        await assertFails(getDocs(collection(asMe(), 'users', OTHER, 'ice')));
    });

    it('les fiches ne sont pas lisibles par collectionGroup', async () => {
        await assertFails(getDocs(collectionGroup(asMe(), 'ice')));
    });

    it('un visiteur non connecté ne lit ni n’écrit aucune fiche', async () => {
        await assertFails(getDoc(iceRef(anonymous(), OTHER)));
        await assertFails(getDoc(iceRef(anonymous(), ME)));
        await assertFails(setDoc(iceRef(anonymous(), ME), ice()));
    });

    it('une fiche ne peut pas être rangée ailleurs', async () => {
        await assertFails(setDoc(doc(asMe(), 'users', ME, 'urgence', 'profile'), ice()));
        await assertFails(setDoc(doc(asMe(), 'ice', 'profile'), ice()));
    });
});

describe('un visiteur non connecté', () => {
    it.each(APP_DOCS)("ne lit ni n'écrit rien : %s/%s", async (sub, id) => {
        const ref = doc(anonymous(), 'users', ME, sub, id);
        await assertFails(getDoc(ref));
        await assertFails(setDoc(ref, { id }));
    });

    it('ne lit pas le document du compte', async () => {
        await assertFails(getDoc(doc(anonymous(), 'users', ME)));
    });

    it('ne peut rien lister', async () => {
        await assertFails(getDocs(collection(anonymous(), 'users')));
    });
});

// Rôles du pilote (js/services/access_service.js) : donnés à la main, jamais par l'application.
describe('rôles du pilote (access)', () => {
    beforeEach(async () => {
        await env.withSecurityRulesDisabled(async (context) => {
            for (const uid of [ME, OTHER]) {
                await setDoc(doc(context.firestore(), 'users', uid, 'access', 'profile'), { roles: ['beta'] });
            }
        });
    });
    const profile = (db, uid) => doc(db, 'users', uid, 'access', 'profile');

    it('le pilote lit ses propres rôles', async () => {
        await assertSucceeds(getDoc(profile(asMe(), ME)));
    });

    it('ne peut ni se donner un rôle, ni modifier ou supprimer les siens', async () => {
        await assertFails(setDoc(profile(asMe(), ME), { roles: ['beta', 'admin'] }));
        await assertFails(setDoc(doc(asMe(), 'users', ME, 'access', 'autre'), { roles: ['beta'] }));
        await assertFails(setDoc(profile(asMe(), ME), { roles: [] }, { merge: true }));
        await assertFails(deleteDoc(profile(asMe(), ME)));
    });

    it("ne lit pas les rôles d'un autre pilote", async () => {
        await assertFails(getDoc(profile(asMe(), OTHER)));
        await assertFails(setDoc(profile(asMe(), OTHER), { roles: ['beta'] }));
    });

    it('un visiteur non connecté ne lit rien', async () => {
        await assertFails(getDoc(profile(anonymous(), ME)));
    });
});

describe("tout ce que l'application n'utilise pas est refusé", () => {
    it('pushState est réservé à la Cloud Function (même pour son propriétaire)', async () => {
        const ref = doc(asMe(), 'users', ME, 'pushState', 'favoriteSitesFlyable');
        await assertFails(getDoc(ref));
        await assertFails(setDoc(ref, { favoris: 'faux' }));
        await assertFails(deleteDoc(ref));
    });

    it('une sous-collection inconnue est refusée, même sous son propre uid', async () => {
        await assertFails(setDoc(doc(asMe(), 'users', ME, 'inconnue', 'x'), { a: 1 }));
    });

    it('la liste de tous les utilisateurs est refusée', async () => {
        await assertFails(getDocs(collection(asMe(), 'users')));
    });

    it('une collection à la racine est refusée', async () => {
        await assertFails(setDoc(doc(asMe(), 'public', 'x'), { a: 1 }));
        await assertFails(getDoc(doc(asMe(), 'public', 'x')));
    });
});

// Le document de stats QCM tel que l'application l'écrit : le SDK Firestore refuse les tableaux
// imbriqués (le journal des réponses est donc un tableau plat d'entiers).
describe("document de stats QCM (forme écrite par l'application)", () => {
    const statsDoc = (answers) => ({
        totalQuestions: 2,
        totalCorrect: 1,
        themes: { Météo: { total: 2, correct: 1 } },
        questions: { A1V: { total: 2, correct: 1, streak: 0, recent: [1, 0], choicePicks: [1, 1, 0], answers } },
    });

    it('accepte le journal des réponses sous forme de tableau plat', async () => {
        await assertSucceeds(setDoc(doc(asMe(), 'users', ME, 'stats', 'qcm_stats'), statsDoc([20400 * 1024 + 2])));
    });

    it('refuse un journal en tableaux imbriqués (ancien format), côté SDK avant même les règles', async () => {
        // Le SDK peut lever l'erreur tout de suite ou par la promesse : l'async la ramène toujours à un rejet.
        const error = await (async () =>
            setDoc(doc(asMe(), 'users', ME, 'stats', 'qcm_stats'), statsDoc([[20400, 2]])))().then(
            () => null,
            (e) => e,
        );
        expect(String(error?.message)).toMatch(/Nested arrays/);
    });
});
