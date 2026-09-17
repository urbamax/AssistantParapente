import StorageService from './storage.js';

class QuizService {
    constructor() {
        this.state = {
            qcmIndex: 0,
            qcmConfig: {
                mode: 'TRAINING', // TRAINING, EXAM, REVISION
                count: 10,
                theme: 'ALL'
            },
            qcmSessionData: [],
            currentQcmSelection: new Set(),
            examResults: [],
            isLoaded: false,
            loadingError: null
        };
        this.basePath = '.';
    }

    async init(basePath = '.') {
        console.log("QuizService.init() started, basePath:", basePath);
        this.basePath = basePath;
        try {
            const res = await this.loadOfficialData();
            console.log("QuizService.init() finished successfully", res);
            return res;
        } catch (e) {
            console.error("QuizService.init() failed", e);
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
            const [questionsRes, explicationsRes] = await Promise.all([
                fetch(`${this.basePath}/js/data/qcm_ffvl.csv?${cacheBuster}`),
                fetch(`${this.basePath}/js/data/qcm_ffvl_explanations.csv?${cacheBuster}`)
            ]);

            if (!questionsRes.ok || !explicationsRes.ok) throw new Error("Failed to load QCM CSV data");

            const questionsCSV = await questionsRes.text();
            const explicationsCSV = await explicationsRes.text();

            const explications = this.parseExplicationsCSV(explicationsCSV);
            const questions = this.parseQuestionsCSV(questionsCSV, explications);

            if (typeof window !== 'undefined') {
                window.QCM_OFFICIAL = { questions };
            }
            this.state.isLoaded = true;
            return { success: true, data: questions, error: null };
        } catch (err) {
            this.state.loadingError = err.message || "Erreur inconnue";
            this.state.isLoaded = true;
            return { success: false, data: null, error: err.message };
        }
    }

