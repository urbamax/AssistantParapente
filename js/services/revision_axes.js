// @ts-check
/**
 * Service de diagnostic et de parcours « Axes de révision » anti-bachotage (Spec 043).
 *
 * Découpe les 777 questions Parapente en 21 sous-chapitres pédagogiques, évalue l'état de maîtrise
 * et de répétition espacée de chaque chapitre pour le niveau actif, agrège les références de cours
 * PDF vérifiées (Principe III de la Constitution : uniquement les pages vérifiées > 0), extrait les
 * points clés à retenir sans exposer les choix QCM, et construit des ateliers ciblés équilibrés.
 */
import { masteryRatio } from './mastery.js';
import { isDue } from './review_scheduler.js';
import { FR } from '../i18n/fr.js';

/**
 * Catalogue ordonné des 21 axes pédagogiques couvrant les 7 thèmes officiels FFVL.
 * Les titres et sous-titres vivent dans `FR.quiz.axes.catalog[id]`.
 */
export const REVISION_AXES_CATALOG = Object.freeze([
    Object.freeze({ id: 'meteo-nuages-masses-air', category: 'Météo' }),
    Object.freeze({ id: 'meteo-pression-fronts', category: 'Météo' }),
    Object.freeze({ id: 'meteo-brises-aerologie', category: 'Météo' }),
    Object.freeze({ id: 'mecavol-forces-trainees', category: 'Mécavol' }),
    Object.freeze({ id: 'mecavol-polaire-finesse', category: 'Mécavol' }),
    Object.freeze({ id: 'mecavol-charge-decrochage', category: 'Mécavol' }),
    Object.freeze({ id: 'mecavol-pendulaire-fermetures', category: 'Mécavol' }),
    Object.freeze({ id: 'materiel-voile-suspentage', category: 'Matériel' }),
    Object.freeze({ id: 'materiel-homologation-sellette', category: 'Matériel' }),
    Object.freeze({ id: 'materiel-instruments-secours', category: 'Matériel' }),
    Object.freeze({ id: 'materiel-treuil', category: 'Matériel' }),
    Object.freeze({ id: 'reglementation-cadre-sites', category: 'Réglementation' }),
    Object.freeze({ id: 'reglementation-priorites-espaces', category: 'Réglementation' }),
    Object.freeze({ id: 'reglementation-treuil', category: 'Réglementation' }),
    Object.freeze({ id: 'pilotage-gonflage-decollage', category: 'Pilotage' }),
    Object.freeze({ id: 'pilotage-plan-vol-vent', category: 'Pilotage' }),
    Object.freeze({ id: 'pilotage-thermique-pente', category: 'Pilotage' }),
    Object.freeze({ id: 'pilotage-manoeuvres-incidents', category: 'Pilotage' }),
    Object.freeze({ id: 'pilotage-approche-atterrissage', category: 'Pilotage' }),
    Object.freeze({ id: 'facteurs-humains', category: 'Facteurs humains' }),
    Object.freeze({ id: 'milieu-naturel', category: 'Milieu naturel' }),
]);

const W_GONFLAGE_DECOLLAGE_NUMS = new Set([61, 62, 63, 68, 69, 70, 71, 72, 73]);
const W_APPROCHE_ATTERRO_NUMS = new Set([50, 51, 52, 53, 54, 55, 56, 82]);
const S_CADRE_SITES_EXTRA_NUMS = new Set([81, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105]);
const EXCLUDED_PREFIXES = new Set(['H', 'R', 'X']);

/**
 * Retourne le code canonique d'une question (`code` dans QuizService, ou `num`/`id` dans les tests).
 *
 * @param {{ code?: string, num?: string, id?: string }} question
 * @returns {string}
 */
export function getQuestionKey(question) {
    if (!question) return '';
    return String(question.code || question.num || question.id || '').trim();
}

/**
 * Détermine l'identifiant d'axe pédagogique (`axisId`) d'une question QCM FFVL.
 *
 * @param {{ code?: string, num?: string, id?: string, category?: string, theme?: string }} question
 * @returns {string | null}
 */
