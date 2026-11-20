/**
 * SERVICE - Firebase Merge & Local State Helpers
 * Pure functions for merging local and cloud QCM statistics, exam history, and user preferences,
 * extracted from firebase_service.js to keep synchronization orchestration and data-merge rules separate.
 */
import StorageService from './storage.js';
import { migrateSitePrefs } from './sites_service.js';
import { flattenAnswerLogs, mergeAnswerLogs } from './answer_log.js';
import { mergeBrevets } from './brevet_service.js';
import { compactExam } from './quiz_service.js';

// État de révision espacée (streak + lastSeen + SM-2) d'une question : on garde celui de l'appareil
// qui a vu la question le plus récemment. Prendre le max des streaks effacerait une erreur
// récente (streak remis à 0 sur le téléphone, 4 dans le cloud), et ne pas recopier lastSeen
// faisait retomber le mode Révision sur l'ancien critère de ratio après chaque synchro.
// Les dernières réponses (`recent`), le facteur de facilité (`easeFactor`), l'intervalle (`interval`)
// et les répétitions (`repetitions`) suivent la même règle : ils viennent de l'appareil le plus récent,
// et on n'écrit jamais de champ indéfini (Firestore le refuse).
export function latestReviewState(a, b) {
    const aSeen = a.lastSeen || 0;
    const bSeen = b.lastSeen || 0;
    // `recent` vient de la source retenue ; le facteur de facilité, l'intervalle et les répétitions aussi,
    // et à défaut de la première copie qui en a un. Jamais de champ indéfini (Firestore le refuse).
    const withExtra = (state, source) => {
        const res = Array.isArray(source.recent) ? { ...state, recent: source.recent } : { ...state };
        for (const field of ['easeFactor', 'interval', 'repetitions']) {
            const value = [source, a, b].map((x) => x[field]).find((v) => typeof v === 'number' && !isNaN(v));
            if (value !== undefined) res[field] = value;
        }
        return res;
    };
    if (!aSeen && !bSeen) {
        const longest = (a.recent?.length || 0) >= (b.recent?.length || 0) ? a : b;
        return withExtra({ streak: Math.max(a.streak || 0, b.streak || 0) }, longest);
    }
    if (aSeen === bSeen) {
        const longest = (a.recent?.length || 0) >= (b.recent?.length || 0) ? a : b;
        return withExtra({ streak: Math.max(a.streak || 0, b.streak || 0), lastSeen: aSeen }, longest);
    }
    const latest = aSeen > bSeen ? a : b;
    return withExtra({ streak: latest.streak || 0, lastSeen: latest.lastSeen }, latest);
}

// Nombre de fois où chaque choix a été coché. Comme `total` et `correct`, on prend le max par
// choix : additionner local et cloud compterait deux fois chaque réponse déjà synchronisée.
// Retourne un objet vide si aucune des deux versions n'en a (jamais de champ indéfini).
export function mergeChoicePicks(a, b) {
    const valid = (v) => (Array.isArray(v) ? v : null);
    const la = valid(a);
    const lb = valid(b);
    if (!la && !lb) return {};
    const length = Math.max(la?.length || 0, lb?.length || 0);
    return {
        choicePicks: Array.from({ length }, (_, i) => Math.max(Number(la?.[i]) || 0, Number(lb?.[i]) || 0)),
    };
}

// Nombre de fois où chaque bonne réponse a été oubliée.
export function mergeChoiceMisses(a, b) {
    const valid = (v) => (Array.isArray(v) ? v : null);
    const la = valid(a);
    const lb = valid(b);
    if (!la && !lb) return {};
    const length = Math.max(la?.length || 0, lb?.length || 0);
    return {
        choiceMisses: Array.from({ length }, (_, i) => Math.max(Number(la?.[i]) || 0, Number(lb?.[i]) || 0)),
    };
}

// Journal daté des dernières réponses (voir answer_log.js) : omis si aucune des deux versions n'en a.
export function mergeAnswers(a, b) {
    if (!Array.isArray(a) && !Array.isArray(b)) return {};
    return { answers: mergeAnswerLogs(a, b) };
}

