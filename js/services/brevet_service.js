// @ts-check
/**
 * SERVICE - Pilot certifications (Brevets FFVL) & progression tracking (spec 042).
 *
 * Persists certification records under `brevets` in `parapente_user_prefs`:
 * - BI: Brevet Initial (N3)
 * - BP: Brevet de Pilote (N4)
 * - BPC: Brevet de Pilote Confirmé (N5)
 * - TREUIL: Qualification Treuil
 *
 * Dissociates:
 * - Practical flight level (`getPracticalPilotLevel`): used in Sites Pre-Flight Brief.
 * - Target theory level (`getTargetTheoryLevel`): used in QCM / Theory progression.
 */
import StorageService from './storage.js';
import GlobalState from '../core/app_state.js';
import LogbookService from './logbook_service.js';
import { instructorsOf } from './logbook_courses.js';

export const BREVET_CODES = ['BI', 'BP', 'BPC', 'TREUIL'];
export const PROGRESSION_CHAIN = ['BI', 'BP', 'BPC'];

/**
 * @param {unknown} code
 * @returns {boolean}
 */
export function isValidBrevetCode(code) {
    return typeof code === 'string' && BREVET_CODES.includes(code);
}

/**
 * @param {unknown} val
 * @returns {number | null}
 */
function parseOptionalNumber(val) {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(val);
    return Number.isFinite(num) && num >= 0 ? num : null;
}

/**
 * Computes theory percentage from score/total when both are valid (total > 0),
 * or falls back to a direct percentage (0..100).
 * @param {unknown} score
 * @param {unknown} total
 * @param {unknown} fallbackPct
 * @returns {number | null}
 */
export function computeTheoryPercentage(score, total, fallbackPct) {
    const s = parseOptionalNumber(score);
    const t = parseOptionalNumber(total);
    if (s !== null && t !== null && t > 0) {
        return Math.min(100, Math.max(0, Math.round((s / t) * 100)));
    }
    const pct = parseOptionalNumber(fallbackPct);
    if (pct !== null) {
        return Math.min(100, Math.max(0, Math.round(pct)));
    }
    return null;
}

/**
 * @param {any} raw
 */
export function normalizeBrevetEntry(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const th = r.theory && typeof r.theory === 'object' ? r.theory : {};
    const pr = r.practical && typeof r.practical === 'object' ? r.practical : {};

    const score = parseOptionalNumber(th.score);
    const total = parseOptionalNumber(th.total);
    const percentage = computeTheoryPercentage(score, total, th.percentage);

    return {
        theory: {
            passed: Boolean(th.passed),
            date: typeof th.date === 'string' ? th.date.trim().slice(0, 10) : '',
            score,
            total: total !== null && total > 0 ? total : null,
            percentage,
            school: typeof th.school === 'string' ? th.school.trim() : '',
            examiner: typeof th.examiner === 'string' ? th.examiner.trim() : '',
            notes: typeof th.notes === 'string' ? th.notes.trim() : '',
        },
        practical: {
            validated: Boolean(pr.validated),
            date: typeof pr.date === 'string' ? pr.date.trim().slice(0, 10) : '',
            school: typeof pr.school === 'string' ? pr.school.trim() : '',
            instructor: typeof pr.instructor === 'string' ? pr.instructor.trim() : '',
            notes: typeof pr.notes === 'string' ? pr.notes.trim() : '',
        },
        updatedAt: typeof r.updatedAt === 'string' && r.updatedAt ? r.updatedAt : '',
    };
}

/**
 * @param {any} rawBrevets
 */
export function normalizeBrevetsMap(rawBrevets) {
    const src = rawBrevets && typeof rawBrevets === 'object' ? rawBrevets : {};
    /** @type {Record<string, ReturnType<typeof normalizeBrevetEntry>>} */
    const out = {};
    for (const code of BREVET_CODES) {
        out[code] = normalizeBrevetEntry(src[code]);
    }
    return out;
}

/**
 * @param {Record<string, any>} [brevets]
 * @returns {boolean}
 */
