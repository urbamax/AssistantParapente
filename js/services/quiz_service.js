import StorageService from './storage.js';
import { toSorted } from '../utils/array_utils.js';
import { parseDateToMs } from '../utils/date_utils.js';
import { t } from '../utils/i18n.js';
import { floorPercent1 } from '../utils/text_utils.js';
import { isStatsConsentGranted } from './consent_store.js';
import { applySm2Review, dueScore, summarizeReviews } from './review_scheduler.js';
import { masteryRatio, masteryRatioAfterCorrect, pushAttempt } from './mastery.js';
import {
    appendAnswer,
    choiceIndex,
    flattenAnswerLogs,
    pickMask,
    readAnswerLog,
    removeLastAnswer,
    textChoiceIndex,
} from './answer_log.js';
import { QCM_DATA_REVISION, QCM_POINT_CORRECTIONS } from '../data/qcm_point_corrections.js';
import { diagnoseQuestionErrors } from './error_diagnostic.js';

// Tolérance sur la somme des maîtrises (flottants) pour décider que l'objectif est atteint.
const MASTERY_EPSILON = 1e-9;

// Distribution officielle FFVL des thèmes par bloc de 10 questions (source : qcm.ffvl.fr) :
// - 10% Matériel (1/10)
// - 20% Mécavol (2/10)
// - 20% Pilotage (2/10)
// - 10% Réglementation (1/10)
// - 20% Météo (2/10)
// - 10% Facteurs humains (1/10)
// - 10% Milieu naturel (1/10)
export const FFVL_THEME_DISTRIBUTION = Object.freeze([
    'Matériel',
    'Mécavol',
    'Mécavol',
    'Pilotage',
    'Pilotage',
    'Réglementation',
    'Météo',
    'Météo',
    'Facteurs humains',
    'Milieu naturel',
]);

// Quotas officiels des examens théoriques fédéraux FFVL :
// - Brevet Initial (BI) : 30 questions (3 blocs de 10)
// - Brevet de Pilote (BP) : 60 questions (6 blocs de 10)
// - Brevet de Pilote Confirmé (BPC) : 30 questions QCM (3 blocs de 10)
export const FFVL_EXAM_QUOTAS = Object.freeze({
    BI: Object.freeze({
        total: 30,
        themes: Object.freeze({
            Matériel: 3,
            Mécavol: 6,
            Pilotage: 6,
            Réglementation: 3,
            Météo: 6,
            'Facteurs humains': 3,
            'Milieu naturel': 3,
        }),
    }),
    BP: Object.freeze({
        total: 60,
        themes: Object.freeze({
            Matériel: 6,
            Mécavol: 12,
            Pilotage: 12,
            Réglementation: 6,
            Météo: 12,
            'Facteurs humains': 6,
            'Milieu naturel': 6,
        }),
    }),
    BPC: Object.freeze({
        total: 30,
        themes: Object.freeze({
            Matériel: 3,
            Mécavol: 6,
            Pilotage: 6,
            Réglementation: 3,
            Météo: 6,
            'Facteurs humains': 3,
            'Milieu naturel': 3,
        }),
    }),
});

export function getExamQuotas(level = 'BI') {
    return FFVL_EXAM_QUOTAS[level] || FFVL_EXAM_QUOTAS.BI;
}

// Compte, pour une question, combien de fois chaque choix a été coché (index = position dans les
// choix d'origine du CSV, voir `choiceIndex`). `sign` à -1 retire une réponse déjà comptée (examen :
// réponse modifiée). Tableau plat d'entiers : sérialisable par Firestore et simple à fusionner.
// Champ `choicePicks` : l'ancien `pickedChoices` indexait les choix mélangés de la séance, donc ses
// valeurs ne sont pas exploitables et il est ignoré.
export function addPickedChoices(qStat, question, selected, sign = 1) {
    const choices = question.choices || [];
    const counts = Array.from({ length: choices.length }, (_, i) => Number(qStat.choicePicks?.[i]) || 0);
    (selected || []).forEach((choice) => {
        const idx = choiceIndex(question, choice);
        if (idx >= 0) counts[idx] = Math.max(0, counts[idx] + sign);
    });
    qStat.choicePicks = counts;
}

// Enregistre une réponse dans les deux suivis du diagnostic : compteurs par choix et journal daté.
// `previous` est la réponse d'origine quand l'utilisateur corrige en examen : on la retire d'abord.
export function recordPicks(qStat, question, selected, previous) {
    if (previous) {
        addPickedChoices(qStat, question, previous, -1);
        qStat.answers = removeLastAnswer(qStat.answers, pickMask(question, previous));
    }
    addPickedChoices(qStat, question, selected);
    qStat.answers = appendAnswer(qStat.answers, pickMask(question, selected));
}

export function isExamBloated(exam) {
    if (!exam || !Array.isArray(exam.results)) return false;
    return exam.results.some(
        (r) =>
            r &&
            (r.theme !== undefined ||
                (r.question && typeof r.question === 'object') ||
                (Array.isArray(r.selected) && r.selected.some((s) => s && typeof s === 'object'))),
    );
}

export function compactExamResult(r, questionLookup) {
    if (!r || typeof r !== 'object') return r;
    const qObj = r.question;
    const code =
        (qObj && typeof qObj === 'object'
            ? qObj.code || qObj.id
            : r.code || r.questionCode || (typeof qObj === 'string' ? qObj : '')) || '';
    const isCorrect = r.isCorrect !== undefined ? Boolean(r.isCorrect) : false;

    const canonicalQ = code && typeof questionLookup === 'function' ? questionLookup(code) : null;
    const rawSelected = r.selected || [];
    const selected = Array.isArray(rawSelected)
        ? rawSelected.map((s) => {
              if (typeof s === 'number') return s;
              const text = typeof s === 'string' ? s : s?.text;
              if (canonicalQ && Array.isArray(canonicalQ.choices) && text !== undefined) {
                  const idx = textChoiceIndex(code, canonicalQ.choices, text);
                  if (idx !== -1) return idx;
              }
              if (qObj && Array.isArray(qObj.choices) && text !== undefined) {
                  const idx = textChoiceIndex(code, qObj.choices, text);
                  if (idx !== -1) return idx;
              }
              return text !== undefined ? text : s;
          })
        : [];

    return {
        code,
        isCorrect,
        selected,
    };
}

export function compactExam(exam, questionLookup) {
    if (!exam || typeof exam !== 'object') return exam;
    const results = Array.isArray(exam.results) ? exam.results.map((r) => compactExamResult(r, questionLookup)) : [];
    const base = {
        id: exam.id,
        date: exam.date,
        level: exam.level,
        score: exam.score !== undefined ? exam.score : 0,
        total: exam.total !== undefined ? exam.total : results.length,
        passed: exam.passed !== undefined ? exam.passed : false,
        invalidated: Boolean(exam.invalidated),
        results,
    };
    if (exam.scoreMode) base.scoreMode = exam.scoreMode;
    if (exam.questionsCorrect !== undefined) base.questionsCorrect = exam.questionsCorrect;
    if (exam.questionsTotal !== undefined) base.questionsTotal = exam.questionsTotal;
    if (exam.appliedToStats !== undefined) base.appliedToStats = exam.appliedToStats;
    if (exam.qcmRevision !== undefined) base.qcmRevision = exam.qcmRevision;
    return base;
}