export function resolveAxisIdForQuestion(question) {
    const rawCode = getQuestionKey(question).toUpperCase();
    if (!rawCode) return null;
    const match = rawCode.match(/^([A-Z])(\d+)([A-Z]*)/);
    if (!match) return null;

    const prefix = match[1];
    const n = parseInt(match[2], 10);
    const suffix = match[3] || '';

    switch (prefix) {
        case 'A':
            if (n <= 31) return 'meteo-nuages-masses-air';
            if (n <= 77) return 'meteo-pression-fronts';
            return 'meteo-brises-aerologie';
        case 'E':
            if (n <= 29) return 'mecavol-forces-trainees';
            if (n <= 65) return 'mecavol-polaire-finesse';
            return 'mecavol-charge-decrochage';
        case 'G':
            return 'mecavol-pendulaire-fermetures';
        case 'N':
            if (n <= 34 || n === 60) return 'materiel-voile-suspentage';
            return 'materiel-homologation-sellette';
        case 'L':
            if (n <= 57) return 'materiel-instruments-secours';
            return 'materiel-treuil';
        case 'S': {
            const isTreuilOnly = suffix.includes('T') && !/[VBM]/.test(suffix);
            if (isTreuilOnly) return 'reglementation-treuil';
            if (n <= 44 || S_CADRE_SITES_EXTRA_NUMS.has(n)) return 'reglementation-cadre-sites';
            return 'reglementation-priorites-espaces';
        }
        case 'U':
            if (n <= 47) return 'pilotage-plan-vol-vent';
            if (n <= 67) return 'pilotage-thermique-pente';
            return 'pilotage-approche-atterrissage';
        case 'W':
            if (n <= 22 || W_GONFLAGE_DECOLLAGE_NUMS.has(n)) return 'pilotage-gonflage-decollage';
            if (W_APPROCHE_ATTERRO_NUMS.has(n)) return 'pilotage-approche-atterrissage';
            return 'pilotage-manoeuvres-incidents';
        case 'F':
            return 'facteurs-humains';
        case 'P':
            return 'milieu-naturel';
        default:
            return null;
    }
}

/**
 * Formate une liste de numéros de pages en plages compactes (ex: `[4, 5, 6, 9]` -> `"4–6, 9"`).
 *
 * @param {number[]} pages
 * @returns {string}
 */
export function formatPageRanges(pages) {
    if (!Array.isArray(pages) || pages.length === 0) return '';
    const uniqueSorted = [...new Set(pages.filter((p) => Number.isInteger(p) && p > 0))].sort((a, b) => a - b);
    if (uniqueSorted.length === 0) return '';

    /** @type {string[]} */
    const ranges = [];
    let start = uniqueSorted[0];
    let prev = start;

    for (let i = 1; i < uniqueSorted.length; i++) {
        const cur = uniqueSorted[i];
        if (cur === prev + 1) {
            prev = cur;
        } else {
            ranges.push(start === prev ? `${start}` : `${start}–${prev}`);
            start = cur;
            prev = cur;
        }
    }
    ranges.push(start === prev ? `${start}` : `${start}–${prev}`);
    return ranges.join(', ');
}

/**
 * Convertit une date (`Date`, `number` ou chaîne ISO) en timestamp millisecondes.
 *
 * @param {Date | number | string | undefined} value
 * @returns {number | undefined}
 */
function toMs(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string' && value.length > 0) {
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
}

/**
 * Classe l'état d'une question au sein de son axe à partir de ses statistiques.
 *
 * @param {{ total?: number, correct?: number, streak?: number, lastSeen?: number | string, recent?: number[] } | undefined} stat
 * @param {Date | number} [now]
 * @returns {'unattempted' | 'struggling' | 'hesitant' | 'due' | 'mastered'}
 */
export function classifyQuestionForAxis(stat, now = Date.now()) {
    const total = stat?.total || 0;
    if (total <= 0) return 'unattempted';

    const ratio = masteryRatio(stat);
    const streak = typeof stat?.streak === 'number' ? stat.streak : 0;

    if (ratio < 0.5 || (total >= 2 && streak === 0)) {
        return 'struggling';
    }
    if (ratio < 0.85) {
        return 'hesitant';
    }

    const nowMs = toMs(now) ?? Date.now();
    const lastSeenMs = toMs(stat?.lastSeen);
    const normalizedStat = { ...stat, lastSeen: lastSeenMs };

    if (isDue(normalizedStat, nowMs)) {
        return 'due';
    }
    return 'mastered';
}

/**
 * Nettoie une explication pédagogique en retirant la mention technique de fin de génération.
 *
 * @param {string | undefined} raw
 * @returns {string}
 */
export function cleanAxisExplanation(raw) {
    if (typeof raw !== 'string') return '';
    return raw.replace(/\n*\s*Aucune source trouv[eé]e dans les documents fournis\.?\s*$/i, '').trim();
}