export function hasAnyBrevetData(brevets) {
    const map = brevets ? normalizeBrevetsMap(brevets) : BrevetService.getBrevets();
    return BREVET_CODES.some((code) => {
        const entry = map[code];
        return Boolean(
            entry &&
            (entry.theory.passed ||
                entry.practical.validated ||
                entry.theory.date ||
                entry.practical.date ||
                entry.theory.score !== null ||
                entry.theory.percentage !== null),
        );
    });
}

/**
 * Returns the highest practically validated brevet in ['BPC', 'BP', 'BI'], or null if none is validated.
 * @param {Record<string, any>} [brevets]
 * @returns {string | null}
 */
export function getPracticalPilotLevel(brevets) {
    const map = brevets ? normalizeBrevetsMap(brevets) : BrevetService.getBrevets();
    for (let i = PROGRESSION_CHAIN.length - 1; i >= 0; i--) {
        const code = PROGRESSION_CHAIN[i];
        if (map[code]?.practical?.validated) return code;
    }
    return null;
}

/**
 * Returns true if the theoretical exam (or full practical brevet) for `code` is validated.
 * @param {string} code
 * @param {Record<string, any>} [brevets]
 * @returns {boolean}
 */
export function isTheoryValidated(code, brevets) {
    if (!isValidBrevetCode(code)) return false;
    const map = brevets ? normalizeBrevetsMap(brevets) : BrevetService.getBrevets();
    const entry = map[code];
    return Boolean(entry?.theory?.passed || entry?.practical?.validated);
}

/**
 * Returns the next target theory level in ['BI', 'BP', 'BPC'] whose theory is not yet validated.
 * If all three are validated, returns 'BPC'.
 * @param {Record<string, any>} [brevets]
 * @returns {string}
 */
export function getTargetTheoryLevel(brevets) {
    const map = brevets ? normalizeBrevetsMap(brevets) : BrevetService.getBrevets();
    for (const code of PROGRESSION_CHAIN) {
        if (!isTheoryValidated(code, map)) return code;
    }
    return 'BPC';
}

/**
 * Determines which brevet in ['BI', 'BP', 'BPC'] was being prepared at `sessionDateStr`.
 * If BI was validated on 2026-10-26, a session on 2026-10-26 still returns 'BI',
 * while a session on 2026-10-27 returns 'BP'.
 * @param {Record<string, any>} [brevets]
 * @param {string} [sessionDateStr]
 * @returns {string}
 */
export function getTargetSchoolBrevet(brevets, sessionDateStr = '') {
    const map = brevets ? normalizeBrevetsMap(brevets) : BrevetService.getBrevets();
    const dateOnly = typeof sessionDateStr === 'string' ? sessionDateStr.trim().slice(0, 10) : '';
    for (const code of PROGRESSION_CHAIN) {
        const pr = map[code]?.practical;
        if (!pr?.validated) return code;
        if (dateOnly && pr.date && dateOnly <= pr.date) return code;
    }
    return 'BPC';
}

/**
 * Given a brevet learned from past school/course sessions (`habitBrevet`), checks whether
 * that brevet was already practically validated strictly before `sessionDateStr` (or without date).
 * If so, advances to `getTargetSchoolBrevet(brevets, sessionDateStr)`.
 * @param {string} habitBrevet
 * @param {Record<string, any>} [brevets]
 * @param {string} [sessionDateStr]
 * @returns {string}
 */
export function resolveSuggestedBrevet(habitBrevet, brevets, sessionDateStr = '') {
    if (!isValidBrevetCode(habitBrevet)) return '';
    const map = brevets ? normalizeBrevetsMap(brevets) : BrevetService.getBrevets();
    const pr = map[habitBrevet]?.practical;
    if (!pr?.validated) return habitBrevet;

    const dateOnly = typeof sessionDateStr === 'string' ? sessionDateStr.trim().slice(0, 10) : '';
    if (dateOnly && pr.date) {
        if (dateOnly <= pr.date) return habitBrevet;
        return PROGRESSION_CHAIN.includes(habitBrevet) ? getTargetSchoolBrevet(map, sessionDateStr) : '';
    }
    return PROGRESSION_CHAIN.includes(habitBrevet) ? getTargetSchoolBrevet(map, sessionDateStr) : '';
}