/**
 * Calcule les points et le pourcentage officiel FFVL pour un examen.
 * Barème FFVL :
 * - Chaque question rapporte jusqu'à son maxScore (généralement 6 pts).
 * - Les mauvaises réponses entraînent un malus (points négatifs, ex: -6, -3).
 * - Plancher à 0 par question (la note d'une question ne descend jamais en dessous de 0).
 * - Seuil officiel de réussite : 75% des points totaux.
 *
 * @param {Array} results Tableau des résultats de la session (examResults)
 * @param {Array} sessionQuestions Questions de la session (qcmSessionData) si disponibles
 * @param {Function} questionLookup Fonction optionnelle pour retrouver une question par code
 * @returns {{ earnedPoints: number, totalPoints: number, percentage: number, passed: boolean }}
 */
export function calculateExamPoints(results = [], sessionQuestions = [], questionLookup = null) {
    let earnedPoints = 0;
    let totalPoints = 0;

    const count = Math.max(
        Array.isArray(results) ? results.length : 0,
        Array.isArray(sessionQuestions) ? sessionQuestions.length : 0,
    );

    for (let i = 0; i < count; i++) {
        const r = Array.isArray(results) ? results[i] : null;
        const qFromSession = Array.isArray(sessionQuestions) ? sessionQuestions[i] : null;
        const code =
            r?.code ||
            r?.questionCode ||
            (r?.question && (r.question.code || r.question.id)) ||
            qFromSession?.code ||
            '';
        const q =
            (r?.question && typeof r.question === 'object' ? r.question : null) ||
            qFromSession ||
            (typeof questionLookup === 'function' && code ? questionLookup(code) : null);

        let maxPts = 6;
        let userScore = 0;

        if (q && Array.isArray(q.choices)) {
            const pos = q.choices.filter((c) => c && c.pts > 0).reduce((sum, c) => sum + c.pts, 0);
            if (pos > 0) maxPts = pos;

            if (r) {
                if (typeof r.userPoints === 'number') {
                    userScore = r.userPoints;
                } else if (Array.isArray(r.selected)) {
                    const pickedIdx = new Set(
                        r.selected.map((s) =>
                            typeof s === 'number'
                                ? s
                                : textChoiceIndex(q.code || code, q.choices, typeof s === 'string' ? s : s?.text),
                        ),
                    );
                    let ptsSum = 0;
                    q.choices.forEach((choice, choiceIdx) => {
                        if (pickedIdx.has(choiceIdx) && typeof choice.pts === 'number') {
                            ptsSum += choice.pts;
                        }
                    });
                    userScore = ptsSum;
                } else if (r.isCorrect) {
                    userScore = maxPts;
                }
            }
        } else {
            maxPts = typeof r?.maxPoints === 'number' ? r.maxPoints : 6;
            if (r) {
                if (typeof r.userPoints === 'number') {
                    userScore = r.userPoints;
                } else if (r.isCorrect) {
                    userScore = maxPts;
                }
            }
        }

        totalPoints += maxPts;
        earnedPoints += Math.max(0, userScore);
    }

    const percentage = totalPoints > 0 ? floorPercent1(earnedPoints, totalPoints) : 0;
    // Seuil sur le ratio exact : 74,6 % arrondi à 75 % ne doit pas valider l'examen.
    const passed = totalPoints > 0 && earnedPoints * 100 >= totalPoints * 75;

    return {
        earnedPoints,
        totalPoints,
        percentage,
        passed,
    };
}

/**
 * Détermine si un ancien examen sauvegardé a besoin d'être migré au format par points.
 * @param {Object} exam
 * @returns {boolean}
 */
export function needsPointsMigration(exam) {
    if (!exam || typeof exam !== 'object') return false;
    if (exam.scoreMode === 'points') return false;
    return Array.isArray(exam.results) && exam.results.length > 0;
}

/**
 * Migre un examen historique au barème officiel de points FFVL.
 * @param {Object} rawExam
 * @param {Function} questionLookup
 * @returns {Object}
 */
export function migrateExamToPoints(rawExam, questionLookup) {
    if (!rawExam || typeof rawExam !== 'object') return rawExam;
    // Le pourcentage se recalcule depuis score/total : on n'en garde pas de copie (sauvegardes plus légères).
    // eslint-disable-next-line no-unused-vars
    const { percentage: _legacyPercentage, ...exam } = rawExam;
    const results = Array.isArray(exam.results) ? exam.results : [];
    if (results.length === 0) {
        return {
            ...exam,
            scoreMode: 'points',
            qcmRevision: QCM_DATA_REVISION,
        };
    }

    const pointsData = calculateExamPoints(results, [], questionLookup);
    const isInvalidated = Boolean(exam.invalidated);
    const questionsCorrect = results.filter((r) => r && r.isCorrect).length;
    const questionsTotal = exam.questionsTotal || results.length;

    return {
        ...exam,
        score: isInvalidated ? 0 : pointsData.earnedPoints,
        total: pointsData.totalPoints,
        passed: isInvalidated ? false : pointsData.passed,
        scoreMode: 'points',
        qcmRevision: QCM_DATA_REVISION,
        questionsCorrect,
        questionsTotal,
    };
}

/**
 * Recalcule le score d'un examen enregistré avec d'anciens points de questions (voir
 * js/data/qcm_point_corrections.js). Seules les questions corrigées changent : leur contribution
 * (points gagnés et maximum) est remplacée, le reste du score est conservé tel quel, y compris pour les
 * questions qui ne sont plus dans le QCM. L'examen est ensuite marqué de la révision courante : l'opération
 * ne se répète pas. Un examen invalidé garde son score de 0.
 * @param {any} exam
 * @param {(code: string) => any} questionLookup
 * @returns {any} le même objet s'il est déjà à jour, sinon une copie corrigée
 */
export function applyPointCorrections(exam, questionLookup) {
    if (!exam || typeof exam !== 'object') return exam;
    const from = Number(exam.qcmRevision) || 0;
    if (from >= QCM_DATA_REVISION) return exam;

    let score = exam.score;
    let total = exam.total;
    let changed = false;
    const adjustable =
        exam.scoreMode === 'points' &&
        !exam.invalidated &&
        Array.isArray(exam.results) &&
        Number.isFinite(score) &&
        Number.isFinite(total);

    if (adjustable) {
        const maxOf = (pts) => pts.reduce((sum, p) => sum + (p > 0 ? p : 0), 0);
        for (const correction of QCM_POINT_CORRECTIONS) {
            if (correction.revision <= from) continue;
            const choices = typeof questionLookup === 'function' ? questionLookup(correction.code)?.choices : null;
            if (!Array.isArray(choices) || choices.length !== correction.newPts.length) continue;
            for (const r of exam.results) {
                if (!r) continue;
                const code = r.code || r.questionCode || (r.question && (r.question.code || r.question.id));
                if (code !== correction.code) continue;
                const earnedWith = (pts) => {
                    if (!Array.isArray(r.selected)) return r.isCorrect ? maxOf(pts) : 0;
                    const picked = new Set(
                        r.selected.map((s) =>
                            typeof s === 'number'
                                ? s
                                : textChoiceIndex(code, choices, typeof s === 'string' ? s : s?.text),
                        ),
                    );
                    return Math.max(
                        0,
                        pts.reduce((sum, p, i) => sum + (picked.has(i) ? p : 0), 0),
                    );
                };
                score += earnedWith(correction.newPts) - earnedWith(correction.oldPts);
                total += maxOf(correction.newPts) - maxOf(correction.oldPts);
                changed = true;
            }
        }
    }

    const next = { ...exam, qcmRevision: QCM_DATA_REVISION };
    if (changed) {
        next.score = score;
        next.total = total;
        next.passed = total > 0 && score * 100 >= total * 75;
    }
    return next;
}

