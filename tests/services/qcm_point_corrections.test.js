import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import QuizService, { calculateExamPoints, compactExamResult } from '../../js/services/quiz_service.js';
import StorageService from '../../js/services/storage.js';
import { textChoiceIndex } from '../../js/services/answer_log.js';
import { FirebaseAuthEngine } from '../../js/services/firebase_service.js';
import { QCM_DATA_REVISION, QCM_POINT_CORRECTIONS } from '../../js/data/qcm_point_corrections.js';
import { LEGACY_CHOICE_TEXTS } from '../../js/data/qcm_legacy_choice_texts.js';

// Les données du QCM suivent jruffet/qcmffvl : quand elles changent, les examens et les choix déjà
// enregistrés doivent suivre (points recalculés, anciens libellés retrouvés).
describe('Mise à jour des données enregistrées après une correction du QCM', () => {
    beforeEach(async () => {
        global.fetch = vi.fn().mockImplementation(async (url) => {
            const content = readFileSync(String(url).replace(/^\.\//, ''), 'utf8');
            return { ok: true, text: async () => content, json: async () => JSON.parse(content) };
        });
        QuizService.setQuestions([]);
        QuizService.state.isLoaded = false;
        await QuizService.init('.');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const examOf = (overrides) => ({
        id: 'exam_1',
        date: '2026-11-01T10:00:00.000Z',
        level: 'BI',
        scoreMode: 'points',
        invalidated: false,
        passed: false,
        results: [],
        ...overrides,
    });
    const load = (exams) => {
        StorageService.set(StorageService.KEYS.EXAM_HISTORY, { exams, deletedExamIds: [] });
        return QuizService.getExamHistory();
    };

    describe('table des corrections de points', () => {
        it('newPts correspond aux points actuels du CSV, oldPts à l’ancienne version', () => {
            for (const c of QCM_POINT_CORRECTIONS) {
                const q = QuizService.getQuestionByCode(c.code);
                expect(
                    q.choices.map((x) => x.pts),
                    c.code,
                ).toEqual([...c.newPts]);
                expect(c.revision).toBeLessThanOrEqual(QCM_DATA_REVISION);
                expect(c.oldPts).toHaveLength(c.newPts.length);
            }
            expect(Math.max(...QCM_POINT_CORRECTIONS.map((c) => c.revision))).toBe(QCM_DATA_REVISION);
        });
    });

    describe('examens enregistrés avec les anciens points de L14B (6 + 3 = 9)', () => {
        // Une autre question à 6 points, réussie, pour que le reste du score ne bouge pas.
        const other = { code: 'A1B', isCorrect: true, selected: [1] };

        it('remplace la contribution de L14B et garde le reste du score', () => {
            // Seule la réponse à 6 points cochée : 6 sur 9 avant, 3 sur 6 maintenant.
            const [exam] = load([
                examOf({ score: 12, total: 15, results: [{ code: 'L14B', isCorrect: false, selected: [1] }, other] }),
            ]);
            expect(exam.score).toBe(9);
            expect(exam.total).toBe(12);
            expect(exam.passed).toBe(true); // 9 / 12 = 75 % pile
            expect(exam.qcmRevision).toBe(QCM_DATA_REVISION);
        });

        it('les deux bonnes réponses cochées : 9 sur 9 devient 6 sur 6', () => {
            const [exam] = load([
                examOf({
                    score: 15,
                    total: 15,
                    passed: true,
                    results: [{ code: 'L14B', isCorrect: true, selected: [1, 3] }, other],
                }),
            ]);
            expect(exam.score).toBe(12);
            expect(exam.total).toBe(12);
            expect(exam.passed).toBe(true);
        });

        it('un mauvais choix coché fait perdre les points, plancher à 0 comme au calcul normal', () => {
            // 3 (bonne) - 6 (piège) < 0 : rien gagné, avant comme après.
            const [exam] = load([
                examOf({ score: 6, total: 15, results: [{ code: 'L14B', isCorrect: false, selected: [3, 0] }, other] }),
            ]);
            expect(exam.score).toBe(6);
            expect(exam.total).toBe(12);
        });

        it('retrouve la réponse même enregistrée par son texte', () => {
            const [exam] = load([
                examOf({
                    score: 12,
                    total: 15,
                    results: [
                        {
                            code: 'L14B',
                            isCorrect: false,
                            selected: [
                                "utilise ses capacités d'analyse des variations instantanées de pression statique",
                            ],
                        },
                        other,
                    ],
                }),
            ]);
            expect(exam.score).toBe(9);
        });

        it('laisse un examen invalidé à 0 et ne touche pas aux questions retirées du QCM', () => {
            const [invalid, withRemoved] = load([
                examOf({
                    id: 'a',
                    invalidated: true,
                    score: 0,
                    total: 15,
                    results: [{ code: 'L14B', isCorrect: false, selected: [1] }, other],
                }),
                examOf({
                    id: 'b',
                    date: '2026-11-02T10:00:00.000Z',
                    score: 12,
                    total: 15,
                    results: [
                        { code: 'N68T', isCorrect: true, selected: [0] },
                        { code: 'L14B', isCorrect: false, selected: [1] },
                    ],
                }),
            ]);
            expect(invalid.score).toBe(0);
            expect(invalid.total).toBe(15);
            expect(invalid.qcmRevision).toBe(QCM_DATA_REVISION);
            // Seule la contribution de L14B change : N68T (retirée du QCM) garde sa part du score.
            expect(withRemoved.score).toBe(9);
            expect(withRemoved.total).toBe(12);
        });

        it('ne change rien à un examen sans L14B, qui reçoit seulement la révision', () => {
            const [exam] = load([examOf({ score: 6, total: 12, results: [other, other] })]);
            expect(exam.score).toBe(6);
            expect(exam.total).toBe(12);
            expect(exam.qcmRevision).toBe(QCM_DATA_REVISION);
        });

        it("ne s'applique qu'une fois", () => {
            const first = load([
                examOf({ score: 12, total: 15, results: [{ code: 'L14B', isCorrect: false, selected: [1] }, other] }),
            ]);
            const second = QuizService.getExamHistory();
            expect(second[0].score).toBe(first[0].score);
            expect(second[0].total).toBe(first[0].total);
            const stored = StorageService.get(StorageService.KEYS.EXAM_HISTORY).exams[0];
            expect(stored.score).toBe(9);
            expect(stored.qcmRevision).toBe(QCM_DATA_REVISION);
        });

        it('un examen déjà à la révision courante est laissé tel quel', () => {
            const [exam] = load([
                examOf({
                    qcmRevision: QCM_DATA_REVISION,
                    score: 12,
                    total: 15,
                    results: [{ code: 'L14B', isCorrect: false, selected: [1] }, other],
                }),
            ]);
            expect(exam.score).toBe(12);
            expect(exam.total).toBe(15);
        });

        it('un ancien examen au décompte de questions est calculé directement avec les données actuelles', () => {
            const [exam] = load([
                examOf({
                    scoreMode: undefined,
                    score: 1,
                    total: 2,
                    results: [{ code: 'L14B', isCorrect: false, selected: [1] }, other],
                }),
            ]);
            expect(exam.scoreMode).toBe('points');
            expect(exam.qcmRevision).toBe(QCM_DATA_REVISION);
            expect(exam.score).toBe(9); // 3 (L14B) + 6 (A1B)
            expect(exam.total).toBe(12);
        });

        it('les statistiques de réussite ne bougent pas (la même réponse reste juste ou fausse)', () => {
            const q = QuizService.getQuestionByCode('L14B');
            const full = q.choices.filter((c) => c.pts > 0).reduce((sum, c) => sum + c.pts, 0);
            expect(full).toBe(6);
            // Les deux bonnes réponses cochées : juste avant (9 sur 9) et maintenant (6 sur 6).
            expect(
                calculateExamPoints([{ code: 'L14B', selected: [1, 3] }], [], (c) => QuizService.getQuestionByCode(c))
                    .earnedPoints,
            ).toBe(full);
        });
    });

    describe('anciens libellés corrigés par jruffet', () => {
        const pick = (predicate) => {
            for (const [code, texts] of Object.entries(LEGACY_CHOICE_TEXTS)) {
                const q = QuizService.getQuestionByCode(code);
                for (const [oldText, idx] of Object.entries(texts)) {
                    if (predicate(q, oldText, idx)) return { code, q, oldText, idx };
                }
            }
            return null;
        };

        it('chaque ancien libellé pointe vers un choix existant dont le texte a bien changé', () => {
            let checked = 0;
            for (const [code, texts] of Object.entries(LEGACY_CHOICE_TEXTS)) {
                const q = QuizService.getQuestionByCode(code);
                expect(q, code).toBeTruthy();
                for (const [oldText, idx] of Object.entries(texts)) {
                    expect(idx).toBeLessThan(q.choices.length);
                    expect(q.choices[idx].text, `${code} #${idx}`).not.toBe(oldText);
                    checked++;
                }
            }
            expect(checked).toBeGreaterThan(90);
        });

        it('retrouve un choix par son ancien texte, et par le texte actuel', () => {
            const { code, q, oldText, idx } = pick(() => true);
            expect(textChoiceIndex(code, q.choices, oldText)).toBe(idx);
            expect(textChoiceIndex(code, q.choices, q.choices[idx].text)).toBe(idx);
            expect(textChoiceIndex(code, q.choices, 'texte qui n’a jamais existé')).toBe(-1);
        });

        it("compacte une sélection enregistrée sous l'ancien texte en position", () => {
            const { code, q, oldText, idx } = pick(() => true);
            const compact = compactExamResult(
                { code, isCorrect: false, selected: [{ text: oldText, pts: 0 }, oldText] },
                (c) => QuizService.getQuestionByCode(c),
            );
            expect(compact.selected).toEqual([idx, idx]);
            expect(q.choices[idx]).toBeTruthy();
        });

        it('les points sont les mêmes que la réponse soit enregistrée par position, ancien texte ou texte actuel', () => {
            const { code, q, oldText, idx } = pick(() => true);
            const lookup = (c) => QuizService.getQuestionByCode(c);
            const byIndex = calculateExamPoints([{ code, selected: [idx] }], [], lookup).earnedPoints;
            const byOld = calculateExamPoints([{ code, selected: [oldText] }], [], lookup).earnedPoints;
            const byNew = calculateExamPoints([{ code, selected: [q.choices[idx].text] }], [], lookup).earnedPoints;
            expect(byOld).toBe(byIndex);
            expect(byNew).toBe(byIndex);
        });
    });

    describe('synchronisation cloud', () => {
        const stale = { id: 'e1', date: '2026-11-01T10:00:00.000Z', score: 12, total: 15, results: [] };
        const fresh = { ...stale, score: 9, total: 12, qcmRevision: QCM_DATA_REVISION };

        it("garde la copie aux points à jour, de quel côté qu'elle soit", () => {
            const a = FirebaseAuthEngine.mergeExamHistory({ exams: [{ ...stale }] }, { exams: [{ ...fresh }] });
            expect(a.exams[0].score).toBe(9);
            expect(a.exams[0].qcmRevision).toBe(QCM_DATA_REVISION);
            const b = FirebaseAuthEngine.mergeExamHistory({ exams: [{ ...fresh }] }, { exams: [{ ...stale }] });
            expect(b.exams[0].score).toBe(9);
        });

        it('garde le marquage « compté dans les statistiques » de l’autre copie', () => {
            const merged = FirebaseAuthEngine.mergeExamHistory(
                { exams: [{ ...stale, appliedToStats: true }] },
                { exams: [{ ...fresh }] },
            );
            expect(merged.exams[0].score).toBe(9);
            expect(merged.exams[0].appliedToStats).toBe(true);
        });
    });
});