/**
 * Aggregates school sessions (`ecole` non-empty and `brevetPrepare === code`) for a brevet.
 * @param {string} code
 * @param {any[]} [flights]
 * @param {Record<string, any>} [brevets]
 */
export function brevetSummary(code, flights, brevets) {
    const list = Array.isArray(flights) ? flights : LogbookService.getFlights();
    const map = brevets ? normalizeBrevetsMap(brevets) : BrevetService.getBrevets();
    const entry = map[code] || normalizeBrevetEntry(null);
    const sessionList = list
        .filter((s) => s && Boolean(s.ecole?.trim()) && s.brevetPrepare === code)
        .sort((a, b) => String(a.datetime || a.date || '').localeCompare(String(b.datetime || b.date || '')));

    let flightCount = 0;
    let flightMinutes = 0;
    let groundSessions = 0;
    let groundMinutes = 0;
    const schoolsSet = new Set();
    const instructorsSet = new Set();
    const exercisesSet = new Set();

    for (const s of sessionList) {
        const dur = Number(s.duree) || 0;
        if (s.type === 'gonflage') {
            groundSessions += 1;
            groundMinutes += dur;
        } else {
            flightCount += 1;
            flightMinutes += dur;
        }
        if (s.ecole?.trim()) schoolsSet.add(s.ecole.trim());
        for (const inst of instructorsOf(s)) {
            instructorsSet.add(inst);
        }
        for (const rawEx of Array.isArray(s.typeExercice)
            ? s.typeExercice
            : Array.isArray(s.exercices)
              ? s.exercices
              : [s.typeExercice]) {
            if (typeof rawEx === 'string' && rawEx.trim()) exercisesSet.add(rawEx.trim());
        }
    }

    return {
        code,
        entry,
        sessionList,
        sessions: flightCount + groundSessions,
        flights: flightCount,
        flightMinutes,
        groundSessions,
        groundMinutes,
        schools: [...schoolsSet],
        instructors: [...instructorsSet],
        exercises: [...exercisesSet].sort((a, b) => a.localeCompare(b, 'fr')),
    };
}

/**
 * Lists school sessions that do not have `brevetPrepare` set yet.
 * Each item includes `preselected: boolean` (true if session date <= brevet validation date, or if no validation date is set).
 * @param {string} code
 * @param {any[]} [flights]
 * @param {Record<string, any>} [brevets]
 */
export function unassignedSchoolSessionsFor(code, flights, brevets) {
    const list = Array.isArray(flights) ? flights : LogbookService.getFlights();
    const map = brevets ? normalizeBrevetsMap(brevets) : BrevetService.getBrevets();
    const validDate = map[code]?.practical?.date || '';

    return list
        .filter((s) => s && Boolean(s.ecole?.trim()) && !s.brevetPrepare)
        .sort((a, b) => String(b.datetime || b.date || '').localeCompare(String(a.datetime || a.date || '')))
        .map((s) => {
            const d = String(s.datetime || s.date || '').slice(0, 10);
            const preselected = !validDate || !d || d <= validDate;
            return {
                ...s,
                preselected,
            };
        });
}

/**
 * Lossless per-code merge of local and cloud `brevets` maps using `updatedAt`.
 * @param {any} localBrevets
 * @param {any} cloudBrevets
 */