export function mergeQcmStats(local, cloud) {
    const merged = {
        totalQuestions: 0,
        totalCorrect: 0,
        themes: {},
        questions: {},
    };

    // Combine all question keys
    const allQuestions = new Set([...Object.keys(local.questions || {}), ...Object.keys(cloud.questions || {})]);

    allQuestions.forEach((qCode) => {
        const lQ = (local.questions || {})[qCode] || { total: 0, correct: 0, streak: 0 };
        const cQ = (cloud.questions || {})[qCode] || { total: 0, correct: 0, streak: 0 };

        merged.questions[qCode] = {
            total: Math.max(Number(lQ.total) || 0, Number(cQ.total) || 0),
            correct: Math.max(Number(lQ.correct) || 0, Number(cQ.correct) || 0),
            ...latestReviewState(lQ, cQ),
            ...mergeChoicePicks(lQ.choicePicks, cQ.choicePicks),
            ...mergeChoiceMisses(lQ.choiceMisses, cQ.choiceMisses),
            ...mergeAnswers(lQ.answers, cQ.answers),
        };
    });

    // Combine themes keys
    const allThemes = new Set([...Object.keys(local.themes || {}), ...Object.keys(cloud.themes || {})]);

    allThemes.forEach((theme) => {
        const lT = (local.themes || {})[theme] || { total: 0, correct: 0 };
        const cT = (cloud.themes || {})[theme] || { total: 0, correct: 0 };

        merged.themes[theme] = {
            total: Math.max(Number(lT.total) || 0, Number(cT.total) || 0),
            correct: Math.max(Number(lT.correct) || 0, Number(cT.correct) || 0),
        };
    });

    // Global metrics
    const questionsTotal = Object.values(merged.questions).reduce((sum, q) => sum + (q.total || 0), 0);
    const questionsCorrect = Object.values(merged.questions).reduce((sum, q) => sum + (q.correct || 0), 0);
    const themesTotal = Object.values(merged.themes).reduce((sum, t) => sum + (t.total || 0), 0);
    const themesCorrect = Object.values(merged.themes).reduce((sum, t) => sum + (t.correct || 0), 0);

    merged.totalQuestions = Math.max(local.totalQuestions || 0, cloud.totalQuestions || 0, questionsTotal, themesTotal);
    merged.totalCorrect = Math.max(local.totalCorrect || 0, cloud.totalCorrect || 0, questionsCorrect, themesCorrect);
    merged.appliedExamIds = Array.from(
        new Set([...(local.appliedExamIds || []), ...(cloud.appliedExamIds || [])].map(String)),
    );

    return merged;
}

export function mergeExamHistory(local, cloud) {
    const localExams = local?.exams || [];
    const cloudExams = cloud?.exams || [];
    const deletedIds = new Set([
        ...(Array.isArray(local?.deletedExamIds) ? local.deletedExamIds : []),
        ...(Array.isArray(cloud?.deletedExamIds) ? cloud.deletedExamIds : []),
    ]);

    // Use a Map keyed by exam ID or ISO string date to remove duplicates
    const examMap = new Map();

    localExams.forEach((exam) => {
        if (!exam) return;
        const key = exam.id || exam.date;
        if (deletedIds.has(String(exam.id)) || deletedIds.has(String(exam.date)) || exam.deleted === true) return;
        examMap.set(key, exam);
    });

    cloudExams.forEach((exam) => {
        if (!exam) return;
        const key = exam.id || exam.date;
        if (deletedIds.has(String(exam.id)) || deletedIds.has(String(exam.date)) || exam.deleted === true) return;
        const existing = examMap.get(key);
        if (existing) {
            // Même examen des deux côtés : on garde la copie dont les points sont à jour du QCM
            // (révision la plus récente), sans perdre le marquage « déjà compté dans les statistiques ».
            const winner = (Number(exam.qcmRevision) || 0) > (Number(existing.qcmRevision) || 0) ? exam : existing;
            if (exam.appliedToStats || existing.appliedToStats) {
                winner.appliedToStats = true;
            }
            examMap.set(key, winner);
        } else {
            examMap.set(key, exam);
        }
    });

    // Convert map back to list, sort descending by date (newest first) sans limitation à 20
    const mergedExams = Array.from(examMap.values());
    mergedExams.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
    });

    const compactedExams = mergedExams.map((exam) => compactExam(exam));

    return {
        exams: compactedExams,
        deletedExamIds: Array.from(deletedIds).slice(-50),
    };
}

