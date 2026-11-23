// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import QuizService from '../../js/services/quiz_service.js';

// Spec 064 : type de chaque piège et choix qu'il touche (positions des choix du CSV officiel).
const FILE = 'js/data/qcm_trap_types.json';
const data = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : null;
const questions = new Map(
    QuizService.parseQuestionsCSV(readFileSync('js/data/qcm_ffvl.csv', 'utf8'), {}, {})
        .filter((q) => !/^[HRX]/.test(q.code))
        .map((q) => [q.code, q]),
);
const TYPES = ['absolu', 'un_mot', 'cadre', 'inversion', 'vrai_hors_sujet', 'valeur', 'autre'];
const entries = data ? Object.entries(data).flatMap(([code, list]) => list.map((t) => [code, t])) : [];

describe('trap types data (spec 064)', () => {
    it('exists and covers hundreds of questions', () => {
        expect(data).toBeTypeOf('object');
        expect(data).not.toBeNull();
        expect(Object.keys(data).length).toBeGreaterThan(500);
    });

    it('every key is a paragliding question code', () => {
        expect(Object.keys(data).filter((c) => !questions.has(c))).toEqual([]);
    });

    it('every trap has an allowed type and valid choice positions', () => {
        const bad = entries.filter(
            ([code, t]) =>
                !TYPES.includes(t.type) ||
                !Array.isArray(t.choices) ||
                t.choices.length === 0 ||
                t.choices.some((i) => !Number.isInteger(i) || i < 0 || i >= questions.get(code).choices.length),
        );
        expect(bad).toEqual([]);
    });

    it('keeps « autre » rare (under 5 %)', () => {
        const other = entries.filter(([, t]) => t.type === 'autre').length;
        expect(other / entries.length).toBeLessThan(0.05);
    });

    it('covers every question that has « À lire de près » sentences', () => {
        const sentences = JSON.parse(readFileSync('js/data/qcm_question_traps.json', 'utf8'));
        expect(Object.keys(sentences).filter((c) => !data[c])).toEqual([]);
    });
});