export function recalculateGlobalCounters(stats) {
    if (!stats || typeof stats !== 'object') return stats;
    let questionsTotal = 0;
    let questionsCorrect = 0;
    if (stats.questions && typeof stats.questions === 'object') {
        for (const q of Object.values(stats.questions)) {
            if (q && typeof q === 'object') {
                questionsTotal += Number(q.total) || 0;
                questionsCorrect += Number(q.correct) || 0;
            }
        }
    }
    let themesTotal = 0;
    let themesCorrect = 0;
    if (stats.themes && typeof stats.themes === 'object') {
        for (const t of Object.values(stats.themes)) {
            if (t && typeof t === 'object') {
                themesTotal += Number(t.total) || 0;
                themesCorrect += Number(t.correct) || 0;
            }
        }
    }
    const realTotal = Math.max(Number(stats.totalQuestions) || 0, questionsTotal, themesTotal);
    const realCorrect = Math.max(Number(stats.totalCorrect) || 0, questionsCorrect, themesCorrect);

    stats.totalQuestions = realTotal;
    stats.totalCorrect = realCorrect;
    return stats;
}

/**
 * Rétro-intègre les résultats d'un examen passé dans les statistiques du QCM (compteurs de questions,
 * de thèmes, streaks, recent, lastSeen, choix cochés).
 *
 * @param {any} exam
 * @param {any} stats
 * @param {(code: string) => any} questionLookup
 * @returns {boolean} true si les statistiques ont été modifiées
 */
export function replayExamToStats(exam, stats, questionLookup) {
    if (!exam || exam.invalidated || !Array.isArray(exam.results) || typeof questionLookup !== 'function') return false;
    if (exam.questionsTotal > 0 && exam.results.filter(Boolean).length < exam.questionsTotal) return false;
    const examDateMs = parseDateToMs(exam.date) || Date.now();
    const examDay = Math.floor(examDateMs / (24 * 60 * 60 * 1000));

    if (!stats.questions) stats.questions = {};
    if (!stats.themes) stats.themes = {};

    let modified = false;

    for (const r of exam.results) {
        if (!r) continue;
        const code = (
            (r.question && typeof r.question === 'object'
                ? r.question.code || r.question.id
                : r.code || r.questionCode || (typeof r.question === 'string' ? r.question : '')) || ''
        ).trim();
        if (!code) continue;
        const question = questionLookup(code) || (r.question && typeof r.question === 'object' ? r.question : null);
        if (!question) continue;

        const isCorrect = Boolean(r.isCorrect);
        const theme = question.theme || r.theme;

        if (!stats.questions[code]) {
            stats.questions[code] = { total: 0, correct: 0, streak: 0 };
        }
        const qStat = stats.questions[code];

        const choices = question.choices || [];
        let selectedOptions = [];
        if (Array.isArray(r.selected)) {
            selectedOptions = r.selected
                .map((s) => {
                    if (typeof s === 'number' && choices[s]) return choices[s];
                    if (typeof s === 'object' && s !== null) return s;
                    if (typeof s === 'string') {
                        const idx = textChoiceIndex(code, choices, s);
                        return idx >= 0 ? choices[idx] : { text: s, pts: 0 };
                    }
                    return null;
                })
                .filter(Boolean);
        }

        const mask = pickMask(question, selectedOptions);
        const prevReps = typeof qStat.repetitions === 'number' ? qStat.repetitions : qStat.streak || 0;
        const existingLog = readAnswerLog(qStat.answers);
        const alreadyLogged = existingLog.some(([day, m]) => day === examDay && m === mask);
        if (!alreadyLogged) {
            recordPicks(qStat, question, selectedOptions);
        }

        qStat.recent = pushAttempt(qStat, isCorrect);
        qStat.total = (qStat.total || 0) + 1;
        if (isCorrect) {
            qStat.correct = (qStat.correct || 0) + 1;
        }

        let s = 0;
        if (Array.isArray(qStat.recent)) {
            for (let i = qStat.recent.length - 1; i >= 0; i--) {
                if (qStat.recent[i] === 1) s++;
                else break;
            }
        }
        qStat.streak = s;
        const sm2 = applySm2Review(
            { ...qStat, repetitions: prevReps },
            {
                isCorrect,
                userScore: r.userPoints,
                maxScore: r.maxPoints,
                now: examDateMs,
            },
        );
        qStat.easeFactor = sm2.easeFactor;
        qStat.interval = sm2.interval;
        qStat.repetitions = sm2.repetitions;
        if (!qStat.lastSeen || examDateMs > qStat.lastSeen) {
            qStat.lastSeen = examDateMs;
        }

        if (theme) {
            if (!stats.themes[theme]) stats.themes[theme] = { total: 0, correct: 0 };
            stats.themes[theme].total = (stats.themes[theme].total || 0) + 1;
            if (isCorrect) {
                stats.themes[theme].correct = (stats.themes[theme].correct || 0) + 1;
            }
        }

        stats.totalQuestions = (stats.totalQuestions || 0) + 1;
        if (isCorrect) {
            stats.totalCorrect = (stats.totalCorrect || 0) + 1;
        }

        modified = true;
    }

    return modified;
}

class QuizService {
    constructor() {
        this.state = {
            qcmIndex: 0,
            qcmConfig: {
                mode: 'TRAINING', // TRAINING, EXAM, REVISION, MASTERY
                /** @type {number | 'ALL'} */
                count: 10,
                theme: 'ALL',
                masteryTarget: 75,
            },
            qcmSessionData: [],
            currentQcmSelection: new Set(),
            examResults: [],
            examSaved: false,
            isLoaded: false,
            loadingError: null,
        };
        this.questions = [];
        this._questionMap = null;
        this._questionMapSource = null;
        this.basePath = '.';
    }

    async init(basePath = '.') {
        console.log('QuizService.init() started, basePath:', basePath);
        this.basePath = basePath;
        try {
            const res = await this.loadOfficialData();
            console.log('QuizService.init() finished successfully', res);
            return res;
        } catch (e) {
            console.error('QuizService.init() failed', e);
            throw e;
        }
    }

    async loadOfficialData() {
        if (this.questions && this.questions.length > 0) {
            this.state.isLoaded = true;
            return { success: true, data: this.questions, error: null };
        }

        try {
            // URLs stables (sans paramètre horodaté) : le service worker les met en cache et les
            // ressert hors ligne ; une URL unique à chaque appel ne trouvait jamais de copie.
            const [questionsRes, explicationsRes, courseMappingRes] = await Promise.all([
                fetch(`${this.basePath}/js/data/qcm_ffvl.csv`),
                fetch(`${this.basePath}/js/data/qcm_ffvl_explanations.csv`),
                fetch(`${this.basePath}/js/data/question_course_mapping.json`),
            ]);

            if (!questionsRes.ok || !explicationsRes.ok) throw new Error('Failed to load QCM CSV data');

            const questionsCSV = await questionsRes.text();
            const explicationsCSV = await explicationsRes.text();
            // Le mapping question -> cours est un pré-requis mou (best-effort) : son absence ne
            // doit jamais empêcher le chargement des questions elles-mêmes.
            const courseMapping = courseMappingRes.ok ? await courseMappingRes.json() : {};

            const explications = this.parseExplicationsCSV(explicationsCSV);
            const questions = this.parseQuestionsCSV(questionsCSV, explications, courseMapping);

            this.setQuestions(questions);
            this.getExamHistory();
            this.state.isLoaded = true;
            return { success: true, data: questions, error: null };
        } catch (err) {
            this.state.loadingError = err.message || t('quiz.dialogs.unknownError');
            this.state.isLoaded = true;
            return { success: false, data: null, error: err.message };
        }
    }

