/**
 * LogbookDefaults
 * Les valeurs que le carnet propose pour un vol (type de vol, technique de décollage, voile,
 * sellette, école, stage, moniteurs, accompagnateurs, pilotes), calculées sans formulaire : ce sont
 * les règles de LogbookView.applyLearnedDefaults (js/views/logbook_learned.js), écrites ici pour
 * les lignes d'un import de plusieurs vols, qui n'ont pas de formulaire. Un test compare les deux
 * (tests/services/logbook_defaults.test.js) : elles doivent proposer la même chose.
 *
 * Les sessions sont attendues de la plus récente à la plus ancienne (ordre de LogbookService).
 */
import PilotHabits from './pilot_habits.js';
import { companionsOf, instructorsOf, isCourseSession, latestOfCourse, preferPlace } from './logbook_courses.js';
import BrevetService, { resolveSuggestedBrevet } from './brevet_service.js';

const THREE_HOURS_MS = 3 * 3600 * 1000;
const FLIGHT_TYPES = ['Plouf', 'Thermique', 'Soaring', 'Restit', 'Cross', 'Treuil'];
const TAKEOFF_TECHNIQUES = ['Face voile', 'Dos voile'];
// Règle générale, vite remplacée par les vols du pilote au treuil
const WINCH_TAKEOFF_TECHNIQUE = 'Dos voile';

/**
 * Session la plus proche dans le temps, au même endroit, à moins de 3 h de `datetime`, et dont le
 * champ `field` est renseigné : un vol de la même série (treuil, plusieurs ploufs dans la journée…).
 * @param {any[]} sessions
 * @param {string} place
 * @param {string} datetime date et heure locales (AAAA-MM-JJTHH:MM)
 * @param {string} [field]
 */
export function findNearbySession(sessions, place, datetime, field = 'pilotes') {
    const key = (place || '').trim().toLowerCase();
    const t = new Date(datetime).getTime();
    if (!key || !Number.isFinite(t)) return null;
    let best = null;
    let bestGap = THREE_HOURS_MS;
    for (const s of sessions || []) {
        const v = s[field];
        if (!v || (Array.isArray(v) && !v.length) || PilotHabits.placeOf(s) !== key) continue;
        const gap = Math.abs(new Date(s.datetime).getTime() - t);
        if (gap <= bestGap) {
            best = s;
            bestGap = gap;
        }
    }
    return best;
}

/**
 * @typedef {Object} DefaultsContext
 * @property {string} place lieu du vol (site)
 * @property {string} datetime date et heure locales du vol
 * @property {{voile?: string[], sellette?: string[], typeVol?: string[], techDecollage?: string[]}} [options]
 *   valeurs possibles de chaque champ à liste (matériel de l'utilisateur, techniques) ; sans liste, tout est possible
 * @property {Set<string>} [skip] champs à ne pas proposer (déjà connus ou choisis par le pilote)
 * @property {string} [typeVol] type de vol déjà connu (lu dans la trace, ou choisi) : sert à la technique de décollage
 * @property {string} [stageName] nom de stage choisi par le pilote : le stage est alors celui de ce nom
 */

/**
 * Valeurs proposées pour un vol. Une valeur absente de `values` n'est pas proposée (le formulaire
 * garde alors sa valeur de départ). `reasons` dit pourquoi, avec les mêmes motifs que le formulaire.
 * @param {any[]} sessions
 * @param {DefaultsContext} context
 */