export function mergeBrevets(localBrevets, cloudBrevets) {
    const localMap = normalizeBrevetsMap(localBrevets);
    const cloudMap = normalizeBrevetsMap(cloudBrevets);
    /** @type {Record<string, ReturnType<typeof normalizeBrevetEntry>>} */
    const merged = {};
    for (const code of BREVET_CODES) {
        const l = localMap[code];
        const c = cloudMap[code];
        const lHas = l.theory.passed || l.practical.validated || Boolean(l.updatedAt);
        const cHas = c.theory.passed || c.practical.validated || Boolean(c.updatedAt);
        if (lHas && !cHas) {
            merged[code] = l;
        } else if (!lHas && cHas) {
            merged[code] = c;
        } else if (l.updatedAt && c.updatedAt) {
            merged[code] = l.updatedAt >= c.updatedAt ? l : c;
        } else {
            merged[code] = lHas ? l : c;
        }
    }
    return merged;
}

const BrevetService = {
    BREVET_CODES,
    PROGRESSION_CHAIN,
    isValidBrevetCode,
    computeTheoryPercentage,
    normalizeBrevetEntry,
    normalizeBrevetsMap,
    hasAnyBrevetData,
    getPracticalPilotLevel,
    isTheoryValidated,
    getTargetTheoryLevel,
    getTargetSchoolBrevet,
    resolveSuggestedBrevet,
    brevetSummary,
    unassignedSchoolSessionsFor,
    mergeBrevets,

    getBrevets() {
        const prefs = StorageService.get(StorageService.KEYS.USER_PREFS, {}) || {};
        return normalizeBrevetsMap(prefs.brevets);
    },

    /**
     * @param {string} code
     */
    getBrevet(code) {
        const map = this.getBrevets();
        return map[code] || normalizeBrevetEntry(null);
    },

    /**
     * Saves a single brevet record (`BI`, `BP`, `BPC`, `TREUIL`) into `USER_PREFS.brevets`
     * and synchronizes `GlobalState.set('level', nextTheoryLevel)` if the current QCM level's
     * theory is now validated.
     * @param {string} code
     * @param {any} patch
     */
    saveBrevet(code, patch) {
        if (!isValidBrevetCode(code)) return null;
        const prefs = StorageService.get(StorageService.KEYS.USER_PREFS, {}) || {};
        const currentMap = normalizeBrevetsMap(prefs.brevets);
        const existing = currentMap[code] || normalizeBrevetEntry(null);

        const mergedRaw = {
            theory: { ...existing.theory, ...(patch?.theory || {}) },
            practical: { ...existing.practical, ...(patch?.practical || {}) },
            updatedAt: new Date().toISOString(),
        };
        const normalized = normalizeBrevetEntry(mergedRaw);
        currentMap[code] = normalized;

        StorageService.set(StorageService.KEYS.USER_PREFS, {
            ...prefs,
            brevets: currentMap,
            updatedAt: mergedRaw.updatedAt,
        });

        // Advance active QCM level if a progression brevet's theory was validated
        if (PROGRESSION_CHAIN.includes(code) && isTheoryValidated(code, currentMap)) {
            const targetTheory = getTargetTheoryLevel(currentMap);
            const currentLevel = GlobalState.get('level');
            if ((currentLevel === code || currentLevel === 'ALL') && targetTheory !== code) {
                GlobalState.set('level', targetTheory);
            }
        }

        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('brevets:updated', { detail: { code, entry: normalized } }));
        }

        return normalized;
    },

    /**
     * Batch-assigns `brevetPrepare = code` on all matching school sessions in the logbook.
     * @param {string} code
     * @param {string[]} sessionIds
     * @returns {number} Count of updated sessions
     */
    batchAssignBrevet(code, sessionIds) {
        if (!isValidBrevetCode(code) || !Array.isArray(sessionIds) || sessionIds.length === 0) return 0;
        const idSet = new Set(sessionIds.map(String));
        const flights = LogbookService.getFlights();
        const now = Date.now();
        let updated = 0;

        for (const f of flights) {
            if (f && idSet.has(String(f.id)) && Boolean(f.ecole?.trim())) {
                f.brevetPrepare = code;
                f.updatedAt = now;
                f.syncPending = true;
                updated += 1;
            }
        }
        if (updated > 0) {
            LogbookService.saveFlights();
        }
        return updated;
    },
};

export default BrevetService;
