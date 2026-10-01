/**
 * SERVICE - Quiz Voice (spec 016)
 * Logique pure du mode vocal du QCM : textes lus à voix haute et interprétation des phrases
 * entendues. Aucune dépendance au navigateur : tout est testé unitairement.
 */
import { t } from '../utils/i18n.js';

/**
 * @typedef {{ type: 'letters', indexes: number[] }
 *   | { type: 'command', name: 'validate' | 'next' | 'prev' | 'repeat' | 'clear' | 'stop' }
 *   | { type: 'unknown' }} VoiceCommand
 */

const LETTERS = 'ABCDEF';

/** @param {number} index @returns {string} */
export function optionLetter(index) {
    return LETTERS[index] || String(index + 1);
}

/** Ajoute un point final sauf si le texte se termine déjà par une ponctuation. */
function withFinalStop(text) {
    const trimmed = String(text || '').trim();
    return /[.!?…:;]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/**
 * Question puis chaque réponse précédée de sa lettre, dans l'ordre affiché, sans reformulation.
 * @param {{ question: string, choices: { text: string }[] }} q
 */
export function buildQuestionSpeech(q) {
    const options = q.choices.map((c, i) => {
        const spoken = t('quiz.voice.speech.option', { letter: optionLetter(i), text: String(c.text || '').trim() });
        // « Réponse A : Oui.. » : le catalogue ajoute un point, on évite de le doubler.
        return /[.!?…:;]\.$/.test(spoken) ? spoken.slice(0, -1) : spoken;
    });
    return [String(q.question || '').trim(), ...options].join(' ');
}

/**
 * Verdict puis explication.
 * @param {{ isCorrect: boolean, question: { explication?: string } }} result
 */
export function buildFeedbackSpeech(result) {
    let verdictKey = 'quiz.voice.speech.incorrect';
    if (result.isCorrect) {
        verdictKey = 'quiz.voice.speech.correct';
    } else if (result.userPoints > 0 && result.selected && !result.selected.some((c) => c.pts < 0)) {
        verdictKey = 'quiz.voice.speech.incomplete';
    }

    const verdict = t(verdictKey);
    const explanation = String(result.question?.explication || '').trim();
    return explanation ? `${verdict} ${withFinalStop(explanation)}` : verdict;
}

/**
 * @param {number[]} indexes
 * @param {{text: string}[]} [choices]
 */
export function describeSelection(indexes, choices = []) {
    if (!indexes.length) return t('quiz.voice.speech.cleared');
    const spokenOptions = indexes.map((i) => {
        const letter = optionLetter(i);
        const text = choices && choices[i] ? choices[i].text : '';
        return text ? `${letter}, ${text}` : letter;
    });
    return t('quiz.voice.speech.selection', { letters: spokenOptions.join('. ') });
}

/** Minuscules, sans accents, apostrophes et ponctuation remplacées par des espaces. */
function normalize(text) {
    let normalized = String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[’'`]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

    // Remplacements phonétiques pour les associations de lettres courantes
    normalized = normalized
        .replace(/\baider\b/g, 'a d')
        .replace(/\bassez\b/g, 'a c')
        .replace(/\babaisser\b/g, 'a b c')
        .replace(/\bbaisser\b/g, 'b c')
        .replace(/\bceder\b/g, 'c d')
        .replace(/\bdeces\b/g, 'd c');

    return normalized;
}

const COMMANDS = {
    validate: ['valider', 'valide', 'validez', 'validation', 'je valide'],
    next: ['suivante', 'suivant', 'question suivante', 'la suivante', 'suite'],
    prev: ['precedente', 'precedent', 'question precedente', 'la precedente', 'retour'],
    repeat: ['repete', 'repeter', 'repetez', 'relis', 'relire', 'lire'],
    clear: ['effacer', 'efface', 'effacez'],
    stop: ['stop', 'arrete', 'arreter', 'arretez'],
};

// Mots qui désignent sans ambiguïté une lettre.
const STRONG_LETTERS = { a: 0, b: 1, be: 1, bee: 1, c: 2, d: 3, e: 4, f: 5, ef: 5, effe: 5 };
// Homophones qui sont aussi des mots courants : acceptés seulement s'ils forment toute la phrase.
const WEAK_LETTERS = {
    ah: 0,
    ha: 0,
    baie: 1,
    ce: 2,
    ces: 2,
    ses: 2,
    sait: 2,
    cest: 2,
    de: 3,
    des: 3,
    dees: 3,
    eu: 4,
    euh: 4,
};
const FILLERS = new Set(['reponse', 'reponses', 'et', 'la', 'le', 'les', 'lettre', 'lettres']);

/**
 * Interprète une phrase entendue.
 * @param {string} transcript
 * @param {number} optionCount nombre de réponses affichées
 * @returns {VoiceCommand}
 */
export function parseVoiceCommand(transcript, optionCount) {
    const phrase = normalize(transcript);
    if (!phrase) return { type: 'unknown' };

    for (const [name, variants] of Object.entries(COMMANDS)) {
        if (variants.includes(phrase)) {
            return /** @type {VoiceCommand} */ ({ type: 'command', name });
        }
    }

    const tokens = phrase.split(' ');
    const words = tokens.filter((w) => !FILLERS.has(w));
    if (!words.length) return { type: 'unknown' };

    const indexes = new Set();
    for (const word of words) {
        if (word in STRONG_LETTERS) {
            indexes.add(STRONG_LETTERS[word]);
        } else if (word in WEAK_LETTERS && tokens.length === 1) {
            indexes.add(WEAK_LETTERS[word]);
        } else if (!(word in WEAK_LETTERS) && /^[a-f]{2,6}$/.test(word)) {
            // Lettres collées par la reconnaissance : « BD ».
            for (const ch of word) indexes.add(STRONG_LETTERS[ch]);
        } else {
            return { type: 'unknown' };
        }
    }

    const sorted = [...indexes].sort((x, y) => x - y);
    if (sorted.some((i) => i >= optionCount)) return { type: 'unknown' };
    return { type: 'letters', indexes: sorted };
}