export function suggestDefaults(sessions, context) {
    const { place = '', datetime = '', options = {}, skip = new Set(), stageName = '' } = context;
    /** @type {Record<string, any>} */
    const values = {};
    /** @type {Record<string, string>} */
    const reasons = {};
    const can = (field) => !skip.has(field);
    const allowed = (field, value, fallback) => {
        const list = options[field] || fallback;
        return !list || list.includes(value);
    };
    const placeKey = place.trim().toLowerCase();
    const list = sessions || [];

    if (can('typeVol')) {
        const type = PilotHabits.suggest(list, 'typeVol', {
            sessionType: 'vol',
            context: { place },
            mismatch: { place: 0.1 },
            minScore: 1,
        });
        if (type && allowed('typeVol', type.value, FLIGHT_TYPES)) {
            values.typeVol = type.value;
            reasons.typeVol = type.reason;
        }
    }
    const flightType = values.typeVol ?? context.typeVol ?? 'Plouf';

    if (can('techDecollage')) {
        const winch = flightType === 'Treuil';
        const technique = PilotHabits.suggest(list, 'techDecollage', {
            sessionType: 'vol',
            context: { place, launch: winch ? 'treuil' : 'libre' },
            prior: winch ? { value: WINCH_TAKEOFF_TECHNIQUE, weight: 2, reason: 'winch' } : null,
        });
        if (technique && allowed('techDecollage', technique.value, TAKEOFF_TECHNIQUES)) {
            values.techDecollage = technique.value;
            reasons.techDecollage =
                technique.reason === 'launch' ? (winch ? 'launchWinch' : 'habit') : technique.reason;
        }
    }

    for (const field of ['voile', 'sellette']) {
        if (!can(field)) continue;
        const gear = PilotHabits.latest(list, field, { place });
        if (gear && allowed(field, gear.value)) {
            values[field] = gear.value;
            reasons[field] = gear.reason === 'place' ? 'gearPlace' : 'gearLatest';
        }
    }

    // Stage : celui dont le pilote a saisi le nom, sinon celui d'une session proche (spec 038)
    const filled = new Set();
    let reference;
    if (stageName.trim()) {
        reference = latestOfCourse(list, stageName);
    } else {
        const nearest = findNearbySession(list, place, datetime, 'datetime');
        reference = nearest && isCourseSession(nearest) ? nearest : null;
        if (reference) reasons.stage = 'nearbySession';
    }
    if (reference) {
        values.stageName = typeof reference.stageName === 'string' ? reference.stageName.trim() : '';
        const specialty = typeof reference.stageSpecialty === 'string' ? reference.stageSpecialty : '';
        const fromCourse = (field, value) => {
            if (!can(field)) return;
            values[field] = value;
            reasons[field] = 'course';
            filled.add(field);
        };
        const schoolOfCourse = typeof reference.ecole === 'string' ? reference.ecole.trim() : '';
        if (schoolOfCourse) fromCourse('ecole', schoolOfCourse);
        if (specialty) fromCourse('stageSpecialty', specialty);
        const courseBrevet = typeof reference.brevetPrepare === 'string' ? reference.brevetPrepare.trim() : '';
        if (courseBrevet && can('brevetPrepare')) {
            const resolved = resolveSuggestedBrevet(courseBrevet, undefined, datetime);
            if (resolved) {
                values.brevetPrepare = resolved;
                reasons.brevetPrepare = resolved !== courseBrevet ? 'brevetNext' : 'course';
                filled.add('brevetPrepare');
            }
        }
        const lists = {
            moniteur: instructorsOf(reference),
            accompagnateur: companionsOf(reference),
            pilotes: Array.isArray(reference.pilotes) ? reference.pilotes : [],
        };
        for (const [field, names] of Object.entries(lists)) if (names.length) fromCourse(field, names);
    }

    if (can('ecole') && !filled.has('ecole')) {
        const school = PilotHabits.suggest(list, 'ecole', {
            sessionType: 'vol',
            context: { place },
            mismatch: { place: 0.1 }, // on vole en école sur certains sites, pas partout
            includeEmpty: true,
            minScore: 1,
        });
        if (school && school.value) {
            values.ecole = school.value;
            reasons.ecole = school.reason;
        }
    }

    // Moniteurs : ceux de la dernière session de cette école sur ce site, sinon de cette école
    const school = typeof values.ecole === 'string' ? values.ecole.trim().toLowerCase() : '';
    if (can('brevetPrepare') && !filled.has('brevetPrepare') && school) {
        const withBrevet = list.filter(
            (s) =>
                typeof s.ecole === 'string' &&
                s.ecole.trim().toLowerCase() === school &&
                typeof s.brevetPrepare === 'string' &&
                s.brevetPrepare.trim(),
        );
        const brevetRef = preferPlace(withBrevet, place);
        if (brevetRef) {
            const rawBrevet = brevetRef.brevetPrepare.trim();
            const resolved = resolveSuggestedBrevet(rawBrevet, undefined, datetime);
            if (resolved) {
                values.brevetPrepare = resolved;
                reasons.brevetPrepare =
                    resolved !== rawBrevet
                        ? 'brevetNext'
                        : placeKey && PilotHabits.placeOf(brevetRef) === placeKey
                          ? 'instructorPlace'
                          : 'instructorLatest';
            }
        } else if (BrevetService.hasAnyBrevetData()) {
            const target = BrevetService.getTargetSchoolBrevet(undefined, datetime);
            if (target) {
                values.brevetPrepare = target;
                reasons.brevetPrepare = 'brevetInProgress';
            }
        }
    }
    if (can('moniteur') && !filled.has('moniteur') && school) {
        const withInstructor = list.filter(
            (s) =>
                typeof s.ecole === 'string' && s.ecole.trim().toLowerCase() === school && instructorsOf(s).length > 0,
        );
        const sessionRef = preferPlace(withInstructor, place);
        if (sessionRef) {
            values.moniteur = instructorsOf(sessionRef);
            reasons.moniteur =
                placeKey && PilotHabits.placeOf(sessionRef) === placeKey ? 'instructorPlace' : 'instructorLatest';
        }
    }

    // Accompagnateurs : ceux d'une session de moins de 3 h ici, sinon les derniers de cette école ici
    if (can('accompagnateur') && !filled.has('accompagnateur') && school) {
        const withCompanion = list.filter(
            (s) => companionsOf(s).length > 0 && typeof s.ecole === 'string' && s.ecole.trim().toLowerCase() === school,
        );
        const close = findNearbySession(withCompanion, place, datetime, 'accompagnateur');
        const last = !close && placeKey ? withCompanion.find((s) => PilotHabits.placeOf(s) === placeKey) : null;
        if (close || last) {
            values.accompagnateur = companionsOf(close || last);
            reasons.accompagnateur = close ? 'nearbySession' : 'instructorPlace';
        }
    }

    // Pilotes : ceux d'une session au même endroit à moins de 3 h (plusieurs vols d'affilée)
    if (can('pilotes') && !filled.has('pilotes')) {
        const nearby = findNearbySession(list, place, datetime);
        if (nearby) {
            values.pilotes = nearby.pilotes;
            reasons.pilotes = 'nearbySession';
        }
    }

    return { values, reasons, stage: Boolean(reference) };
}
