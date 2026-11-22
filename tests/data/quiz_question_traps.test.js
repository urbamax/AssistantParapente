// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import QuizService from '../../js/services/quiz_service.js';

// Spec 061 : les phrases de l'encart « À lire de près » (audit 6). Une à trois phrases par question,
// neutres (aucune adresse à l'élève), sans verdict, qui ne donnent pas la réponse.
const FILE = 'js/data/qcm_question_traps.json';
const traps = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : null;
const codes = new Set(
    QuizService.parseQuestionsCSV(readFileSync('js/data/qcm_ffvl.csv', 'utf8'), {}, {})
        .map((q) => q.code)
        .filter((c) => !/^[HRX]/.test(c)),
);
const VERDICT =
    /\b(?:justes?|faux|fausses?|vraie?s?|correcte?s?|exacte?s?|inexacte?s?|pi[eè]ges?)\b|bonne réponse|à tort/i;
const ADDRESS = /\b(?:tu|toi|ton|ta|tes|vous|votre|vos)\b|\b(?:repérez|regardez|regarde|repère|demandez|lisez|lis)\b/i;
const sentences = traps ? Object.entries(traps).flatMap(([code, list]) => list.map((s) => [code, s])) : [];

describe('question traps data (spec 061)', () => {
    it('exists and is an object keyed by question code', () => {
        expect(traps).toBeTypeOf('object');
        expect(traps).not.toBeNull();
        expect(Object.keys(traps).length).toBeGreaterThan(500);
    });

    it('every key is an existing paragliding question code', () => {
        expect(Object.keys(traps).filter((c) => !codes.has(c))).toEqual([]);
    });

    it('every question has 1 to 3 sentences', () => {
        const bad = Object.entries(traps).filter(([, l]) => !Array.isArray(l) || l.length < 1 || l.length > 3);
        expect(bad.map(([c]) => c)).toEqual([]);
    });

    it('every sentence is trimmed, ends with a period and is shorter than 140 characters', () => {
        const bad = sentences.filter(([, s]) => s !== s.trim() || !s.endsWith('.') || s.length >= 140);
        expect(bad).toEqual([]);
    });

    it('no sentence carries a verdict word', () => {
        expect(sentences.filter(([, s]) => VERDICT.test(s))).toEqual([]);
    });

    it('no sentence addresses the learner', () => {
        expect(sentences.filter(([, s]) => ADDRESS.test(s))).toEqual([]);
    });

    it('no semicolon and no straight double quote', () => {
        expect(sentences.filter(([, s]) => s.includes(';') || s.includes('"'))).toEqual([]);
    });
});
