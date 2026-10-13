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
