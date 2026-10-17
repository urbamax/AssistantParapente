// Règles Firestore (firestore.rules) testées sur l'émulateur : npm run test:rules
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
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
