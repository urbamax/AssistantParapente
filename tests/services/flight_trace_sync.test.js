// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    TRACE_UPLOADS_PER_SYNC,
    deleteFlightTraceParts,
    downloadFlightTrace,
    needsTraceUpload,
    stripTrace,
    uploadFlightTrace,
} from '../../js/services/flight_trace_sync.js';
import { TRACE_MAX_PARTS } from '../../js/utils/trace_codec.js';
import { createFakeFirestore } from '../fixtures/fake_firestore.js';

const IGC = readFileSync('tests/fixtures/syride-winch-flight.igc', 'utf8');
const db = {};
const ctx = (firestore, flightId = 'vol-1') => ({ firestore: firestore.module, db, uid: 'u1', flightId });
const partPaths = (firestore, flightId = 'vol-1') =>
    [...firestore.docs.keys()].filter((p) => p.startsWith(`users/u1/igcTraces/${flightId}_`)).sort();

/** Texte quasi incompressible : de quoi forcer plusieurs morceaux de 700 000 caractères. */
function noise(length) {
    let seed = 987654321;
    let out = '';
    while (out.length < length) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        out += seed.toString(36);
    }
    return out.slice(0, length);
}

describe('stripTrace', () => {
    it('retire rawIgc sans modifier le vol d’origine', () => {
        const flight = { id: 'a', site: 'Annecy', rawIgc: 'B...' };
        const sent = stripTrace(flight);
        expect(sent).toEqual({ id: 'a', site: 'Annecy' });
        expect('rawIgc' in sent).toBe(false);
        expect(flight.rawIgc).toBe('B...');
    });

    it('garde tout le reste, y compris traceCloud', () => {
        const flight = { id: 'a', traceCloud: { at: 5, parts: 1 }, igcStats: { x: 1 }, rawIgc: 'B' };
        expect(stripTrace(flight)).toEqual({ id: 'a', traceCloud: { at: 5, parts: 1 }, igcStats: { x: 1 } });
    });

    it('rend tel quel un vol sans trace, et laisse passer ce qui n’est pas un vol', () => {
        const flight = { id: 'a' };
        expect(stripTrace(flight)).toBe(flight);
        expect(stripTrace(null)).toBeNull();
        expect(stripTrace(undefined)).toBeUndefined();
    });
});

describe('needsTraceUpload', () => {
    it('envoie un vol dont aucune copie n’est dans le cloud', () => {
        expect(needsTraceUpload({})).toBe(true);
    });
    it('n’envoie pas deux fois la même trace', () => {
        expect(needsTraceUpload({ traceCloud: { at: 100 } })).toBe(false);
        expect(needsTraceUpload({ traceCloud: { at: 100 }, traceUpdatedAt: 100 })).toBe(false);
        expect(needsTraceUpload({ traceCloud: { at: 100 }, traceUpdatedAt: 50 })).toBe(false);
    });
    it('renvoie une trace remplacée depuis le dernier envoi', () => {
        expect(needsTraceUpload({ traceCloud: { at: 100 }, traceUpdatedAt: 101 })).toBe(true);
    });
    it('limite le travail de chaque synchro', () => {
        expect(TRACE_UPLOADS_PER_SYNC).toBeGreaterThanOrEqual(1);
        expect(TRACE_UPLOADS_PER_SYNC).toBeLessThanOrEqual(5);
    });
});