/**
 * Vérifie si une question appartient au niveau sélectionné (compatible avec `QuizService.getLevelQuestions`
 * et avec les objets de test munis de `levels: ['BI', ...]`).
 *
 * @param {{ code?: string, num?: string, id?: string, parapente?: boolean, levels?: string[] }} q
 * @param {string} level
 * @returns {boolean}
 */
export function matchesQuestionLevel(q, level) {
    if (!q) return false;
    if (q.parapente === false) return false;
    const rawCode = getQuestionKey(q);
    if (!rawCode) return false;
    if (EXCLUDED_PREFIXES.has(rawCode.charAt(0).toUpperCase())) return false;

    if (!level || level === 'ALL') return true;
    if (Array.isArray(q.levels)) {
        return q.levels.includes(level);
    }

    const suffix = rawCode.replace(/^[a-zA-Z]+\d+/, '').toUpperCase();
    if (level === 'BI') return suffix.includes('V');
    if (level === 'BP') return suffix.includes('B');
    if (level === 'BPC') return suffix.includes('M');
    if (level === 'TREUIL') return suffix.includes('T');
    return true;
}

/**
 * Extrait la table des statistiques par question depuis `persistentStats` ou un dictionnaire direct.
 *
 * @param {Record<string, any> | undefined} statsOrContainer
 * @returns {Record<string, any>}
 */
function resolveQuestionStatsMap(statsOrContainer) {
    if (!statsOrContainer || typeof statsOrContainer !== 'object') return {};
    if (statsOrContainer.questions && typeof statsOrContainer.questions === 'object') {
        return statsOrContainer.questions;
    }
    return statsOrContainer;
}

/**
 * Agrège les lectures de cours vérifiées pour un ensemble de questions d'un axe.
 * Principe III de la Constitution : seules les entrées dotées d'un `courseId` connu et d'une
 * page entière strictement positive (`verifiedPage`) sont retenues.
 *
 * @param {Array<{ q: any, bucket: string }>} classifiedQuestions
 * @param {Map<string, { id: string, title: string, category: string, file: string }>} coursesById
 */
function aggregateCourseReadings(classifiedQuestions, coursesById) {
    /** @type {Map<string, { course: { id: string, title: string, category: string, file: string }, pages: Set<number>, focusHits: number, totalHits: number }>} */
    const byCourse = new Map();

    const focusBuckets = new Set(['struggling', 'hesitant', 'due']);
    const hasFocusQuestions = classifiedQuestions.some((item) => focusBuckets.has(item.bucket));

    for (const { q, bucket } of classifiedQuestions) {
        const isFocus = focusBuckets.has(bucket);
        /** @type {Array<{ courseId?: string | null, page?: number | null }>} */
        const refs = [];
        if (q.courseId && Number.isInteger(q.coursePage) && q.coursePage > 0) {
            refs.push({ courseId: q.courseId, page: q.coursePage });
        }
        if (Array.isArray(q.extraCourses)) {
            for (const extra of q.extraCourses) {
                const extraPage = extra?.coursePage ?? extra?.page;
                if (extra && extra.courseId && Number.isInteger(extraPage) && extraPage > 0) {
                    refs.push({ courseId: extra.courseId, page: extraPage });
                }
            }
        }

        for (const ref of refs) {
            const course = ref.courseId ? coursesById.get(ref.courseId) : undefined;
            if (!course || !course.file || !Number.isInteger(ref.page) || Number(ref.page) <= 0) continue;

            let entry = byCourse.get(course.id);
            if (!entry) {
                entry = { course, pages: new Set(), focusHits: 0, totalHits: 0 };
                byCourse.set(course.id, entry);
            }
            entry.totalHits += 1;
            if (isFocus) {
                entry.focusHits += 1;
                entry.pages.add(Number(ref.page));
            } else if (!hasFocusQuestions) {
                entry.pages.add(Number(ref.page));
            }
        }
    }

    if (hasFocusQuestions) {
        for (const { q } of classifiedQuestions) {
            if (q.courseId && Number.isInteger(q.coursePage) && q.coursePage > 0) {
                const entry = byCourse.get(q.courseId);
                if (entry && entry.pages.size === 0) {
                    entry.pages.add(q.coursePage);
                }
            }
        }
    }

    const readings = [];
    for (const entry of byCourse.values()) {
        if (entry.pages.size === 0) continue;
        const sortedPages = [...entry.pages].sort((a, b) => a - b);
        const pageLinks = sortedPages.slice(0, 8).map((page) => ({
            page,
            url: `${entry.course.file}#page=${page}`,
        }));
        readings.push({
            courseId: entry.course.id,
            title: entry.course.title,
            category: entry.course.category,
            file: entry.course.file,
            pages: sortedPages,
            pageRangesText: formatPageRanges(sortedPages),
            primaryUrl: `${entry.course.file}#page=${sortedPages[0]}`,
            pageLinks,
            focusHitCount: entry.focusHits,
            totalHitCount: entry.totalHits,
        });
    }

    readings.sort((a, b) => {
        if (b.focusHitCount !== a.focusHitCount) return b.focusHitCount - a.focusHitCount;
        if (b.totalHitCount !== a.totalHitCount) return b.totalHitCount - a.totalHitCount;
        return a.title.localeCompare(b.title, 'fr');
    });

    return readings.slice(0, 4);
}

