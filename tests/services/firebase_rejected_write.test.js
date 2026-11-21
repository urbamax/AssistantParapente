import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FirebaseAuthEngine, writeUnlessRejected } from '../../js/services/firebase_service.js';
import { createFakeFirestore } from '../fixtures/fake_firestore.js';

const denied = () => Object.assign(new Error('Missing or insufficient permissions.'), { code: 'permission-denied' });

describe('writeUnlessRejected', () => {
    afterEach(() => vi.restoreAllMocks());

    it('skips a document refused by the Firestore rules', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(await writeUnlessRejected(async () => {}, 'vol a')).toBe(true);
        expect(
            await writeUnlessRejected(async () => {
                throw denied();
            }, 'vol b'),
        ).toBe(false);
    });

    it('still stops on any other error (network, connection)', async () => {
        await expect(
            writeUnlessRejected(async () => {
                throw Object.assign(new Error('offline'), { code: 'unavailable' });
            }, 'vol c'),
        ).rejects.toThrow('offline');
    });
});

describe('a flight refused by the rules does not block the others', () => {
    let firestore;
    const defaultLoadFirestore = FirebaseAuthEngine._loadFirestore;

    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        firestore = createFakeFirestore({});
        const realSetDoc = firestore.module.setDoc;
        firestore.module.setDoc = vi.fn(async (ref, data) => {
            if (data && data.id === 'bad') throw denied();
            return realSetDoc(ref, data);
        });
        FirebaseAuthEngine._loadFirestore = async () => firestore.module;
        FirebaseAuthEngine.currentUser = { uid: 'u1' };
        FirebaseAuthEngine.enabled = true;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        FirebaseAuthEngine._loadFirestore = defaultLoadFirestore;
        FirebaseAuthEngine.currentUser = null;
        FirebaseAuthEngine.enabled = false;
    });

    it('uploads the flights after the refused one', async () => {
        const result = await FirebaseAuthEngine.syncLogbookData([
            { id: 'a', site: 'A', updatedAt: 1 },
            { id: 'bad', site: 'B', updatedAt: 1 },
            { id: 'c', site: 'C', updatedAt: 1 },
        ]);
        expect(result.success).toBe(true);
        expect(firestore.docs.has('users/u1/logbook/a')).toBe(true);
        expect(firestore.docs.has('users/u1/logbook/bad')).toBe(false);
        expect(firestore.docs.has('users/u1/logbook/c')).toBe(true);
    });
});
