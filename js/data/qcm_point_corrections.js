/**
 * DONNEES - Révisions des données du QCM qui changent des points.
 *
 * js/data/qcm_ffvl.csv suit jruffet/qcmffvl mot pour mot. Quand jruffet change les points d'une question,
 * les examens déjà enregistrés gardent l'ancien score. À chaque révision, on décrit ici la correction :
 * au prochain chargement, chaque examen enregistré avec une révision plus ancienne est recalculé
 * (voir `applyPointCorrections` dans quiz_service.js), puis marqué de la révision courante.
 *
 * Pour ajouter une révision : incrémenter QCM_DATA_REVISION et ajouter une ligne dans
 * QCM_POINT_CORRECTIONS avec les points de chaque choix avant (`oldPts`) et après (`newPts`),
 * dans l'ordre du CSV. Le test tests/services/qcm_point_corrections.test.js vérifie que `newPts`
 * correspond bien au CSV.
 */

/** Révision courante des données du QCM. Les examens enregistrés sans révision valent 0. */
export const QCM_DATA_REVISION = 1;

/**
 * @type {ReadonlyArray<{ revision: number, code: string, oldPts: readonly number[], newPts: readonly number[], note: string }>}
 */
export const QCM_POINT_CORRECTIONS = Object.freeze([
    Object.freeze({
        revision: 1,
        code: 'L14B',
        oldPts: Object.freeze([-6, 6, -6, 3]),
        newPts: Object.freeze([-6, 3, -6, 3]),
        note: 'jruffet/qcmffvl 2026-02-16 : L14B vaut 3 + 3 points (6 + 3 = 9 auparavant)',
    }),
]);