describe('uploadFlightTrace', () => {
    it('écrit un document par morceau, avec exactement les champs que les règles Firestore exigent', async () => {
        const firestore = createFakeFirestore();
        const meta = await uploadFlightTrace({ ...ctx(firestore), rawIgc: IGC });
        expect(partPaths(firestore)).toEqual(['users/u1/igcTraces/vol-1_0']);
        const part = firestore.docs.get('users/u1/igcTraces/vol-1_0');
        expect(Object.keys(part).sort()).toEqual(['data', 'encoding', 'flightId', 'index', 'total', 'updatedAt']);
        expect(part).toMatchObject({ flightId: 'vol-1', index: 0, total: 1, encoding: 'gzip-base64' });
        expect(typeof part.data).toBe('string');
        expect(meta).toMatchObject({ parts: 1, bytes: Buffer.byteLength(IGC), encoding: 'gzip-base64' });
        expect(meta.digest).toMatch(/^[0-9a-f]{32}$/);
        expect(meta.at).toBeGreaterThan(0);
    });

    it('n’écrit rien dans le document du vol : c’est à l’appelant de publier traceCloud', async () => {
        const firestore = createFakeFirestore({ 'users/u1/logbook/vol-1': { id: 'vol-1' } });
        await uploadFlightTrace({ ...ctx(firestore), rawIgc: IGC });
        expect(firestore.docs.get('users/u1/logbook/vol-1')).toEqual({ id: 'vol-1' });
    });

    it('découpe une longue trace en plusieurs morceaux numérotés', async () => {
        const firestore = createFakeFirestore();
        const text = noise(1_800_000);
        const meta = await uploadFlightTrace({ ...ctx(firestore), rawIgc: text });
        expect(meta.parts).toBeGreaterThan(1);
        expect(partPaths(firestore)).toHaveLength(meta.parts);
        for (let i = 0; i < meta.parts; i++) {
            expect(firestore.docs.get(`users/u1/igcTraces/vol-1_${i}`)).toMatchObject({ index: i, total: meta.parts });
        }
        const back = await downloadFlightTrace({ ...ctx(firestore), traceCloud: meta });
        expect(back).toBe(text);
    });

    it('retire les morceaux en trop quand une trace plus courte en remplace une plus longue', async () => {
        const firestore = createFakeFirestore();
        for (let i = 0; i < 3; i++) firestore.docs.set(`users/u1/igcTraces/vol-1_${i}`, { index: i });
        const meta = await uploadFlightTrace({ ...ctx(firestore), rawIgc: IGC, previousParts: 3 });
        expect(meta.parts).toBe(1);
        expect(partPaths(firestore)).toEqual(['users/u1/igcTraces/vol-1_0']);
    });

    it('un échec en cours d’envoi lève une erreur et ne renvoie aucun traceCloud', async () => {
        const firestore = createFakeFirestore();
        const text = noise(1_800_000);
        let calls = 0;
        const original = firestore.module.setDoc;
        firestore.module.setDoc = vi.fn(async (ref, data) => {
            if (++calls === 2) throw new Error('Missing or insufficient permissions');
            return original(ref, data);
        });
        await expect(uploadFlightTrace({ ...ctx(firestore), rawIgc: text })).rejects.toThrow(
            'insufficient permissions',
        );
    });

    it('refuse une trace trop longue pour 12 morceaux, sans rien écrire', async () => {
        const firestore = createFakeFirestore();
        await expect(uploadFlightTrace({ ...ctx(firestore), rawIgc: noise(12_000_000) })).rejects.toThrow(
            String(TRACE_MAX_PARTS),
        );
        expect(partPaths(firestore)).toEqual([]);
    });
});

describe('downloadFlightTrace', () => {
    async function uploaded() {
        const firestore = createFakeFirestore();
        const meta = await uploadFlightTrace({ ...ctx(firestore), rawIgc: IGC });
        return { firestore, meta };
    }

    it('relit exactement la trace envoyée (FR-2)', async () => {
        const { firestore, meta } = await uploaded();
        expect(await downloadFlightTrace({ ...ctx(firestore), traceCloud: meta })).toBe(IGC);
    });

    it('signale un morceau manquant plutôt que de rendre une trace tronquée', async () => {
        const { firestore, meta } = await uploaded();
        firestore.docs.delete('users/u1/igcTraces/vol-1_0');
        await expect(downloadFlightTrace({ ...ctx(firestore), traceCloud: meta })).rejects.toThrow('introuvable');
    });

    it('refuse une trace dont l’empreinte ne correspond pas', async () => {
        const { firestore, meta } = await uploaded();
        await expect(
            downloadFlightTrace({ ...ctx(firestore), traceCloud: { ...meta, digest: '0'.repeat(32) } }),
        ).rejects.toThrow('altérée');
    });

    it('accepte une trace sans empreinte (page en http)', async () => {
        const { firestore, meta } = await uploaded();
        expect(await downloadFlightTrace({ ...ctx(firestore), traceCloud: { ...meta, digest: null } })).toBe(IGC);
    });

    it('refuse des données corrompues', async () => {
        const { firestore, meta } = await uploaded();
        firestore.docs.set('users/u1/igcTraces/vol-1_0', {
            ...firestore.docs.get('users/u1/igcTraces/vol-1_0'),
            data: 'pas du base64 @@',
        });
        await expect(downloadFlightTrace({ ...ctx(firestore), traceCloud: meta })).rejects.toThrow();
    });
});

describe('deleteFlightTraceParts (FR-5)', () => {
    it('supprime tous les morceaux possibles du vol et seulement les siens', async () => {
        const firestore = createFakeFirestore();
        for (let i = 0; i < 4; i++) firestore.docs.set(`users/u1/igcTraces/vol-1_${i}`, { index: i });
        firestore.docs.set('users/u1/igcTraces/vol-2_0', { index: 0 });
        firestore.docs.set('users/u1/logbook/vol-1', { id: 'vol-1' });
        await deleteFlightTraceParts(ctx(firestore));
        expect(partPaths(firestore)).toEqual([]);
        expect(firestore.docs.has('users/u1/igcTraces/vol-2_0')).toBe(true);
        expect(firestore.docs.has('users/u1/logbook/vol-1')).toBe(true);
    });

    it('retire aussi les morceaux orphelins d’un envoi interrompu à la dernière position', async () => {
        const firestore = createFakeFirestore();
        firestore.docs.set(`users/u1/igcTraces/vol-1_${TRACE_MAX_PARTS - 1}`, { index: TRACE_MAX_PARTS - 1 });
        await deleteFlightTraceParts(ctx(firestore));
        expect(partPaths(firestore)).toEqual([]);
    });
});
