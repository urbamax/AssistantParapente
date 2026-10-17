// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
    TRACE_MAX_PARTS,
    TRACE_PART_CHARS,
    ENCODING_GZIP,
    ENCODING_PLAIN,
    TraceTooLargeError,
    decodeTrace,
    encodeTrace,
    traceDigest,
    traceDocId,
} from '../../js/utils/trace_codec.js';

const IGC = readFileSync('tests/fixtures/syride-winch-flight.igc', 'utf8');

afterEach(() => vi.unstubAllGlobals());

describe('traceDocId', () => {
    it('relie le vol et le numéro du morceau', () => {
        expect(traceDocId('9b2f-uuid', 0)).toBe('9b2f-uuid_0');
        expect(traceDocId('9b2f-uuid', 11)).toBe('9b2f-uuid_11');
    });
});

describe('encodeTrace / decodeTrace', () => {
    it('rend exactement le texte envoyé (aller-retour)', async () => {
        const { parts, encoding } = await encodeTrace(IGC);
        expect(encoding).toBe(ENCODING_GZIP);
        expect(await decodeTrace(parts, encoding)).toBe(IGC);
    });

    it('compresse : le texte envoyé est bien plus court que la trace', async () => {
        const { parts, bytes } = await encodeTrace(IGC);
        expect(bytes).toBe(Buffer.byteLength(IGC));
        expect(parts.join('').length).toBeLessThan(bytes / 2);
    });

    it('garde les accents et les caractères hors ASCII (commentaires, noms de pilote)', async () => {
        const text = `${IGC}\nHFPLTPILOTINCHARGE:Zoé Hérault — vol d’été 🪂\n`;
        const { parts, encoding } = await encodeTrace(text);
        expect(await decodeTrace(parts, encoding)).toBe(text);
    });

    it('une trace courante tient en un seul morceau', async () => {
        expect((await encodeTrace(IGC)).parts).toHaveLength(1);
    });

    it('découpe une trace trop longue en plusieurs morceaux qui se recollent à l’identique', async () => {
        // Données quasi incompressibles pour forcer plusieurs morceaux avec une taille de morceau réduite.
        let seed = 12345;
        const noise = Array.from({ length: 4000 }, () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed.toString(36);
        }).join('');
        const { parts, encoding } = await encodeTrace(noise, { partChars: 6000 });
        expect(parts.length).toBeGreaterThan(1);
        expect(parts.length).toBeLessThanOrEqual(TRACE_MAX_PARTS);
        for (const part of parts.slice(0, -1)) expect(part).toHaveLength(6000);
        expect(await decodeTrace(parts, encoding)).toBe(noise);
    });

    it('refuse une trace qui dépasserait le nombre maximal de morceaux', async () => {
        const noise = Array.from({ length: 6000 }, (_, i) => (i * 2654435761).toString(36)).join('');
        await expect(encodeTrace(noise, { partChars: 50 })).rejects.toBeInstanceOf(TraceTooLargeError);
        await expect(encodeTrace(noise, { partChars: 50 })).rejects.toThrow(String(TRACE_MAX_PARTS));
    });

    it('refuse une trace vide ou qui n’est pas du texte', async () => {
        await expect(encodeTrace('')).rejects.toThrow('vide');
        await expect(encodeTrace(null)).rejects.toThrow('vide');
        await expect(encodeTrace(undefined)).rejects.toThrow('vide');
    });

    it('la taille d’un morceau reste très en dessous de la limite de 1 Mio d’un document Firestore', () => {
        expect(TRACE_PART_CHARS).toBeLessThan(900_000);
        expect(TRACE_PART_CHARS * TRACE_MAX_PARTS).toBeGreaterThan(5_000_000);
    });

    it('sans compression native, repli sur un simple base64 qui se relit', async () => {
        vi.stubGlobal('CompressionStream', undefined);
        const { parts, encoding } = await encodeTrace(IGC);
        expect(encoding).toBe(ENCODING_PLAIN);
        vi.unstubAllGlobals();
        expect(await decodeTrace(parts, encoding)).toBe(IGC);
    });

    it('une trace envoyée sans compression se relit aussi quand le navigateur sait décompresser', async () => {
        vi.stubGlobal('CompressionStream', undefined);
        const sent = await encodeTrace(IGC);
        vi.unstubAllGlobals();
        expect(await decodeTrace(sent.parts, sent.encoding)).toBe(IGC);
    });

    it('signale un navigateur qui ne peut pas décompresser, au lieu de rendre n’importe quoi', async () => {
        const { parts, encoding } = await encodeTrace(IGC);
        vi.stubGlobal('DecompressionStream', undefined);
        await expect(decodeTrace(parts, encoding)).rejects.toThrow('DecompressionStream');
    });

    it('des données corrompues lèvent une erreur', async () => {
        const { parts } = await encodeTrace(IGC);
        await expect(decodeTrace([parts[0].slice(0, 20) + '!!' + parts[0].slice(22)], ENCODING_GZIP)).rejects.toThrow();
        await expect(decodeTrace(['pas du base64 valide@@'], ENCODING_GZIP)).rejects.toThrow();
    });

    it('un codage inconnu est refusé', async () => {
        await expect(decodeTrace(['AAAA'], 'rot13')).rejects.toThrow('inconnu');
    });
});

describe('traceDigest', () => {
    it('est stable, change quand la trace change, et fait 32 caractères hexadécimaux', async () => {
        const a = await traceDigest(IGC);
        expect(a).toMatch(/^[0-9a-f]{32}$/);
        expect(await traceDigest(IGC)).toBe(a);
        expect(await traceDigest(IGC + ' ')).not.toBe(a);
    });

    it('vaut null quand le navigateur n’offre pas SubtleCrypto (page en http)', async () => {
        vi.stubGlobal('crypto', {});
        expect(await traceDigest(IGC)).toBeNull();
    });
});
