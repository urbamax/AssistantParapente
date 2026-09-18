import StorageService from './storage.js';

class QuizService {
    constructor() {
        this.state = {
            qcmIndex: 0,
            qcmConfig: {
                mode: 'TRAINING', // TRAINING, EXAM, REVISION, MASTERY
                count: 10,
                theme: 'ALL',
                masteryTarget: 75,
            },
            qcmSessionData: [],
            currentQcmSelection: new Set(),
            examResults: [],
            isLoaded: false,
            loadingError: null,
        };
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
        if (typeof window !== 'undefined' && window.QCM_OFFICIAL && window.QCM_OFFICIAL.questions) {
            this.state.isLoaded = true;
            return { success: true, data: window.QCM_OFFICIAL.questions, error: null };
        }

        try {
            const cacheBuster = `v=${Date.now()}`;
            const [questionsRes, explicationsRes, courseMappingRes] = await Promise.all([
                fetch(`${this.basePath}/js/data/qcm_ffvl.csv?${cacheBuster}`),
                fetch(`${this.basePath}/js/data/qcm_ffvl_explanations.csv?${cacheBuster}`),
                fetch(`${this.basePath}/js/data/question_course_mapping.json?${cacheBuster}`),
            ]);

            if (!questionsRes.ok || !explicationsRes.ok) throw new Error('Failed to load QCM CSV data');

            const questionsCSV = await questionsRes.text();
            const explicationsCSV = await explicationsRes.text();
            // Le mapping question -> cours est un pré-requis mou (best-effort) : son absence ne
            // doit jamais empêcher le chargement des questions elles-mêmes.
            const courseMapping = courseMappingRes.ok ? await courseMappingRes.json() : {};

            const explications = this.parseExplicationsCSV(explicationsCSV);
            const questions = this.parseQuestionsCSV(questionsCSV, explications, courseMapping);

            if (typeof window !== 'undefined') {
                window.QCM_OFFICIAL = { questions };
            }
            this.state.isLoaded = true;
            return { success: true, data: questions, error: null };
        } catch (err) {
            this.state.loadingError = err.message || 'Erreur inconnue';
            this.state.isLoaded = true;
            return { success: false, data: null, error: err.message };
        }
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
                const expl = parts.slice(2).join(';').trim();
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
    // choix) : ne mute jamais window.QCM_OFFICIAL.questions[].choices, dont l'ordre canonique
    // reste stable pour la Banque de Questions.
    shuffleQuestionChoices(q) {
        if (!q || !Array.isArray(q.choices)) return { ...q };
        return { ...q, choices: this.shuffle(q.choices) };
    }

    getThemes() {
        const themes = new Set();
        if (typeof window !== 'undefined' && window.QCM_OFFICIAL && window.QCM_OFFICIAL.questions) {
            window.QCM_OFFICIAL.questions.forEach((q) => themes.add(q.theme));
        }
        return [...themes].sort();
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

    // Ratio de maîtrise d'une question (0 à 1) : correct/total, ou 0 si jamais tentée.
    // C'est la même formule que celle utilisée par l'écran Statistiques pour la "Réussite globale",
    // ce qui garantit que le mode Perfectionnement vise le même chiffre que celui affiché au pilote.
    getMasteryRatio(question, stats) {
        const s = stats.questions[question.code];
        return s && s.total > 0 ? s.correct / s.total : 0;
    }

    // Sélectionne, parmi `pool`, les questions les moins maîtrisées en priorité, jusqu'à ce que
    // le gain projeté (au mieux : bonne réponse à chacune, donc ratio -> 1) suffise à amener la
    // moyenne du périmètre au palier cible. C'est une projection optimiste : on mémorise le gain
    // supposé de chaque question choisie (_masteryAssumedGains) pour pouvoir, question par
    // question, corriger cette hypothèse par le résultat réel dans advanceMasteryProgress() —
    // sans quoi on recompterait comme "manquantes" des questions déjà en file mais pas encore
    // répondues, et la série s'allongerait après quasiment chaque réponse.
    buildMasterySelection(pool, stats, targetPct) {
        const poolSize = pool.length;
        const currentSum = pool.reduce((sum, q) => sum + this.getMasteryRatio(q, stats), 0);
        const targetSum = (targetPct / 100) * poolSize;
        const deficit = targetSum - currentSum;

        const sorted = this.shuffle(pool).sort(
            (a, b) => this.getMasteryRatio(a, stats) - this.getMasteryRatio(b, stats),
        );

        const assumedGains = new Map();
        const selected = [];
        let projectedGain = 0;
        for (const q of sorted) {
            if (projectedGain >= deficit) break;
            const gain = 1 - this.getMasteryRatio(q, stats);
            selected.push(q);
            assumedGains.set(q.code, gain);
            projectedGain += gain;
        }
        // Objectif déjà atteint : on propose quand même une petite série de consolidation
        // sur les questions les plus fragiles, plutôt qu'une session vide.
        if (selected.length === 0) {
            sorted.slice(0, Math.min(5, sorted.length)).forEach((q) => {
                selected.push(q);
                assumedGains.set(q.code, 1 - this.getMasteryRatio(q, stats));
            });
        }

        this._masteryPool = pool;
        this._masteryTargetPct = targetPct;
        this._masteryTargetSum = targetSum;
        this._masteryProjectedSum = currentSum + projectedGain;
        this._masteryAssumedGains = assumedGains;
        return selected;
    }

    // Recalcul dynamique en temps réel : appelé après chaque réponse avec le ratio de maîtrise
    // de la question AVANT cette réponse. On retire l'hypothèse optimiste posée à la sélection
    // (assumedGain) et on la remplace par le gain réellement observé ; si la somme projetée
    // repasse sous l'objectif (typiquement après une mauvaise réponse), on rallonge la série avec
    // de nouvelles questions faibles (en évitant les doublons tant que le périmètre n'est pas
    // épuisé, puis en autorisant la répétition) pour garantir qu'à la fin, le palier choisi soit
    // atteint.
    advanceMasteryProgress(question, ratioBefore) {
        if (this._masteryProjectedSum === undefined || !this._masteryPool) return;

        const statsNow = this.getPersistentStats();
        const ratioAfter = this.getMasteryRatio(question, statsNow);
        const assumedGain = this._masteryAssumedGains.get(question.code) || 0;
        const actualGain = ratioAfter - ratioBefore;

        this._masteryProjectedSum += actualGain - assumedGain;
        this._masteryAssumedGains.delete(question.code);

        const deficit = this._masteryTargetSum - this._masteryProjectedSum;
        if (deficit <= 0.0001) return;

        const alreadyScheduled = new Set(this.state.qcmSessionData.map((q) => q.code));
        let candidates = this._masteryPool.filter((q) => !alreadyScheduled.has(q.code));
        if (candidates.length === 0) candidates = this._masteryPool.slice();

        const sorted = this.shuffle(candidates).sort(
            (a, b) => this.getMasteryRatio(a, statsNow) - this.getMasteryRatio(b, statsNow),
        );

        const toAdd = [];
        let gained = 0;
        for (const q of sorted) {
            if (gained >= deficit) break;
            const gain = 1 - this.getMasteryRatio(q, statsNow);
            toAdd.push(q);
            this._masteryAssumedGains.set(q.code, gain);
            gained += gain;
        }
        if (toAdd.length === 0 && sorted.length > 0) {
            const q = sorted[0];
            toAdd.push(q);
            this._masteryAssumedGains.set(q.code, 1 - this.getMasteryRatio(q, statsNow));
        }

        this._masteryProjectedSum += gained;
        this.state.qcmSessionData.push(...toAdd.map((q) => this.shuffleQuestionChoices(q)));
    }

    // Progression actuelle vers l'objectif du mode Perfectionnement, pour affichage en direct.
    getMasteryProgress() {
        const pool = this._masteryPool;
        if (!pool || pool.length === 0) return null;
        const stats = this.getPersistentStats();
        const currentSum = pool.reduce((sum, q) => sum + this.getMasteryRatio(q, stats), 0);
        return {
            current: Math.round((currentSum / pool.length) * 100),
            target: this._masteryTargetPct || 75,
        };
    }

    startSession(level = 'BI') {
        if (!this.state.isLoaded) throw new Error('Données QCM non chargées');

        let sourceData = window.QCM_OFFICIAL && window.QCM_OFFICIAL.questions ? window.QCM_OFFICIAL.questions : [];
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

        let count = this.state.qcmConfig.count;
        const selectedTheme = this.state.qcmConfig.mode === 'EXAM' ? 'ALL' : this.state.qcmConfig.theme;

        if (count === 'ALL') count = sourceData.length;

        let questions;
        if (this.state.qcmConfig.mode === 'REVISION') {
            const stats = this.getPersistentStats();
            if (selectedTheme !== 'ALL') sourceData = sourceData.filter((q) => q.theme === selectedTheme);

            // Spaced repetition : l'intervalle avant la prochaine révision grandit avec le nombre
            // de bonnes réponses consécutives (streak, déjà suivi dans updateStats), et repart de
            // zéro à la moindre erreur. Une question jamais vue est toujours prioritaire ; parmi
            // les questions déjà vues, la plus en retard sur son échéance passe en premier (le
            // ratio de réussite ne sert plus que de départage à échéance égale).
            const REVIEW_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30];
            const DAY_MS = 24 * 60 * 60 * 1000;
            const now = Date.now();

            const getDueScore = (q) => {
                const s = stats.questions[q.code];
                if (!s || s.total === 0) return Infinity; // jamais tentée
                const ratio = s.correct / s.total;
                if (!s.lastSeen) {
                    // Statistique enregistrée avant l'introduction du suivi temporel (pas de
                    // lastSeen) : on retombe sur l'ancien critère de seuil de ratio pour ne pas
                    // casser l'historique existant tant que la question n'a pas été retentée.
                    return 0.75 - ratio;
                }
                const streak = s.streak || 0;
                const intervalDays = REVIEW_INTERVALS_DAYS[Math.min(streak, REVIEW_INTERVALS_DAYS.length - 1)];
                const daysSinceSeen = (now - s.lastSeen) / DAY_MS;
                return daysSinceSeen - intervalDays - ratio;
            };

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
            if (selectedTheme !== 'ALL') sourceData = sourceData.filter((q) => q.theme === selectedTheme);
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
        // et le tableau canonique QCM_OFFICIAL.questions[].choices ne sont pas mutés, pour que la
        // Banque de Questions garde un ordre de référence stable). Sans cela, la bonne réponse
        // apparaît toujours à la même position d'une session à l'autre et l'élève finit par
        // mémoriser un emplacement plutôt que la théorie.
        questions = questions.map((q) => this.shuffleQuestionChoices(q));

        this.state.qcmSessionData = questions;
        this.state.qcmIndex = 0;
        this.state.examResults = [];
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
            const isMastery = this.state.qcmConfig.mode === 'MASTERY';
            const ratioBefore = isMastery ? this.getMasteryRatio(question, this.getPersistentStats()) : null;
            this.updateStats(question, isCorrect);
            if (isMastery) this.advanceMasteryProgress(question, ratioBefore);
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
        if (!s || typeof s !== 'object' || !s.themes) return { themes: {}, questions: {} };
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

        StorageService.set(StorageService.KEYS.QCM_STATS, stats);

        // Synchronisation immédiate vers Firebase si disponible
        if (window.FirebaseAuthEngine && window.FirebaseAuthEngine.enabled) {
            window.FirebaseAuthEngine.saveStatsToCloud();
        }
    }

    saveExamHistory(level) {
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
            results: results.map((r) => ({
                question: r.question,
                isCorrect: r.isCorrect,
                theme: r.question.theme,
                selected: r.selected,
            })),
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

        // Handle legacy format: { exams: [...] }
        if (h && typeof h === 'object' && !Array.isArray(h) && Array.isArray(h.exams)) {
            return h.exams.filter((e) => e && typeof e === 'object' && e.date);
        }

        // Handle new format: [...]
        if (!Array.isArray(h)) return [];
        return h.filter((e) => e && typeof e === 'object' && e.date);
    }
}

export default new QuizService();
