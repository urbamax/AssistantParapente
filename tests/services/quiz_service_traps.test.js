import { describe, it, expect, afterEach, vi } from 'vitest';
import QuizService from '../../js/services/quiz_service.js';

// Spec 061 : les phrases « À lire de près » se chargent avec les données du QCM, sans jamais
// empêcher le chargement des questions si leur fichier manque.
const QUESTIONS_CSV =
    "A92V,Une brise de vallée :,a,3,b,3,n'est jamais turbulente,-6,,,,\nA93V,Autre :,x,6,y,-6,,,,,,\n";
const EXPLANATIONS_CSV = 'code;question;explication\r\n';
const TRAPS = { A92V: ['Première phrase.', 'Deuxième phrase.'] };

function mockFetch({ trapsOk = true, trapsThrows = false } = {}) {
    return vi.fn(async (url) => {
        if (url.endsWith('qcm_ffvl.csv')) return { ok: true, text: async () => QUESTIONS_CSV };
        if (url.endsWith('qcm_ffvl_explanations.csv')) return { ok: true, text: async () => EXPLANATIONS_CSV };
        if (url.endsWith('question_course_mapping.json')) return { ok: true, json: async () => ({}) };
        if (url.endsWith('qcm_question_traps.json')) {
            if (trapsThrows) throw new Error('offline');
            return trapsOk ? { ok: true, json: async () => TRAPS } : { ok: false };
        }
        return { ok: false };
    });
}

async function load(opts) {
    QuizService.setQuestions([]);
    vi.stubGlobal('fetch', mockFetch(opts));
    const res = await QuizService.loadOfficialData();
    vi.unstubAllGlobals();
    return res;
}

describe('QuizService - question traps (spec 061)', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('loads the traps file and returns the sentences of a question in order', async () => {
        const res = await load();
        expect(res.success).toBe(true);
        expect(QuizService.getQuestionTraps('A92V')).toEqual(['Première phrase.', 'Deuxième phrase.']);
    });

    it('returns an empty frozen array for a question without traps', async () => {
        await load();
        const none = QuizService.getQuestionTraps('A93V');
        expect(none).toEqual([]);
        expect(Object.isFrozen(none)).toBe(true);
        expect(QuizService.getQuestionTraps(undefined)).toEqual([]);
    });

    it('still loads the questions when the traps file is missing', async () => {
        const res = await load({ trapsOk: false });
        expect(res.success).toBe(true);
        expect(QuizService.getQuestions().length).toBe(2);
        expect(QuizService.getQuestionTraps('A92V')).toEqual([]);
    });

    it('still loads the questions when fetching the traps file throws', async () => {
        const res = await load({ trapsThrows: true });
        expect(res.success).toBe(true);
        expect(QuizService.getQuestionTraps('A92V')).toEqual([]);
    });
});