    parseExplicationsCSV(csvText) {
        const rows = csvText.split('\n');
        const data = {};
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i].trim();
            if (!row) continue;
            const parts = row.split(';');
            if (parts.length >= 3) {
                const id = parts[0].replace(/"/g, '');
                const expl = parts.slice(2).join(';').replace(/^"|"$/g, '').trim();
                data[id] = expl;
            }
        }
        return data;
    }

    parseQuestionsCSV(csvText, explications) {
        try {
            const parseLine = (line) => {
                const result = [];
                let current = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === '"') inQuotes = !inQuotes;
                    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
                    else current += char;
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

                questions.push({
                    code,
                    question: questionText,
                    choices: ans.map(a => ({ text: a.text, pts: parseInt(a.pts || 0) })),
                    niveau,
                    parapente: pFlag,
                    theme: this.getThemeForCode(code),
                    explication: explications[code] || ""
                });
            }
            return questions;
        } catch (error) {
            console.error("Erreur critique lors du parsing du fichier CSV des questions :", error);
            return [];
        }
    }

    getThemeForCode(code) {
        if (!code) return 'Autre';
        const map = {
            'A': 'Météo',
            'E': 'Mécavol', 'G': 'Mécavol', 'H': 'Mécavol',
            'L': 'Matériel', 'N': 'Matériel', 'R': 'Matériel',
            'U': 'Pilotage', 'W': 'Pilotage', 'X': 'Pilotage',
            'S': 'Réglementation',
            'F': 'Facteurs humains',
            'P': 'Milieu naturel'
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

    getThemes() {
        const themes = new Set();
        if (typeof window !== 'undefined' && window.QCM_OFFICIAL && window.QCM_OFFICIAL.questions) {
            window.QCM_OFFICIAL.questions.forEach(q => themes.add(q.theme));
        }
        return [...themes].sort();
    }

    setMode(mode) {
        this.state.qcmConfig.mode = mode;
        // L'examen blanc doit toujours porter sur les 60 questions aléatoires de tous les thèmes :
        // on force ce reset ici pour qu'un filtre thématique laissé actif en entraînement ne fuite jamais dans l'examen.
        if (mode === 'EXAM') this.state.qcmConfig.theme = 'ALL';
    }
    setCount(count) { this.state.qcmConfig.count = count; }
    setTheme(theme) { this.state.qcmConfig.theme = theme; }

    startSession(level = 'BI') {
        if (!this.state.isLoaded) throw new Error("Données QCM non chargées");

        let sourceData = (window.QCM_OFFICIAL && window.QCM_OFFICIAL.questions) ? window.QCM_OFFICIAL.questions : [];
        const excludedPrefixes = ['H', 'R', 'X']; 
        sourceData = sourceData.filter(q => !excludedPrefixes.includes(q.code.charAt(0)));

        const hasLevel = (code, letter) => code.replace(/^[a-zA-Z]+\d+/, '').includes(letter);
        if (level === 'BI') {
            sourceData = sourceData.filter(q => hasLevel(q.code, 'V'));
        } else if (level === 'BP') {
            sourceData = sourceData.filter(q => hasLevel(q.code, 'B'));
        } else if (level === 'BPC') {
            sourceData = sourceData.filter(q => hasLevel(q.code, 'M'));
        } else if (level === 'TREUIL') {
            sourceData = sourceData.filter(q => hasLevel(q.code, 'T'));
        }

        let count = this.state.qcmConfig.count;
        const selectedTheme = this.state.qcmConfig.mode === 'EXAM' ? 'ALL' : this.state.qcmConfig.theme;

        if (count === 'ALL') count = sourceData.length;

        let questions;
        if (this.state.qcmConfig.mode === 'REVISION') {
            const stats = this.getPersistentStats();
            if (selectedTheme !== 'ALL') sourceData = sourceData.filter(q => q.theme === selectedTheme);

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
                return (daysSinceSeen - intervalDays) - ratio;
            };

            // On mélange d'abord (comme l'ancienne implémentation) puis on trie par échéance :
            // le tri étant stable, les questions à égalité de priorité (ex: toutes "jamais vues")
            // gardent un ordre aléatoire au lieu de rester figées dans l'ordre du CSV source.
            const scored = this.shuffle(sourceData).map(q => ({ q, dueScore: getDueScore(q) }));
            const dueOnly = scored.filter(x => x.dueScore >= 0);

            // S'il n'y a rien d'échu (bon pilote, tout est encore "frais"), on retombe sur
            // l'ensemble des questions triées par échéance la plus proche, pour ne jamais bloquer
            // une session de révision sur un tableau vide.
            const pool = dueOnly.length > 0 ? dueOnly : scored;
            const filteredData = pool.sort((a, b) => b.dueScore - a.dueScore).map(x => x.q);

            questions = filteredData.slice(0, count);
        } else {
            if (selectedTheme !== 'ALL') sourceData = sourceData.filter(q => q.theme === selectedTheme);
            if (this.state.qcmConfig.mode === 'EXAM') {
                count = (level === 'BP') ? 60 : 30;
            }
            questions = this.shuffle(sourceData).slice(0, count);
        }

        if (questions.length === 0) throw new Error("Aucune question trouvée");

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

        question.choices.forEach(c => {
            if (c.pts > 0) maxScore += c.pts;
            if (this.state.currentQcmSelection.has(c)) {
                userScore += c.pts;
                if (c.pts < 0) hasNegativeEffect = true;
            }
        });

        const isCorrect = this.state.qcmConfig.mode === 'EXAM' 
            ? (userScore === maxScore) 
            : ((userScore === maxScore) && !hasNegativeEffect);

        const resultData = {
            question,
            selected: selectedOptions,
            correct: question.choices.filter(c => c.pts > 0),
            isCorrect,
            userPoints: userScore,
            maxPoints: maxScore
        };

        this.state.examResults[this.state.qcmIndex] = resultData;
        
        if (this.state.qcmConfig.mode !== 'EXAM') {
            this.updateStats(question, isCorrect);
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
        const total = this.state.qcmSessionData && this.state.qcmSessionData.length > 0 ? this.state.qcmSessionData.length : results.length;
        const score = results.filter(r => r.isCorrect).length;
        const history = this.getExamHistory();
        
        const isInvalidated = this.state.invalidated === true;
        
        history.unshift({
            id: 'exam_' + Date.now(),
            date: new Date().toISOString(),
            level: level,
            score: isInvalidated ? 0 : score,
            total: total,
            percentage: isInvalidated ? 0 : Math.round((score / total) * 100),
            passed: isInvalidated ? false : score >= (total * 0.75), // 75% pour réussir
            invalidated: isInvalidated,
            results: results.map(r => ({
                question: r.question,
                isCorrect: r.isCorrect,
                theme: r.question.theme,
                selected: r.selected
            }))
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
            return h.exams.filter(e => e && typeof e === 'object' && e.date);
        }
        
        // Handle new format: [...]
        if (!Array.isArray(h)) return [];
        return h.filter(e => e && typeof e === 'object' && e.date);
    }
}

export default new QuizService();
