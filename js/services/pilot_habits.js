/**
 * PilotHabits
 * Ce que l'app apprend du carnet du pilote pour pré-remplir le formulaire d'une session.
 *
 * Chaque session passée est un indice, pondéré par :
 *  - sa récence (demi-vie de RECENCY_HALF_LIFE sessions : les habitudes peuvent changer) ;
 *  - sa ressemblance avec la session en cours (même site, même mode de décollage…) : une
 *    session qui ne correspond pas compte beaucoup moins (facteur `mismatch` du contexte).
 * Une règle générale (ex. « au treuil, on décolle dos voile ») n'est qu'un a priori qui vaut
 * quelques sessions : dès que les vols du pilote disent autre chose, ce sont eux qui gagnent.
 *
 * Les sessions sont attendues de la plus récente à la plus ancienne (ordre de LogbookService).
 */
const PilotHabits = {
    RECENCY_HALF_LIFE: 15,

    /** Nom de lieu normalisé (site d'un vol, lieu d'un gonflage) */
    placeOf(session) {
        const place = session && (session.type === 'vol' ? session.site : session.lieu);
        return typeof place === 'string' ? place.trim().toLowerCase() : '';
    },

    /** Mode de décollage : 'treuil' ou 'libre' */
    launchOf(session) {
        return session && session.typeVol === 'Treuil' ? 'treuil' : 'libre';
    },

    /**
     * Valeur la plus probable d'un champ.
     * @param {Array<Object>} sessions carnet, du plus récent au plus ancien
     * @param {string} field champ de session (`techDecollage`, `typeVol`, `ecole`…)
     * @param {Object} [options]
     * @param {string} [options.sessionType] 'vol' ou 'gonflage' : seules ces sessions comptent
     * @param {{place?: string, launch?: string}} [options.context] session en cours
     * @param {{value: string, weight: number, reason: string}} [options.prior] règle générale
     * @param {boolean} [options.includeEmpty] une valeur vide est une réponse (ex. pas d'école)
     * @param {number} [options.minScore] poids minimal pour proposer quelque chose
     * @param {{place?: number, launch?: number}} [options.mismatch] poids d'une session d'un autre
     *   lieu / d'un autre mode de décollage (défaut : 0,3 et 0,05). Plus il est bas, plus le
     *   champ est propre au lieu (le type de vol d'un site, par exemple).
     * @returns {{value: string, reason: string}|null} reason : 'place', 'launch', 'habit' ou
     *   celle de l'a priori
     */
    suggest(sessions, field, options = {}) {
        const { sessionType, context = {}, prior = null, includeEmpty = false, minScore = 0.5 } = options;
        const mismatch = { place: 0.3, launch: 0.05, ...options.mismatch };
        const factors = {
            place: {
                value: context.place ? context.place.trim().toLowerCase() : '',
                of: (s) => this.placeOf(s),
                mismatch: mismatch.place,
            },
            launch: { value: context.launch || '', of: (s) => this.launchOf(s), mismatch: mismatch.launch },
        };
        const scores = new Map(); // valeur → { total, place, launch }
        let rank = 0;
        for (const s of sessions || []) {
            if (sessionType && s.type !== sessionType) continue;
            const raw = s[field];
            const value = typeof raw === 'string' ? raw.trim() : '';
            if (!value && !includeEmpty) continue;
            let weight = 0.5 ** (rank / this.RECENCY_HALF_LIFE);
            rank++;
            const matched = {};
            for (const [key, f] of Object.entries(factors)) {
                if (!f.value) continue;
                matched[key] = f.of(s) === f.value;
                if (!matched[key]) weight *= f.mismatch;
            }
            const entry = scores.get(value) || { total: 0, place: 0, launch: 0 };
            entry.total += weight;
            if (matched.place) entry.place += weight;
            if (matched.launch) entry.launch += weight;
            scores.set(value, entry);
        }
        if (prior) {
            const entry = scores.get(prior.value) || { total: 0, place: 0, launch: 0 };
            entry.total += prior.weight;
            entry.prior = prior.weight;
            scores.set(prior.value, entry);
        }

        let best = null;
        for (const [value, entry] of scores) if (!best || entry.total > best[1].total) best = [value, entry];
        if (!best || best[1].total < minScore) return null;

        const [value, entry] = best;
        let reason = 'habit';
        if (entry.prior && entry.prior >= entry.total / 2) reason = prior.reason;
        else if (entry.place >= entry.total / 2) reason = 'place';
        else if (entry.launch >= entry.total / 2) reason = 'launch';
        return { value, reason };
    },

    /**
     * Dernière valeur utilisée, sur ce lieu en priorité (le matériel : une voile neuve
     * remplace l'ancienne tout de suite, sauf là où le pilote en utilise une autre).
     * @param {Array<Object>} sessions
     * @param {string} field
     * @param {{sessionType?: string, place?: string}} [options]
     * @returns {{value: string, reason: 'place'|'latest'}|null}
     */
    latest(sessions, field, { sessionType, place = '' } = {}) {
        const key = place.trim().toLowerCase();
        const usable = (sessions || []).filter(
            (s) => (!sessionType || s.type === sessionType) && typeof s[field] === 'string' && s[field].trim(),
        );
        const here = key ? usable.find((s) => this.placeOf(s) === key) : null;
        if (here) return { value: here[field].trim(), reason: 'place' };
        return usable.length ? { value: usable[0][field].trim(), reason: 'latest' } : null;
    },

    /**
     * Valeurs triées par usage (récence comprise), les plus utilisées d'abord. `valueOf` rend une
     * valeur, ou une liste quand une session en porte plusieurs (moniteurs) : chacune compte.
     */
    rankByUse(sessions, valueOf) {
        const scores = new Map();
        (sessions || []).forEach((s, rank) => {
            const raw = valueOf(s);
            for (const v of Array.isArray(raw) ? raw : [raw]) {
                if (!v) continue;
                scores.set(v, (scores.get(v) || 0) + 0.5 ** (rank / this.RECENCY_HALF_LIFE));
            }
        });
        return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
    },
};

export default PilotHabits;