/**
 * Extrait les points clés à retenir (`takeaways`) pour un axe, sans exposer l'énoncé QCM ni les
 * propositions A/B/C/D.
 *
 * @param {Array<{ q: any, key: string, bucket: 'unattempted' | 'struggling' | 'hesitant' | 'due' | 'mastered', ratio: number }>} classifiedQuestions
 * @param {Map<string, { id: string, title: string, category: string, file: string }>} coursesById
 * @param {number} [maxItems]
 */
function buildAxisTakeaways(classifiedQuestions, coursesById, maxItems = 6) {
    /** @type {Record<string, number>} */
    const bucketOrder = {
        struggling: 0,
        hesitant: 1,
        due: 2,
        unattempted: 3,
        mastered: 4,
    };

    const withExplanations = classifiedQuestions
        .map((item) => ({
            ...item,
            cleanedExplanation: cleanAxisExplanation(item.q.explication),
        }))
        .filter((item) => item.cleanedExplanation.length > 0);

    withExplanations.sort((a, b) => {
        const orderDiff = (bucketOrder[a.bucket] ?? 9) - (bucketOrder[b.bucket] ?? 9);
        if (orderDiff !== 0) return orderDiff;
        if (a.ratio !== b.ratio) return a.ratio - b.ratio;
        return a.key.localeCompare(b.key, 'fr', { numeric: true });
    });

    return withExplanations.slice(0, maxItems).map((item) => {
        const hasVerifiedCourse =
            Boolean(item.q.courseId) && Number.isInteger(item.q.coursePage) && item.q.coursePage > 0;
        const course = hasVerifiedCourse ? coursesById.get(item.q.courseId) : undefined;

        return {
            questionId: item.key,
            questionNum: item.q.num || item.key,
            bucket: item.bucket,
            explanation: item.cleanedExplanation,
            courseTitle: course ? course.title : null,
            coursePage: course ? item.q.coursePage : null,
            courseUrl: course ? `${course.file}#page=${item.q.coursePage}` : null,
        };
    });
}

/**
 * Normalise `coursesData` (tableau ou dictionnaire `COURSES_DATA`) en `Map<courseId, { id, title, category, file }>`.
 *
 * @param {any} coursesData
 * @returns {Map<string, { id: string, title: string, category: string, file: string }>}
 */
function normalizeCoursesMap(coursesData) {
    const coursesById = new Map();
    if (!coursesData) return coursesById;

    if (Array.isArray(coursesData)) {
        for (const c of coursesData) {
            const file = c?.file || c?.pdf;
            if (c && c.id && file) {
                coursesById.set(c.id, {
                    id: c.id,
                    title: c.title || c.id,
                    category: c.category || '',
                    file,
                });
            }
        }
    } else if (typeof coursesData === 'object') {
        for (const [id, c] of Object.entries(coursesData)) {
            const file = c?.file || c?.pdf;
            if (c && id && file) {
                coursesById.set(id, {
                    id,
                    title: c.title || id,
                    category: c.category || '',
                    file,
                });
            }
        }
    }
    return coursesById;
}

/**
 * Calcule le diagnostic complet des axes de révision pour un niveau donné.
 *
 * @param {any[]} questions
 * @param {Record<string, any>} stats
 * @param {any} coursesData
 * @param {{ level?: string, now?: Date | number }} [options]
 */
