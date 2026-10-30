import StorageService from './storage.js';
import { toSorted } from '../utils/array_utils.js';
import { t } from '../utils/i18n.js';
import { dueScore, summarizeReviews } from './review_scheduler.js';
import { masteryRatio, masteryRatioAfterCorrect, pushAttempt } from './mastery.js';

// Tolérance sur la somme des maîtrises (flottants) pour décider que l'objectif est atteint.
const MASTERY_EPSILON = 1e-9;

export function isExamBloated(exam) {
    if (!exam || !Array.isArray(exam.results)) return false;
    return exam.results.some(
        (r) =>
            r &&
            ((r.question && typeof r.question === 'object') ||
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
    const theme = r.theme || (qObj && typeof qObj === 'object' ? qObj.theme : '') || '';
    const isCorrect = r.isCorrect !== undefined ? Boolean(r.isCorrect) : false;

    const canonicalQ = code && typeof questionLookup === 'function' ? questionLookup(code) : null;
    const rawSelected = r.selected || [];
    const selected = Array.isArray(rawSelected)
        ? rawSelected.map((s) => {
              if (typeof s === 'number') return s;
              const text = typeof s === 'string' ? s : s?.text;
              if (canonicalQ && Array.isArray(canonicalQ.choices) && text !== undefined) {
                  const idx = canonicalQ.choices.findIndex((c) => c && c.text === text);
                  if (idx !== -1) return idx;
              }
              if (qObj && Array.isArray(qObj.choices) && text !== undefined) {
                  const idx = qObj.choices.findIndex((c) => c && c.text === text);
                  if (idx !== -1) return idx;
              }
              return text !== undefined ? text : s;
          })
        : [];

    return {
        code,
        theme,
        isCorrect,
        selected,
    };
}

export function compactExam(exam, questionLookup) {
    if (!exam || typeof exam !== 'object') return exam;
    const results = Array.isArray(exam.results) ? exam.results.map((r) => compactExamResult(r, questionLookup)) : [];
    return {
        id: exam.id,
        date: exam.date,
        level: exam.level,
        score: exam.score !== undefined ? exam.score : 0,
        total: exam.total !== undefined ? exam.total : results.length,
        percentage: exam.percentage !== undefined ? exam.percentage : 0,
        passed: exam.passed !== undefined ? exam.passed : false,
        invalidated: Boolean(exam.invalidated),
        results,
    };
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
        // L'examen blanc doit toujours porter sur les 60 questions aléatoires de tous les thèmes :
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
        } else {
            if (selectedTheme !== 'ALL') sourceData = sourceData.filter((q) => q.theme === selectedTheme);
            if (this.state.qcmConfig.mode === 'EXAM') {
                count = level === 'BP' ? 60 : 30;
            }
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

        this.state.examResults[this.state.qcmIndex] = resultData;

        if (this.state.qcmConfig.mode !== 'EXAM') {
            this.updateStats(question, isCorrect);
            if (this.state.qcmConfig.mode === 'MASTERY') this.advanceMasteryProgress();
        }

        return resultData;
    }

    nextQuestion() {
        this.state.qcmIndex++;
        this.state.currentQcmSelection = new Set();
        return this.getCurrentQuestion();
    }

    prevQuestion() {
        if (this.state.qcmIndex > 0) {
            this.state.qcmIndex--;
            this.state.currentQcmSelection = new Set(this.state.examResults[this.state.qcmIndex]?.selected || []);
        }
        return this.getCurrentQuestion();
    }

    getPersistentStats() {
        const s = StorageService.get(StorageService.KEYS.QCM_STATS, { themes: {}, questions: {} });
        if (!s || typeof s !== 'object' || !s.themes)
            return { totalQuestions: 0, totalCorrect: 0, themes: {}, questions: {} };
        const prevTotal = s.totalQuestions;
        const prevCorrect = s.totalCorrect;
        recalculateGlobalCounters(s);
        if (s.totalQuestions !== prevTotal || s.totalCorrect !== prevCorrect) {
            StorageService.set(StorageService.KEYS.QCM_STATS, s);
            if (typeof window !== 'undefined' && window.FirebaseAuthEngine && window.FirebaseAuthEngine.enabled) {
                window.FirebaseAuthEngine.saveStatsToCloud();
            }
        }
        return s;
    }

    updateStats(question, isCorrect) {
        const stats = this.getPersistentStats();
        if (!stats.questions) stats.questions = {};
        if (!stats.themes) stats.themes = {};

        // Question specific stats
        if (!stats.questions[question.code]) {
            stats.questions[question.code] = { total: 0, correct: 0, streak: 0 };
        }
        const qStat = stats.questions[question.code];
        qStat.recent = pushAttempt(qStat, isCorrect);
        qStat.total++;
        if (isCorrect) {
            qStat.correct++;
            qStat.streak = (qStat.streak || 0) + 1;
        } else {
            qStat.streak = 0;
        }
        qStat.lastSeen = Date.now();

        // Theme specific stats
        if (!stats.themes[question.theme]) {
            stats.themes[question.theme] = { total: 0, correct: 0 };
        }
        const tStat = stats.themes[question.theme];
        tStat.total++;
        if (isCorrect) tStat.correct++;

        // Global counters
        stats.totalQuestions = (stats.totalQuestions || 0) + 1;
        if (isCorrect) {
            stats.totalCorrect = (stats.totalCorrect || 0) + 1;
        }

        StorageService.set(StorageService.KEYS.QCM_STATS, stats);

        // Synchronisation immédiate vers Firebase si disponible
        if (window.FirebaseAuthEngine && window.FirebaseAuthEngine.enabled) {
            window.FirebaseAuthEngine.saveStatsToCloud();
        }
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

    // Une session d'examen ne produit qu'une entrée d'historique, même si l'écran de résultats
    // est rendu plusieurs fois (invalidation puis fin de série, nouveau rendu...).
    saveExamHistory(level) {
        if (this.state.examSaved) return;
        this.state.examSaved = true;
        const results = this.state.examResults;
        const total =
            this.state.qcmSessionData && this.state.qcmSessionData.length > 0
                ? this.state.qcmSessionData.length
                : results.length;
        const score = results.filter((r) => r.isCorrect).length;
        const history = this.getExamHistory();

        const isInvalidated = this.state.invalidated === true;

        history.unshift({
            id: 'exam_' + Date.now(),
            date: new Date().toISOString(),
            level: level,
            score: isInvalidated ? 0 : score,
            total: total,
            percentage: isInvalidated ? 0 : Math.round((score / total) * 100),
            passed: isInvalidated ? false : score >= total * 0.75, // 75% pour réussir
            invalidated: isInvalidated,
            results: this.compactExamResults(results),
        });

        // Garder que les 20 derniers
        if (history.length > 20) history.pop();

        StorageService.set(StorageService.KEYS.EXAM_HISTORY, { exams: history });
        this.state.invalidated = false;

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

        // Migration automatique des historiques d'examens volumineux
        let needsMigration = false;
        const compacted = exams.map((exam) => {
            if (this.isExamBloated(exam)) {
                needsMigration = true;
                return this.compactExam(exam);
            }
            return exam;
        });

        if (needsMigration && this.questions && this.questions.length > 0) {
            StorageService.set(StorageService.KEYS.EXAM_HISTORY, { exams: compacted });
            if (window.FirebaseAuthEngine && window.FirebaseAuthEngine.enabled) {
                window.FirebaseAuthEngine.saveHistoryToCloud();
            }
        }

        return compacted;
    }
}

export default new QuizService();