    getQuestions() {
        return this.questions || [];
    }

    setQuestions(questions) {
        this.questions = Array.isArray(questions) ? questions : [];
        this._questionMap = null;
        this._questionMapSource = null;
    }

    getQuestionByCode(code) {
        if (!code) return null;
        const questions = this.getQuestions();
        if (!questions.length) return null;
        if (this._questionMapSource !== questions) {
            this._questionMap = new Map();
            questions.forEach((q) => {
                if (q.code) this._questionMap.set(q.code, q);
                if (q.id !== undefined && q.id !== q.code) this._questionMap.set(q.id, q);
            });
            this._questionMapSource = questions;
        }
        return this._questionMap.get(code) || null;
    }

    // Parseur CSV respectant les guillemets : les questions/explications contiennent parfois
    // des ';' littéraux à l'intérieur d'un champ (ex: "... vous avez perdu 600 m ; votre
    // finesse-sol..."), qu'un simple split(';') découperait à tort en colonnes supplémentaires.
    parseDelimitedLine(line, delimiter) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }

    parseExplicationsCSV(csvText) {
        const rows = csvText.split('\n');
        const data = {};
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i].trim();
            if (!row) continue;
            const parts = this.parseDelimitedLine(row, ';');
            if (parts.length >= 3) {
                const id = parts[0];
                // « \n » dans le CSV sépare les explications de chaque réponse : retour à la ligne à l'affichage.
                const expl = parts.slice(2).join(';').trim().replace(/\\n/g, '\n');
                data[id] = expl;
            }
        }
        return data;
    }

    parseQuestionsCSV(csvText, explications, courseMapping = {}) {
        try {
            const parseLine = (line) => {
                const result = [];
                let current = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === '"') inQuotes = !inQuotes;
                    else if (char === ',' && !inQuotes) {
                        result.push(current.trim());
                        current = '';
                    } else current += char;
                }
                result.push(current.trim());
                return result;
            };

            const rows = csvText.split('\n');
            const questions = [];

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i].trim();
                if (!row) continue;
                const cols = parseLine(row);
                if (cols.length < 4) continue;

                const code = cols[0];
                const questionText = cols[1];

                const ans = [];
                for (let j = 2; j < cols.length - 1; j += 2) {
                    if (cols[j] && cols[j + 1]) {
                        ans.push({ text: cols[j], pts: cols[j + 1] });
                    }
                }

                let niveau = 0;
                if (code.slice(-1) === 'V') niveau = 0;
                else if (code.slice(-1) === 'B') niveau = 1;
                else if (code.slice(-1) === 'M') niveau = 2;
                else if (code.slice(-1) === 'T') niveau = 3;

                const categoryPrefix = code.charAt(0);
                const pFlag = ['A', 'E', 'F', 'G', 'L', 'N', 'P', 'S', 'U', 'W'].includes(categoryPrefix);

                // On ne retient le lien "COURS" que pour les questions dont la page a été
                // vérifiée manuellement (texte du document relu et confronté aux réponses) :
                // le mapping brut question_course_mapping.json est un rapprochement par
                // similarité sémantique automatique, avec des scores de confiance faibles, et
                // ne doit jamais être présenté tel quel comme une source fiable.
                const mapping = courseMapping[code];
                const coursePage = mapping && mapping.verifiedPage ? mapping : null;
                // Quand plusieurs bonnes réponses relèvent de cours différents (ou de pages
                // différentes), le mapping garde les sources supplémentaires dans « others ».
                const extraCourses =
                    coursePage && Array.isArray(mapping.others)
                        ? mapping.others
                              .filter((o) => o && o.course_id && o.verifiedPage)
                              .map((o) => ({ courseId: o.course_id, coursePage: o.verifiedPage }))
                        : [];

                questions.push({
                    code,
                    question: questionText,
                    choices: ans.map((a) => ({ text: a.text, pts: parseInt(a.pts || 0) })),
                    niveau,
                    parapente: pFlag,
                    theme: this.getThemeForCode(code),
                    explication: explications[code] || '',
                    courseId: coursePage ? coursePage.course_id : null,
                    coursePage: coursePage ? coursePage.verifiedPage : null,
                    extraCourses,
                });
            }
            return questions;
        } catch (error) {
            console.error('Erreur critique lors du parsing du fichier CSV des questions :', error);
            return [];
        }
    }

    getThemeForCode(code) {
        if (!code) return 'Autre';
        const map = {
            A: 'Météo',
            E: 'Mécavol',
            G: 'Mécavol',
            H: 'Mécavol',
            L: 'Matériel',
            N: 'Matériel',
            R: 'Matériel',
            U: 'Pilotage',
            W: 'Pilotage',
            X: 'Pilotage',
            S: 'Réglementation',
            F: 'Facteurs humains',
            P: 'Milieu naturel',
        };
        return map[code.charAt(0)] || 'Autre';
    }

    shuffle(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    // Retourne une copie de la question avec ses choix mélangés (nouveau tableau, mêmes objets
    // choix) : ne mute jamais QuizService.questions[].choices, dont l'ordre canonique
    // reste stable pour la Banque de Questions.
    shuffleQuestionChoices(q) {
        if (!q || !Array.isArray(q.choices)) return { ...q };
        return { ...q, choices: this.shuffle(q.choices) };
    }

    getThemes() {
        const themes = new Set();
        const questions = this.getQuestions();
        questions.forEach((q) => {
            if (q.theme) themes.add(q.theme);
        });
        return toSorted(Array.from(themes));
    }

    getQuestionsByTheme() {
        const questions = this.getQuestions();
        if (!questions.length) return {};
        return Object.groupBy
            ? Object.groupBy(questions, (q) => q.theme || 'Autre')
            : questions.reduce((acc, q) => {
                  const t = q.theme || 'Autre';
                  (acc[t] = acc[t] || []).push(q);
                  return acc;
              }, {});
    }

    setMode(mode) {
        this.state.qcmConfig.mode = mode;
        // L'examen blanc doit toujours porter sur tous les thèmes selon la répartition FFVL officielle :
        // on force ce reset ici pour qu'un filtre thématique laissé actif en entraînement ne fuite jamais dans l'examen.
        if (mode === 'EXAM') this.state.qcmConfig.theme = 'ALL';
    }
    setCount(count) {
        this.state.qcmConfig.count = count;
    }
    setTheme(theme) {
        this.state.qcmConfig.theme = theme;
    }
    setMasteryTarget(target) {
        this.state.qcmConfig.masteryTarget = target;
    }

    // Maîtrise d'une question (0 à 1) : part de bonnes réponses sur ses dernières tentatives
    // (fenêtre glissante, voir mastery.js), 0 si jamais tentée. L'écran Statistiques utilise la
    // même mesure, pour que le mode Perfectionnement vise le chiffre affiché au pilote.
    getMasteryRatio(question, stats) {
        return masteryRatio(stats.questions[question.code]);
    }

    getMasteryScore(pool, stats) {
        return pool.reduce((sum, q) => sum + this.getMasteryRatio(q, stats), 0);
    }

    // Questions les moins maîtrisées du périmètre, chacune une seule fois, en nombre suffisant pour
    // que la moyenne atteigne `targetSum` si le pilote répond juste à chacune. Une question déjà
    // à 100 % ne peut plus rien apporter : elle n'est jamais choisie. Renvoie une liste vide quand
    // l'objectif est atteint.
    pickWeakestForTarget(pool, stats, targetSum) {
        const ranked = this.shuffle(pool)
            .map((q) => ({ q, ratio: this.getMasteryRatio(q, stats) }))
            .filter((x) => x.ratio < 1)
            .sort((a, b) => a.ratio - b.ratio);

        let projected = this.getMasteryScore(pool, stats);
        const picked = [];
        for (const { q, ratio } of ranked) {
            if (projected >= targetSum - MASTERY_EPSILON) break;
            picked.push(q);
            projected += masteryRatioAfterCorrect(stats.questions[q.code]) - ratio;
        }
        return picked;
    }

    buildMasterySelection(pool, stats, targetPct) {
        this._masteryPool = pool;
        this._masteryTargetPct = targetPct;
        this._masteryTargetSum = (targetPct / 100) * pool.length;

        const picked = this.pickWeakestForTarget(pool, stats, this._masteryTargetSum);
        if (picked.length > 0) return picked;

        // Objectif déjà atteint : on propose quand même une petite série de consolidation
        // sur les questions les plus fragiles, plutôt qu'une session vide.
        return this.shuffle(pool)
            .sort((a, b) => this.getMasteryRatio(a, stats) - this.getMasteryRatio(b, stats))
            .slice(0, Math.min(5, pool.length));
    }

    // Appelé après chaque réponse : recalcule combien de questions restent nécessaires pour atteindre
    // l'objectif, et ajuste la fin de la série en conséquence. Une erreur, ou une bonne réponse qui ne
    // fait pas passer la question à 100 % (l'ancienne erreur reste dans la fenêtre), rallonge la série
    // tout de suite ; la série se raccourcit si moins de questions suffisent. Rien n'est cumulé d'une
    // réponse à l'autre : tout est recalculé depuis les statistiques réelles, donc aucune dérive possible.
    advanceMasteryProgress() {
        if (!this._masteryPool) return;
        const session = this.state.qcmSessionData;
        const answered = this.state.qcmIndex + 1;
        const upcoming = session.slice(answered);

        const stats = this.getPersistentStats();
        const needed = this.pickWeakestForTarget(this._masteryPool, stats, this._masteryTargetSum).length;
        if (needed === upcoming.length) return;

        if (needed < upcoming.length) {
            session.length = answered + needed;
            return;
        }

        // Questions à ajouter : les moins maîtrisées qui ne sont pas déjà au programme. La question
        // qui vient d'être répondue passe en dernier, pour ne pas la reposer aussitôt.
        const planned = new Set(upcoming.map((q) => q.code));
        const justAnswered = session[this.state.qcmIndex]?.code;
        const candidates = this.shuffle(this._masteryPool)
            .filter((q) => !planned.has(q.code) && this.getMasteryRatio(q, stats) < 1)
            .sort((a, b) => this.getMasteryRatio(a, stats) - this.getMasteryRatio(b, stats))
            .sort((a, b) => Number(a.code === justAnswered) - Number(b.code === justAnswered));
        const extra = candidates.slice(0, needed - upcoming.length);
        session.push(...extra.map((q) => this.shuffleQuestionChoices(q)));
    }

    // Progression actuelle vers l'objectif du mode Perfectionnement, pour affichage en direct.
    getMasteryProgress() {
        const pool = this._masteryPool;
        if (!pool || pool.length === 0) return null;
        const score = this.getMasteryScore(pool, this.getPersistentStats());
        const target = this._masteryTargetPct || 75;
        // Un arrondi ne doit pas afficher l'objectif tant qu'il n'est pas réellement atteint.
        const reached = score >= this._masteryTargetSum - MASTERY_EPSILON;
        const rounded = Math.round((score / pool.length) * 100);
        return { current: reached ? Math.max(rounded, target) : Math.min(rounded, target - 1), target };
    }

    // Périmètre du mode Perfectionnement : le niveau, restreint au thème choisi.
    getMasteryScope(level = 'BI', theme = this.state.qcmConfig.theme) {
        const questions = this.getLevelQuestions(level);
        return theme && theme !== 'ALL' ? questions.filter((q) => q.theme === theme) : questions;
    }

    // Maîtrise actuelle (0 à 100, arrondie comme l'écran Statistiques) du périmètre choisi, et plage
    // des paliers proposables : de 1 point au-dessus de la maîtrise actuelle jusqu'à 100 %.
    // `complete` : toutes les questions du périmètre sont à 100 % (l'arrondi peut afficher 100 avant).
    getMasteryTargetBounds(level = 'BI', theme = this.state.qcmConfig.theme) {
        const pool = this.getMasteryScope(level, theme);
        const score = this.getMasteryScore(pool, this.getPersistentStats());
        const current = pool.length === 0 ? 0 : Math.round((score / pool.length) * 100);
        const complete = pool.length > 0 && score >= pool.length - MASTERY_EPSILON;
        return { current, min: Math.min(current + 1, 100), max: 100, complete };
    }

    // Questions proposables pour un niveau (BI, BP, BPC, TREUIL ou tout), sans filtre de thème.
    getLevelQuestions(level = 'BI') {
        let sourceData = this.getQuestions();
        const excludedPrefixes = ['H', 'R', 'X'];
        sourceData = sourceData.filter((q) => !excludedPrefixes.includes(q.code.charAt(0)));

        const hasLevel = (code, letter) => code.replace(/^[a-zA-Z]+\d+/, '').includes(letter);
        if (level === 'BI') {
            sourceData = sourceData.filter((q) => hasLevel(q.code, 'V'));
        } else if (level === 'BP') {
            sourceData = sourceData.filter((q) => hasLevel(q.code, 'B'));
        } else if (level === 'BPC') {
            sourceData = sourceData.filter((q) => hasLevel(q.code, 'M'));
        } else if (level === 'TREUIL') {
            sourceData = sourceData.filter((q) => hasLevel(q.code, 'T'));
        }
        return sourceData;
    }

    // Bilan de la répétition espacée pour le niveau et le thème choisis : combien de questions sont
    // nouvelles, à réviser ou pas encore à réviser, et la prochaine échéance (voir review_scheduler.js).
    getReviewSummary(level = 'BI') {
        const theme = this.state.qcmConfig.theme;
        let questions = this.getLevelQuestions(level);
        if (theme && theme !== 'ALL') questions = questions.filter((q) => q.theme === theme);
        return summarizeReviews(questions, this.getPersistentStats().questions || {});
    }

    // Sélection d'examen conforme à 100 % aux règles officielles de la FFVL :
    // - 30 questions pour le BI (Brevet Initial) et le BPC (Brevet de Pilote Confirmé)
    // - 60 questions pour le BP (Brevet de Pilote)
    // Répartition officielle FFVL par blocs de 10 questions (catDistrib qcm.ffvl.fr) :
    // 10% Matériel (1/10), 20% Mécavol (2/10), 20% Pilotage (2/10), 10% Réglementation (1/10),
    // 20% Météo (2/10), 10% Facteurs humains (1/10), 10% Milieu naturel (1/10).
    // Chaque bloc de 10 questions est mélangé pour garantir une variété homogène tout au long de l'épreuve.
    buildExamSelection(level = 'BI', sourceData = null) {
        const pool = [...(sourceData || this.getLevelQuestions(level))];
        if (pool.length === 0) return [];

        const targetCount = Math.min(getExamQuotas(level).total, pool.length);
        const shuffledPool = this.shuffle(pool);
        const used = new Set();
        const distributed = [];

        while (distributed.length < targetCount && used.size < shuffledPool.length) {
            const currentChunkSize = Math.min(10, targetCount - distributed.length);
            const currentChunk = [];
            let chunkRequirementIndex = 0;

            for (let i = 0; i < currentChunkSize; i++) {
                let found = false;

                // Tente d'attribuer la catégorie selon la grille officielle FFVL, avec bascule circulaire si épuisée
                for (let attempt = 0; attempt < FFVL_THEME_DISTRIBUTION.length; attempt++) {
                    const targetIdx = (chunkRequirementIndex + attempt) % FFVL_THEME_DISTRIBUTION.length;
                    const targetCat = FFVL_THEME_DISTRIBUTION[targetIdx];

                    for (let j = 0; j < shuffledPool.length; j++) {
                        if (!used.has(j) && shuffledPool[j].theme === targetCat) {
                            currentChunk.push(shuffledPool[j]);
                            used.add(j);
                            chunkRequirementIndex = (targetIdx + 1) % FFVL_THEME_DISTRIBUTION.length;
                            found = true;
                            break;
                        }
                    }

                    if (found) break;
                }

                // Fallback de sécurité si aucun thème de la distribution n'est disponible (ex: jeu de données réduit)
                if (!found) {
                    for (let j = 0; j < shuffledPool.length; j++) {
                        if (!used.has(j)) {
                            currentChunk.push(shuffledPool[j]);
                            used.add(j);
                            found = true;
                            break;
                        }
                    }
                }

                if (!found) break;
            }

            if (currentChunk.length === 0) break;
            distributed.push(...this.shuffle(currentChunk));
        }

        return distributed;
    }

    startSession(level = 'BI') {
        if (!this.state.isLoaded) throw new Error('Données QCM non chargées');

        let sourceData = this.getLevelQuestions(level);

        let count = this.state.qcmConfig.count;
        const selectedTheme = this.state.qcmConfig.mode === 'EXAM' ? 'ALL' : this.state.qcmConfig.theme;

        if (count === 'ALL') count = sourceData.length;

        let questions;
        if (this.state.qcmConfig.mode === 'REVISION') {
            const stats = this.getPersistentStats();
            if (selectedTheme !== 'ALL') sourceData = sourceData.filter((q) => q.theme === selectedTheme);

            // Répétition espacée (voir review_scheduler.js) : une question jamais vue passe en premier,
            // puis la plus en retard sur son échéance.
            const now = Date.now();
            const getDueScore = (q) => dueScore(stats.questions[q.code], now);

            // On mélange d'abord (comme l'ancienne implémentation) puis on trie par échéance :
            // le tri étant stable, les questions à égalité de priorité (ex: toutes "jamais vues")
            // gardent un ordre aléatoire au lieu de rester figées dans l'ordre du CSV source.
            const scored = this.shuffle(sourceData).map((q) => ({ q, dueScore: getDueScore(q) }));
            const dueOnly = scored.filter((x) => x.dueScore >= 0);

            // S'il n'y a rien d'échu (bon pilote, tout est encore "frais"), on retombe sur
            // l'ensemble des questions triées par échéance la plus proche, pour ne jamais bloquer
            // une session de révision sur un tableau vide.
            const pool = dueOnly.length > 0 ? dueOnly : scored;
            const filteredData = pool.sort((a, b) => b.dueScore - a.dueScore).map((x) => x.q);

            questions = filteredData.slice(0, count);
        } else if (this.state.qcmConfig.mode === 'MASTERY') {
            sourceData = this.getMasteryScope(level, selectedTheme);
            const stats = this.getPersistentStats();
            const target = this.state.qcmConfig.masteryTarget || 75;
            questions = this.buildMasterySelection(sourceData, stats, target);
        } else if (this.state.qcmConfig.mode === 'EXAM') {
            questions = this.buildExamSelection(level, sourceData);
            this.state.qcmConfig.count = questions.length;
        } else {
            if (selectedTheme !== 'ALL') sourceData = sourceData.filter((q) => q.theme === selectedTheme);
            questions = this.shuffle(sourceData).slice(0, count);
        }

        if (questions.length === 0) throw new Error('Aucune question trouvée');

        // Mélange l'ordre des choix de chaque question (sur une copie : les objets choix eux-mêmes
        // et le tableau canonique QuizService.questions[].choices ne sont pas mutés, pour que la
        // Banque de Questions garde un ordre de référence stable). Sans cela, la bonne réponse
        // apparaît toujours à la même position d'une session à l'autre et l'élève finit par
        // mémoriser un emplacement plutôt que la théorie.
        questions = questions.map((q) => this.shuffleQuestionChoices(q));

        this.state.qcmSessionData = questions;
        this.state.qcmIndex = 0;
        this.state.examResults = [];
        this.state.examSaved = false;
        this.state.invalidated = false;
        this.state.currentQcmSelection = new Set();
        return this.getCurrentQuestion();
    }

    getCurrentQuestion() {
        if (this.state.qcmIndex >= this.state.qcmSessionData.length) return null;
        return this.state.qcmSessionData[this.state.qcmIndex];
    }

    toggleSelection(opt) {
        if (this.state.currentQcmSelection.has(opt)) this.state.currentQcmSelection.delete(opt);
        else this.state.currentQcmSelection.add(opt);
        return Array.from(this.state.currentQcmSelection);
    }

    validate() {
        const question = this.getCurrentQuestion();
        if (!question) return null;

        const selectedOptions = Array.from(this.state.currentQcmSelection);
        let maxScore = 0;
        let userScore = 0;
        let hasNegativeEffect = false;

        question.choices.forEach((c) => {
            if (c.pts > 0) maxScore += c.pts;
            if (this.state.currentQcmSelection.has(c)) {
                userScore += c.pts;
                if (c.pts < 0) hasNegativeEffect = true;
            }
        });

        const isCorrect =
            this.state.qcmConfig.mode === 'EXAM'
                ? userScore === maxScore
                : userScore === maxScore && !hasNegativeEffect;

        const resultData = {
            question,
            selected: selectedOptions,
            correct: question.choices.filter((c) => c.pts > 0),
            isCorrect,
            userPoints: userScore,
            maxPoints: maxScore,
        };

        // En examen, les réponses ne sont enregistrées dans les statistiques qu'à la fin d'un
        // examen complet : un examen interrompu en plein milieu ne laisse aucune trace dans les stats.
        const previous = this.state.examResults[this.state.qcmIndex];
        this.state.examResults[this.state.qcmIndex] = resultData;

        if (this.state.qcmConfig.mode !== 'EXAM') {
            this.updateStats(question, isCorrect, selectedOptions, previous, Date.now(), {
                userScore,
                maxScore,
            });
        }
        if (this.state.qcmConfig.mode === 'MASTERY') this.advanceMasteryProgress();

        return resultData;
    }

    abortExamIfIncomplete() {
        if (this.state.qcmConfig.mode !== 'EXAM' || this.state.examSaved) return;
        const sessionLen = Array.isArray(this.state.qcmSessionData) ? this.state.qcmSessionData.length : 0;
        const answeredCount = Array.isArray(this.state.examResults) ? this.state.examResults.filter(Boolean).length : 0;
        if (this.state.invalidated || (sessionLen > 0 && answeredCount < sessionLen)) {
            this.state.examResults = [];
            this.state.qcmSessionData = [];
            this.state.currentQcmSelection = new Set();
            this.state.qcmIndex = 0;
            this.state.invalidated = false;
        }
    }

    _restoreSelection() {
        const selected = this.state.examResults[this.state.qcmIndex]?.selected || [];
        const question = this.getCurrentQuestion();
        if (!question || !Array.isArray(question.choices)) {
            this.state.currentQcmSelection = new Set(selected);
            return;
        }
        const choices = question.choices;
        const matched = selected.map(
            (s) => choices.find((c) => c === s || (c && s && c.text === s.text && c.pts === s.pts)) || s,
        );
        this.state.currentQcmSelection = new Set(matched);
    }

    nextQuestion() {
        this.state.qcmIndex++;
        this._restoreSelection();
        return this.getCurrentQuestion();
    }

    prevQuestion() {
        if (this.state.qcmIndex > 0) {
            this.state.qcmIndex--;
            this._restoreSelection();
        }
        return this.getCurrentQuestion();
    }

    // Sans consentement « statistiques » (RGPD), rien n'est écrit dans le stockage : les réponses ne
    // vivent qu'en mémoire, le temps de la visite, pour que Perfectionnement et Révision continuent de
    // fonctionner. Un rechargement les efface.
    _volatileStats = null;

    getPersistentStats() {
        if (!isStatsConsentGranted()) {
            if (!this._volatileStats) {
                this._volatileStats = { totalQuestions: 0, totalCorrect: 0, themes: {}, questions: {} };
            }
            return this._volatileStats;
        }
        const s = StorageService.get(StorageService.KEYS.QCM_STATS, { themes: {}, questions: {} });
        if (!s || typeof s !== 'object' || !s.themes)
            return { totalQuestions: 0, totalCorrect: 0, themes: {}, questions: {} };
        const prevTotal = s.totalQuestions;
        const prevCorrect = s.totalCorrect;
        recalculateGlobalCounters(s);
        const flattened = flattenAnswerLogs(s);
        let cleanedLegacyKeys = false;
        if ('appliedCorrections' in s || 'corrections' in s) {
            delete s.appliedCorrections;
            delete s.corrections;
            cleanedLegacyKeys = true;
        }
        if (flattened || cleanedLegacyKeys || s.totalQuestions !== prevTotal || s.totalCorrect !== prevCorrect) {
            StorageService.set(StorageService.KEYS.QCM_STATS, s);
            if (typeof window !== 'undefined' && window.FirebaseAuthEngine && window.FirebaseAuthEngine.enabled) {
                window.FirebaseAuthEngine.saveStatsToCloud();
            }
        }
        return s;
    }

    // Diagnostic des pièges d'une question d'après les statistiques enregistrées. Les index se lisent
    // sur la question d'origine, pas sur la copie mélangée de la séance.
    getTrapDiagnosis(question) {
        const original = this.getQuestionByCode(question.code) || question;
        return diagnoseQuestionErrors(original, this.getPersistentStats().questions?.[question.code]);
    }

    _persistStats(stats) {
        if (!isStatsConsentGranted()) {
            this._volatileStats = stats;
            return;
        }
        StorageService.set(StorageService.KEYS.QCM_STATS, stats);

        // Synchronisation immédiate vers Firebase si disponible
        if (window.FirebaseAuthEngine && window.FirebaseAuthEngine.enabled) {
            window.FirebaseAuthEngine.saveStatsToCloud();
        }
    }

    updateStats(shownQuestion, isCorrect, selected = [], previous = null, timestamp = Date.now(), options = {}) {
        const question = this.getQuestionByCode(shownQuestion.code) || shownQuestion;
        const stats = this.getPersistentStats();
        if (!stats.questions) stats.questions = {};
        if (!stats.themes) stats.themes = {};

        // Question specific stats
        if (!stats.questions[question.code]) {
            stats.questions[question.code] = { total: 0, correct: 0, streak: 0 };
        }
        const qStat = stats.questions[question.code];

        if (previous) {
            qStat.total = Math.max(0, (qStat.total || 0) - 1);
            if (previous.isCorrect) {
                qStat.correct = Math.max(0, (qStat.correct || 0) - 1);
            }
            if (Array.isArray(qStat.recent) && qStat.recent.length > 0) {
                qStat.recent.pop();
            }
            if (question.theme && stats.themes[question.theme]) {
                const tStatPrev = stats.themes[question.theme];
                tStatPrev.total = Math.max(0, (tStatPrev.total || 0) - 1);
                if (previous.isCorrect) {
                    tStatPrev.correct = Math.max(0, (tStatPrev.correct || 0) - 1);
                }
            }
            stats.totalQuestions = Math.max(0, (stats.totalQuestions || 0) - 1);
            if (previous.isCorrect) {
                stats.totalCorrect = Math.max(0, (stats.totalCorrect || 0) - 1);
            }
        }

        const prevReps = typeof qStat.repetitions === 'number' ? qStat.repetitions : qStat.streak || 0;

        recordPicks(qStat, question, selected, Array.isArray(previous?.selected) ? previous.selected : null);
        qStat.recent = pushAttempt(qStat, isCorrect);
        qStat.total = (qStat.total || 0) + 1;
        if (isCorrect) {
            qStat.correct = (qStat.correct || 0) + 1;
        }

        let s = 0;
        if (Array.isArray(qStat.recent)) {
            for (let i = qStat.recent.length - 1; i >= 0; i--) {
                if (qStat.recent[i] === 1) s++;
                else break;
            }
        }
        qStat.streak = s;
        qStat.lastSeen = timestamp;

        const sm2 = applySm2Review(
            { ...qStat, repetitions: prevReps },
            {
                isCorrect,
                userScore: options.userScore,
                maxScore: options.maxScore,
                explicitQuality: options.explicitQuality,
                now: timestamp,
            },
        );
        qStat.easeFactor = sm2.easeFactor;
        qStat.interval = sm2.interval;
        qStat.repetitions = sm2.repetitions;

        // Theme specific stats
        if (question.theme) {
            if (!stats.themes[question.theme]) {
                stats.themes[question.theme] = { total: 0, correct: 0 };
            }
            const tStat = stats.themes[question.theme];
            tStat.total = (tStat.total || 0) + 1;
            if (isCorrect) tStat.correct = (tStat.correct || 0) + 1;
        }

        // Global counters
        stats.totalQuestions = (stats.totalQuestions || 0) + 1;
        if (isCorrect) {
            stats.totalCorrect = (stats.totalCorrect || 0) + 1;
        }

        this._persistStats(stats);
    }

    calculateExamPoints(results, sessionQuestions) {
        return calculateExamPoints(results, sessionQuestions, (code) => this.getQuestionByCode(code));
    }

    needsPointsMigration(exam) {
        return needsPointsMigration(exam);
    }

    migrateExamToPoints(exam) {
        return migrateExamToPoints(exam, (code) => this.getQuestionByCode(code));
    }

    applyPointCorrections(exam) {
        return applyPointCorrections(exam, (code) => this.getQuestionByCode(code));
    }

    compactExamResult(r) {
        return compactExamResult(r, (code) => this.getQuestionByCode(code));
    }

    compactExamResults(results) {
        if (!Array.isArray(results)) return [];
        return results.map((r) => this.compactExamResult(r));
    }

    compactExam(exam) {
        return compactExam(exam, (code) => this.getQuestionByCode(code));
    }

    isExamBloated(exam) {
        return isExamBloated(exam);
    }

    // Une session d'examen ne produit qu'une entrée d'historique, et uniquement si l'examen est
    // allé jusqu'au bout sans être invalidé ni coupé en plein milieu.
    saveExamHistory(level) {
        if (this.state.examSaved) return;
        const results = Array.isArray(this.state.examResults) ? this.state.examResults : [];
        const answeredResults = results.filter(Boolean);
        const sessionLen = Array.isArray(this.state.qcmSessionData) ? this.state.qcmSessionData.length : 0;
        if (this.state.invalidated === true || (sessionLen > 0 && answeredResults.length < sessionLen)) {
            return;
        }
        this.state.examSaved = true;
        // Sans consentement « statistiques », l'examen n'entre ni dans l'historique ni dans les statistiques.
        if (!isStatsConsentGranted()) return;
        const history = this.getExamHistory();

        for (const r of answeredResults) {
            if (r && r.question) {
                this.updateStats(r.question, Boolean(r.isCorrect), Array.isArray(r.selected) ? r.selected : []);
            }
        }

        const pointsData = this.calculateExamPoints(results, this.state.qcmSessionData);
        const earnedPoints = pointsData.earnedPoints;
        const totalPoints = pointsData.totalPoints;
        const passed = pointsData.passed;
        const questionsCorrect = answeredResults.filter((r) => r && r.isCorrect).length;
        const questionsTotal = sessionLen > 0 ? sessionLen : results.length;

        const examId = 'exam_' + Date.now();
        const examDate = new Date().toISOString();
        history.unshift({
            id: examId,
            date: examDate,
            level: level,
            score: earnedPoints,
            total: totalPoints,
            passed: passed,
            invalidated: false,
            scoreMode: 'points',
            qcmRevision: QCM_DATA_REVISION,
            questionsCorrect,
            questionsTotal,
            results: this.compactExamResults(results),
            appliedToStats: true,
        });

        // Conserve tous les examens sans limite (pas de limitation à 20)

        const raw = StorageService.get(StorageService.KEYS.EXAM_HISTORY, { exams: [] });
        const deletedExamIds =
            raw && typeof raw === 'object' && Array.isArray(raw.deletedExamIds) ? raw.deletedExamIds : [];
        StorageService.set(StorageService.KEYS.EXAM_HISTORY, { exams: history, deletedExamIds });
        this.state.invalidated = false;

        const stats = this.getPersistentStats();
        if (!Array.isArray(stats.appliedExamIds)) stats.appliedExamIds = [];
        let statsUpdated = false;
        if (!stats.appliedExamIds.includes(examId)) {
            stats.appliedExamIds.push(examId);
            statsUpdated = true;
        }
        if (!stats.appliedExamIds.includes(examDate)) {
            stats.appliedExamIds.push(examDate);
            statsUpdated = true;
        }
        if (statsUpdated) {
            this._persistStats(stats);
        }

        // Synchronisation vers Firebase si disponible
        if (window.FirebaseAuthEngine && window.FirebaseAuthEngine.enabled) {
            window.FirebaseAuthEngine.saveHistoryToCloud();
        }
    }

    getExamHistory() {
        const h = StorageService.get(StorageService.KEYS.EXAM_HISTORY, []);

        let exams = [];
        // Handle legacy format: { exams: [...] }
        if (h && typeof h === 'object' && !Array.isArray(h) && Array.isArray(h.exams)) {
            exams = h.exams.filter((e) => e && typeof e === 'object' && e.date);
        } else if (Array.isArray(h)) {
            exams = h.filter((e) => e && typeof e === 'object' && e.date);
        }

        // Migration automatique des historiques d'examens volumineux, migration vers le barème en points FFVL,
        // et rétroaction des examens passés dans les statistiques générales.
        let needsMigration = false;
        const hasQuestions = this.questions && this.questions.length > 0;
        const migrated = exams.map((exam) => {
            let updated = exam;
            if (this.isExamBloated(updated) || updated.percentage !== undefined) {
                needsMigration = true;
                updated = this.compactExam(updated);
            }
            if (hasQuestions && this.needsPointsMigration(updated)) {
                needsMigration = true;
                updated = this.migrateExamToPoints(updated);
            }
            // Points de questions corrigés depuis l'enregistrement de l'examen (voir qcm_point_corrections.js).
            if (hasQuestions && (Number(updated.qcmRevision) || 0) < QCM_DATA_REVISION) {
                needsMigration = true;
                updated = this.applyPointCorrections(updated);
            }
            return updated;
        });

        if (hasQuestions && isStatsConsentGranted()) {
            const stats = this.getPersistentStats();
            if (!Array.isArray(stats.appliedExamIds)) stats.appliedExamIds = [];
            const appliedSet = new Set(stats.appliedExamIds.map(String));

            const unapplied = migrated.filter((e) => {
                const id = e.id || e.date;
                return !e.appliedToStats && !appliedSet.has(String(id)) && (!e.date || !appliedSet.has(String(e.date)));
            });

            if (unapplied.length > 0) {
                unapplied.sort((a, b) => parseDateToMs(a.date) - parseDateToMs(b.date));
                let statsChanged = false;
                for (const exam of unapplied) {
                    const ok = replayExamToStats(exam, stats, (code) => this.getQuestionByCode(code));
                    if (ok) {
                        statsChanged = true;
                    }
                    exam.appliedToStats = true;
                    const id = exam.id || exam.date;
                    appliedSet.add(String(id));
                    if (exam.date) appliedSet.add(String(exam.date));
                    if (!stats.appliedExamIds.includes(String(id))) {
                        stats.appliedExamIds.push(String(id));
                    }
                    if (exam.date && !stats.appliedExamIds.includes(String(exam.date))) {
                        stats.appliedExamIds.push(String(exam.date));
                    }
                    needsMigration = true;
                }
                if (statsChanged) {
                    recalculateGlobalCounters(stats);
                    this._persistStats(stats);
                }
            }
        }

        if (needsMigration && hasQuestions && isStatsConsentGranted()) {
            const deletedExamIds =
                h && typeof h === 'object' && Array.isArray(h.deletedExamIds) ? h.deletedExamIds : [];
            StorageService.set(StorageService.KEYS.EXAM_HISTORY, { exams: migrated, deletedExamIds });
            if (window.FirebaseAuthEngine && window.FirebaseAuthEngine.enabled) {
                window.FirebaseAuthEngine.saveHistoryToCloud();
            }
        }

        return migrated;
    }

    deleteExam(examId) {
        if (!examId) return null;
        const raw = StorageService.get(StorageService.KEYS.EXAM_HISTORY, { exams: [] });
        const history = Array.isArray(raw) ? raw : raw.exams || [];
        const target = history.find((e) => String(e.id) === String(examId) || String(e.date) === String(examId));
        const filtered = history.filter((e) => String(e.id) !== String(examId) && String(e.date) !== String(examId));

        const deletedIds =
            raw && typeof raw === 'object' && Array.isArray(raw.deletedExamIds) ? [...raw.deletedExamIds] : [];
        if (target) {
            if (target.id && !deletedIds.includes(String(target.id))) deletedIds.push(String(target.id));
            if (target.date && !deletedIds.includes(String(target.date))) deletedIds.push(String(target.date));
        } else if (!deletedIds.includes(String(examId))) {
            deletedIds.push(String(examId));
        }

        const newHistory = {
            exams: filtered,
            deletedExamIds: deletedIds.slice(-50),
        };

        StorageService.set(StorageService.KEYS.EXAM_HISTORY, newHistory);

        if (typeof window !== 'undefined' && window.FirebaseAuthEngine && window.FirebaseAuthEngine.enabled) {
            window.FirebaseAuthEngine.saveHistoryToCloud();
        }

        return newHistory;
    }
}

export default new QuizService();