export function buildRevisionAxes(questions, stats = {}, coursesData = [], options = {}) {
    const level = options.level || 'ALL';
    const now = options.now ?? Date.now();
    const questionStatsMap = resolveQuestionStatsMap(stats);
    const coursesById = normalizeCoursesMap(coursesData);

    /** @type {Map<string, any[]>} */
    const grouped = new Map();
    for (const def of REVISION_AXES_CATALOG) {
        grouped.set(def.id, []);
    }

    if (Array.isArray(questions)) {
        for (const q of questions) {
            if (!matchesQuestionLevel(q, level)) continue;
            const axisId = resolveAxisIdForQuestion(q);
            if (axisId && grouped.has(axisId)) {
                grouped.get(axisId)?.push(q);
            }
        }
    }

    const catalogCopy = /** @type {Record<string, { title: string, subtitle: string }>} */ (
        FR.quiz?.axes?.catalog || {}
    );

    const axes = [];
    /** @type {Record<'ALL' | 'BLOCKER' | 'REFRESH' | 'EXPLORE' | 'MASTERED', number>} */
    const counts = {
        ALL: 0,
        BLOCKER: 0,
        REFRESH: 0,
        EXPLORE: 0,
        MASTERED: 0,
    };

    for (let idx = 0; idx < REVISION_AXES_CATALOG.length; idx++) {
        const def = REVISION_AXES_CATALOG[idx];
        const axisQuestions = grouped.get(def.id) || [];
        if (axisQuestions.length === 0) continue;

        let strugglingCount = 0;
        let hesitantCount = 0;
        let dueCount = 0;
        let unattemptedCount = 0;
        let masteredCount = 0;
        let sumMastery = 0;
        let sumAttemptedMastery = 0;

        /** @type {Array<{ q: any, key: string, bucket: 'unattempted' | 'struggling' | 'hesitant' | 'due' | 'mastered', ratio: number }>} */
        const classified = [];

        for (const q of axisQuestions) {
            const key = getQuestionKey(q);
            const stat = questionStatsMap[key] ?? (q.id ? questionStatsMap[q.id] : undefined);
            const ratio = masteryRatio(stat);
            const bucket = classifyQuestionForAxis(stat, now);
            sumMastery += ratio;

            if (bucket === 'unattempted') {
                unattemptedCount += 1;
            } else {
                sumAttemptedMastery += ratio;
                if (bucket === 'struggling') strugglingCount += 1;
                else if (bucket === 'hesitant') hesitantCount += 1;
                else if (bucket === 'due') dueCount += 1;
                else masteredCount += 1;
            }

            classified.push({ q, key, bucket, ratio });
        }

        const totalQuestions = axisQuestions.length;
        const attemptedCount = totalQuestions - unattemptedCount;
        const masteryPct = Math.round((sumMastery / totalQuestions) * 100);
        const attemptedMasteryPct = attemptedCount > 0 ? Math.round((sumAttemptedMastery / attemptedCount) * 100) : 0;

        /** @type {'BLOCKER' | 'REFRESH' | 'EXPLORE' | 'MASTERED'} */
        let status = 'MASTERED';
        if (strugglingCount > 0 || hesitantCount > 0) {
            status = 'BLOCKER';
        } else if (dueCount > 0) {
            status = 'REFRESH';
        } else if (unattemptedCount > 0) {
            status = 'EXPLORE';
        }

        counts.ALL += 1;
        counts[status] += 1;

        const copy = catalogCopy[def.id] || { title: def.id, subtitle: '' };
        const courseReadings = aggregateCourseReadings(classified, coursesById);
        const takeaways = buildAxisTakeaways(classified, coursesById, 6);
        const workshopSize = Math.min(6, totalQuestions);

        axes.push({
            id: def.id,
            catalogIndex: idx,
            category: def.category,
            title: copy.title,
            subtitle: copy.subtitle,
            status,
            totalQuestions,
            attemptedCount,
            unattemptedCount,
            strugglingCount,
            hesitantCount,
            dueCount,
            masteredCount,
            masteryPct,
            attemptedMasteryPct,
            courseReadings,
            takeaways,
            workshopSize,
            questionIds: classified.map((c) => c.key),
        });
    }

    /** @type {Record<string, number>} */
    const statusOrder = {
        BLOCKER: 0,
        REFRESH: 1,
        EXPLORE: 2,
        MASTERED: 3,
    };

    axes.sort((a, b) => {
        const sDiff = statusOrder[a.status] - statusOrder[b.status];
        if (sDiff !== 0) return sDiff;

        if (a.status === 'BLOCKER') {
            const scoreA = a.strugglingCount * 3 + a.hesitantCount * 1.5;
            const scoreB = b.strugglingCount * 3 + b.hesitantCount * 1.5;
            if (scoreB !== scoreA) return scoreB - scoreA;
            if (a.attemptedMasteryPct !== b.attemptedMasteryPct) return a.attemptedMasteryPct - b.attemptedMasteryPct;
        } else if (a.status === 'REFRESH') {
            if (b.dueCount !== a.dueCount) return b.dueCount - a.dueCount;
            if (a.masteryPct !== b.masteryPct) return a.masteryPct - b.masteryPct;
        } else if (a.status === 'EXPLORE') {
            const startedA = a.attemptedCount > 0 ? 1 : 0;
            const startedB = b.attemptedCount > 0 ? 1 : 0;
            if (startedB !== startedA) return startedB - startedA;
            if (a.masteryPct !== b.masteryPct) return a.masteryPct - b.masteryPct;
        } else if (a.masteryPct !== b.masteryPct) {
            return a.masteryPct - b.masteryPct;
        }

        return a.catalogIndex - b.catalogIndex;
    });

    return {
        level,
        axes,
        counts,
    };
}

