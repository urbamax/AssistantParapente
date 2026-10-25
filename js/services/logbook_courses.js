/**
 * LogbookCourses
 * Règles du carnet sur les stages (sessions d'école) et les moniteurs, sans accès au DOM ni au
 * stockage : lire les moniteurs d'une session, reconnaître un stage, lister les stages connus,
 * retrouver la session de référence d'un stage et cumuler les statistiques par stage.
 *
 * Un stage n'a pas de fiche propre : c'est ce que ses sessions ont en commun. Il est identifié
 * par son nom, comparé sans tenir compte des majuscules ni des espaces autour (`courseKey`).
 * Les sessions sont attendues de la plus récente à la plus ancienne (ordre de LogbookService).
 */
import PilotHabits from './pilot_habits.js';

/** @param {unknown} value */
const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Moniteurs d'une session, en liste. Ils peuvent être plusieurs ; les sessions plus anciennes
 * n'en gardaient qu'un, en texte.
 * @param {any} session
 * @returns {string[]}
 */
export function instructorsOf(session) {
    const value = session ? session.moniteur : null;
    const seen = new Set();
    /** @type {string[]} */
    const names = [];
    for (const raw of Array.isArray(value) ? value : [value]) {
        const name = text(raw);
        if (name && !seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            names.push(name);
        }
    }
    return names;
}

/**
 * Identifiant d'un stage : son nom sans espaces autour ni majuscules ; vide sans nom.
 * @param {any} session
 */
export function courseKey(session) {
    return text(session && session.stageName).toLowerCase();
}

/**
 * Une session fait partie d'un stage quand elle a une école et un nom de stage ou une spécialité
 * (le formulaire ne garde ni l'un ni l'autre sans école).
 * @param {any} session
 */
export function isCourseSession(session) {
    return Boolean(session && text(session.ecole) && (text(session.stageName) || text(session.stageSpecialty)));
}

/**
 * Noms des stages du carnet, les plus utilisés d'abord (récence comprise), un par stage, écrits
 * comme dans la session la plus récente.
 * @param {any[]} sessions
 * @returns {string[]}
 */
export function courseNames(sessions) {
    const named = (sessions || []).filter((session) => isCourseSession(session) && courseKey(session));
    const spelling = new Map();
    for (const session of named) {
        if (!spelling.has(courseKey(session))) spelling.set(courseKey(session), text(session.stageName));
    }
    return PilotHabits.rankByUse(named, (session) => spelling.get(courseKey(session)));
}

/**
 * Session la plus récente d'un stage connu par son nom.
 * @param {any[]} sessions
 * @param {string} name
 */
export function latestOfCourse(sessions, name) {
    const key = text(name).toLowerCase();
    if (!key) return null;
    return (sessions || []).find((session) => isCourseSession(session) && courseKey(session) === key) || null;
}

/**
 * Parmi des sessions, la plus récente au lieu donné, sinon la plus récente.
 * @param {any[]} sessions
 * @param {string} place
 */
export function preferPlace(sessions, place) {
    const list = sessions || [];
    const key = text(place).toLowerCase();
    const here = key ? list.find((session) => PilotHabits.placeOf(session) === key) : null;
    return here || list[0] || null;
}

/**
 * @typedef {Object} CourseStats
 * @property {string} key identifiant du stage (`''` : stage sans nom)
 * @property {string} name nom écrit comme dans la session la plus récente (`''` sans nom)
 * @property {string} school école de la session la plus récente
 * @property {string} specialty spécialité de la session la plus récente
 * @property {number} flights
 * @property {number} flightMinutes
 * @property {number} groundSessions
 * @property {number} groundMinutes
 * @property {number} sessions vols + gonflages
 */

/**
 * Cumuls par stage : le plus de sessions d'abord, à égalité le plus récent. Les sessions avec une
 * spécialité mais sans nom forment un seul stage sans nom.
 * @param {any[]} sessions
 * @returns {CourseStats[]}
 */
export function courseStats(sessions) {
    /** @type {Map<string, CourseStats>} */
    const courses = new Map();
    for (const session of sessions || []) {
        if (!isCourseSession(session)) continue;
        const key = courseKey(session);
        let course = courses.get(key);
        if (!course) {
            course = {
                key,
                name: text(session.stageName),
                school: text(session.ecole),
                specialty: text(session.stageSpecialty),
                flights: 0,
                flightMinutes: 0,
                groundSessions: 0,
                groundMinutes: 0,
                sessions: 0,
            };
            courses.set(key, course);
        }
        const minutes = Number(session.duree) || 0;
        if (session.type === 'vol') {
            course.flights++;
            course.flightMinutes += minutes;
        } else {
            course.groundSessions++;
            course.groundMinutes += minutes;
        }
        course.sessions++;
    }
    // Map garde l'ordre d'insertion : à égalité, le stage de la session la plus récente reste devant
    return [...courses.values()].sort((a, b) => b.sessions - a.sessions);
}
