import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Barème FFVL : chaque question vaut 6 points au plus (les bonnes réponses se partagent ces 6 points).
// Les totaux officiels des examens (30 x 6 = 180, 60 x 6 = 360) en dépendent. L14B valait 9 points
// (6 + 3) dans une ancienne version du QCM de jruffet/qcmffvl, corrigée le 2026-02-16 en 3 + 3.
describe('QCM FFVL : 6 points au plus par question', () => {
    it('chaque question rapporte 6 points quand toutes les bonnes réponses sont cochées', () => {
        const lines = readFileSync('js/data/qcm_ffvl.csv', 'utf8').split(/\r?\n/).filter(Boolean);
        const wrong = [];
        for (const line of lines) {
            // Les champs entre guillemets peuvent contenir des virgules.
            const fields = [];
            let cur = '';
            let quoted = false;
            for (const ch of line) {
                if (ch === '"') quoted = !quoted;
                else if (ch === ',' && !quoted) {
                    fields.push(cur);
                    cur = '';
                } else cur += ch;
            }
            fields.push(cur);
            let max = 0;
            for (let i = 3; i < fields.length; i += 2) {
                const pts = Number(fields[i]);
                if (pts > 0) max += pts;
            }
            if (max !== 6) wrong.push(`${fields[0]}: ${max}`);
        }
        expect(lines.length).toBeGreaterThan(800);
        expect(wrong).toEqual([]);
    });
});