/**
 * Sélectionne un ensemble équilibré de questions (5 à 8) pour un atelier ciblé sur un axe.
 * Mélange en priorité les questions en difficulté/à revoir avec 1 à 2 questions de consolidation
 * (déjà acquises ou nouvelles) du même axe afin d'éviter la réponse par élimination.
 *
 * @param {any[]} questions
 * @param {Record<string, any>} stats
 * @param {{ axisId: string, level?: string, targetCount?: number, now?: Date | number }} options
 * @returns {any[]}
 */
export function pickWorkshopQuestions(questions, stats = {}, options) {
    const axisId = options?.axisId;
    const level = options?.level || 'ALL';
    const targetCount = Math.max(1, Math.min(8, options?.targetCount || 6));
    const now = options?.now ?? Date.now();
    const questionStatsMap = resolveQuestionStatsMap(stats);

    const pool = (Array.isArray(questions) ? questions : []).filter(
        (q) => matchesQuestionLevel(q, level) && resolveAxisIdForQuestion(q) === axisId,
    );
    if (pool.length <= targetCount) return [...pool];

    /** @type {any[]} */
    const struggling = [];
    /** @type {any[]} */
    const hesitant = [];
    /** @type {any[]} */
    const due = [];
    /** @type {any[]} */
    const unattempted = [];
    /** @type {any[]} */
    const mastered = [];

    const getStat = (q) => {
        const key = getQuestionKey(q);
        return questionStatsMap[key] ?? (q.id ? questionStatsMap[q.id] : undefined);
    };

    for (const q of pool) {
        const bucket = classifyQuestionForAxis(getStat(q), now);
        if (bucket === 'struggling') struggling.push(q);
        else if (bucket === 'hesitant') hesitant.push(q);
        else if (bucket === 'due') due.push(q);
        else if (bucket === 'unattempted') unattempted.push(q);
        else mastered.push(q);
    }

    struggling.sort((a, b) => masteryRatio(getStat(a)) - masteryRatio(getStat(b)));
    hesitant.sort((a, b) => masteryRatio(getStat(a)) - masteryRatio(getStat(b)));

    const focusCandidates = [...struggling, ...hesitant, ...due];
    const consolidationCandidates = [...mastered, ...unattempted];

    /** @type {any[]} */
    const selected = [];
    const seenKeys = new Set();

    const addQuestion = (q) => {
        const key = getQuestionKey(q);
        if (q && key && !seenKeys.has(key) && selected.length < targetCount) {
            seenKeys.add(key);
            selected.push(q);
        }
    };

    if (focusCandidates.length > 0) {
        const reserveForConsolidation = Math.min(
            consolidationCandidates.length,
            targetCount >= 5 ? (focusCandidates.length <= targetCount - 2 ? 2 : 1) : 0,
        );
        const maxFocus = targetCount - reserveForConsolidation;
        for (const q of focusCandidates.slice(0, maxFocus)) {
            addQuestion(q);
        }
        for (const q of consolidationCandidates) {
            if (selected.length >= targetCount) break;
            addQuestion(q);
        }
        for (const q of focusCandidates) {
            if (selected.length >= targetCount) break;
            addQuestion(q);
        }
    } else {
        for (const q of [...unattempted, ...mastered]) {
            if (selected.length >= targetCount) break;
            addQuestion(q);
        }
    }

    return selected;
}
