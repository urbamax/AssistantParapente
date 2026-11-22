/**
 * SERVICE - Série « Questions à piège » (spec 063)
 * Ordonne les questions à piège d'une série d'entraînement : d'abord celles que l'élève a ratées et
 * pas réussies depuis (au moins une erreur, série de bonnes réponses à 0), puis celles jamais
 * tentées, puis les autres. L'ordre est tiré au hasard à l'intérieur de chaque groupe.
 */

/**
 * @template {{ code: string }} T
 * @param {T[]} questions questions à piège déjà filtrées (niveau, thème)
 * @param {Record<string, { total?: number, correct?: number, streak?: number }> | null | undefined} statsByCode
 * @param {(items: T[]) => T[]} shuffle mélange (copie) d'un tableau
 * @returns {T[]}
 */
export function orderTrapSeries(questions, statsByCode, shuffle) {
    const missed = [];
    const fresh = [];
    const rest = [];
    for (const q of questions || []) {
        const s = statsByCode ? statsByCode[q.code] : null;
        const total = s ? Number(s.total) || 0 : 0;
        const correct = s ? Number(s.correct) || 0 : 0;
        const streak = s ? Number(s.streak) || 0 : 0;
        if (total === 0) fresh.push(q);
        else if (total > correct && streak === 0) missed.push(q);
        else rest.push(q);
    }
    return [...shuffle(missed), ...shuffle(fresh), ...shuffle(rest)];
}