export function mergePreferences(local, cloud) {
    if (!cloud) return local;
    if (!local) return cloud;

    // 1. LWW si horodaté, sinon le Cloud fait foi pour les clés communes
    const localNewer = (Number(local.updatedAt) || 0) > (Number(cloud.updatedAt) || 0);
    const merged = localNewer ? { ...cloud, ...local } : { ...cloud };

    // 2. On récupère les valeurs locales qui n'existent pas du tout dans le cloud
    // (Utile pour rétrocompatibilité lors de l'ajout d'une nouvelle option locale)
    for (const key in local) {
        if (merged[key] === undefined) {
            merged[key] = local[key];
        }
    }

    // 3. Cas spécifiques : Fusion intelligente des tableaux pour ne pas perdre les données des deux côtés
    const localFavs = local.favoriteSites || [];
    const cloudFavs = cloud.favoriteSites || [];
    merged.favoriteSites = Array.from(new Set([...localFavs, ...cloudFavs]));

    const localMin = local.minimizedSites || [];
    const cloudMin = cloud.minimizedSites || [];
    merged.minimizedSites = Array.from(new Set([...localMin, ...cloudMin]));

    const mergedLocsMap = new Map();
    (cloud.savedLocations || []).forEach((loc) => mergedLocsMap.set(loc.name, loc));
    (local.savedLocations || []).forEach((loc) => mergedLocsMap.set(loc.name, loc));
    merged.savedLocations = Array.from(mergedLocsMap.values());

    if (local.brevets || cloud.brevets) {
        merged.brevets = mergeBrevets(local.brevets, cloud.brevets);
    }

    // Jamais de fiche d'urgence (données de santé) venue du cloud ni renvoyée vers lui.
    delete merged.iceProfile;

    // Réglages retirés ou renommés (spec 002) : rayon « Illimité », modèle « meteoblue ».
    return migrateSitePrefs(merged);
}

export function getLocalQcmStats() {
    const saved = StorageService.get(StorageService.KEYS.QCM_STATS);
    if (saved && typeof saved === 'object') {
        // Firestore refuse les tableaux imbriqués : on remet à plat l'ancien format du journal avant toute écriture.
        if (flattenAnswerLogs(saved)) StorageService.set(StorageService.KEYS.QCM_STATS, saved);
        return saved;
    }
    return { totalQuestions: 0, totalCorrect: 0, themes: {}, questions: {} };
}

export function getLocalExamHistory() {
    const saved = StorageService.get(StorageService.KEYS.EXAM_HISTORY);
    let exams = [];
    let deletedExamIds = [];
    if (Array.isArray(saved)) {
        exams = saved;
    } else if (saved && typeof saved === 'object') {
        if (Array.isArray(saved.exams)) exams = saved.exams;
        if (Array.isArray(saved.deletedExamIds)) deletedExamIds = saved.deletedExamIds;
    }
    return {
        exams: exams.map((exam) => compactExam(exam)),
        deletedExamIds,
    };
}

export function getLocalPreferences() {
    const defaults = {
        pilotLevel: 'ALL',
        themeMode: 'auto',
        favoriteSites: [],
        minimizedSites: [],
        savedLocations: [],
        activeMapLayers: ['leaflet', 'windy', 'meteoparapente', 'paraglidingearth', 'paraglidable', 'isofronts'],
        limitWindMin: 0,
        limitWindMax: 25,
        limitGustDelta: 10,
        hideUnflyable: false,
        radiusLimit: 50,
        sortMode: 'CONDITIONS',
        conditionsStrategy: 'CONSECUTIVE',
        weatherModel: 'meteofrance',
    };
    let prefs = { ...defaults };
    const saved = StorageService.get(StorageService.KEYS.USER_PREFS);
    if (saved && typeof saved === 'object') {
        prefs = { ...prefs, ...saved };
        // Ensure arrays exist
        if (!prefs.favoriteSites) prefs.favoriteSites = [];
        if (!prefs.minimizedSites) prefs.minimizedSites = [];
        if (!prefs.savedLocations) prefs.savedLocations = [];
        if (!prefs.activeMapLayers) prefs.activeMapLayers = [...defaults.activeMapLayers];
    }

    // Always read latest pilot level from main app logic (userLevel)
    const globalLevel = StorageService.get(StorageService.KEYS.USER_LEVEL);
    if (globalLevel) {
        prefs.pilotLevel = globalLevel;
    }

    const themeMode = StorageService.get(StorageService.KEYS.THEME_MODE);
    if (themeMode) {
        prefs.themeMode = themeMode;
    }

    // La fiche d'urgence (ICE) contient des données de santé : elle ne quitte jamais l'appareil.
    delete (/** @type {any} */ (prefs).iceProfile);

    // Réglages retirés ou renommés (spec 002) : rayon « Illimité », modèle « meteoblue ».
    return migrateSitePrefs(prefs);
}
