/**
 * SERVICE - Quiz Voice (spec 016)
 * Logique pure du mode vocal du QCM : textes lus à voix haute et interprétation des phrases
 * entendues. Aucune dépendance au navigateur : tout est testé unitairement.
 */
import { t } from '../utils/i18n.js';
import { choiceIndex } from './answer_log.js';
import { splitOptionExplanations } from './error_diagnostic.js';

/**
 * @typedef {{ type: 'letters', indexes: number[] }
 *   | { type: 'command', name: 'validate' | 'next' | 'prev' | 'repeat' | 'clear' | 'stop' | 'yes' | 'no' }
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
 * Texte de la question seule (sans les propositions).
 * @param {{ question?: string }} q
 * @returns {string}
 */
export function buildQuestionOnlySpeech(q) {
    return String(q?.question || '').trim();
}

/**
 * Texte d'une proposition précédée de sa lettre (« Réponse A : … »).
 * @param {{ text?: string }} choice
 * @param {number} index
 * @returns {string}
 */
export function buildOptionSpeech(choice, index) {
    const spoken = t('quiz.voice.speech.option', {
        letter: optionLetter(index),
        text: String(choice?.text || '').trim(),
    });
    // « Réponse A : Oui.. » : le catalogue ajoute un point, on évite de le doubler.
    return /[.!?…:;]\.$/.test(spoken) ? spoken.slice(0, -1) : spoken;
}

/**
 * Question puis chaque réponse précédée de sa lettre, dans l'ordre affiché, sans reformulation.
 * @param {{ question: string, choices: { text: string }[] }} q
 */
export function buildQuestionSpeech(q) {
    const options = (q.choices || []).map((c, i) => buildOptionSpeech(c, i));
    return [buildQuestionOnlySpeech(q), ...options].join(' ');
}

// Ligne de fin « Aucune source trouvée… » de certaines explications : une note pour l'écran, pas à lire.
const SOURCE_LINE = /^aucune source trouv/i;

/** @param {unknown} text paragraphes lisibles d'une explication, sans la note de source */
function readableParagraphs(text) {
    return String(text || '')
        .split('\n')
        .map((p) => p.trim())
        .filter((p) => p && !SOURCE_LINE.test(p));
}

/**
 * Ce qui est lu de l'explication : seulement les passages qui concernent la faute, c'est-à-dire ceux
 * des réponses fausses cochées et des bonnes réponses oubliées. Sans question d'origine (les choix de
 * la séance sont mélangés, on ne peut pas retrouver les paragraphes) ou si l'explication ne se découpe
 * pas par choix, toute l'explication est lue.
 *
 * @param {{ question?: { explication?: string }, selected?: any[] }} result
 * @param {{ choices?: any[], explication?: string } | null | undefined} original question dans l'ordre du CSV
 * @returns {string}
 */
export function buildFaultExplanation(result, original) {
    const all = readableParagraphs(result.question?.explication);
    const choices = original?.choices;
    if (!original || !Array.isArray(choices)) return all.join(' ');
    const parts = splitOptionExplanations(original);
    if (parts.length === 0 || parts.some((p) => p === null)) return all.join(' ');

    const picked = new Set((result.selected || []).map((c) => choiceIndex(original, c)));
    const fault = parts.filter(
        (_, i) => (choices[i].pts < 0 && picked.has(i)) || (choices[i].pts > 0 && !picked.has(i)),
    );
    return (fault.length > 0 ? fault : all).join(' ');
}

/**
 * Phrases lues sur les pièges (récurrent, rechute, évité, surmonté), comme le feedback affiché mais
 * sans guillemets ni exposant, que la synthèse vocale lit mal.
 * @param {{ recurrent?: any[], avoided?: any[], overcome?: any[] } | undefined} feedback
 * @returns {string[]}
 */
export function buildTrapSpeech(feedback) {
    if (!feedback) return [];
    const spoken = (item) =>
        String(item.text || '')
            .trim()
            .replace(/[.!?…:;]+$/, '');
    return [
        ...(feedback.recurrent || []).map((r) =>
            t(r.relapse ? 'quiz.voice.speech.trapRelapse' : 'quiz.voice.speech.trapRecurrent', {
                count: r.count,
                text: spoken(r),
            }),
        ),
        ...(feedback.overcome || []).map((r) => t('quiz.voice.speech.trapOvercome', { text: spoken(r) })),
        ...(feedback.avoided || []).map((r) => t('quiz.voice.speech.trapAvoided', { text: spoken(r) })),
    ];
}

/**
 * Phrase de fin de série, lue en mode enchaîné (mains libres) : le pilote n'a pas l'écran sous les yeux.
 * @param {number} score bonnes réponses
 * @param {number} total questions de la série
 */
export function buildFinishedSpeech(score, total) {
    return t('quiz.voice.speech.finished', { score, total });
}

/**
 * Verdict, pièges éventuels, puis les passages de l'explication qui concernent la faute.
 * Verdict « incomplète » : des points gagnés, aucune réponse fausse cochée, mais pas toutes les bonnes.
 * @param {{ isCorrect: boolean, question: { explication?: string }, userPoints?: number, selected?: { pts: number }[], trapFeedback?: any }} result
 * @param {{ choices?: any[], explication?: string } | null} [original] question d'origine (ordre du CSV)
 */
export function buildFeedbackSpeech(result, original = null) {
    let verdictKey = 'quiz.voice.speech.incorrect';
    if (result.isCorrect) {
        verdictKey = 'quiz.voice.speech.correct';
    } else if (result.userPoints > 0 && result.selected && !result.selected.some((c) => c.pts < 0)) {
        verdictKey = 'quiz.voice.speech.incomplete';
    }

    const verdict = [t(verdictKey), ...buildTrapSpeech(result.trapFeedback)].join(' ');
    const explanation = buildFaultExplanation(result, original);
    return explanation ? `${verdict} ${withFinalStop(explanation)}` : verdict;
}

/**
 * Lecture automatique après validation (spec 022) : le verdict seul pour une bonne réponse,
 * le verdict et l'explication après une erreur ou une réponse incomplète.
 * @param {{ isCorrect: boolean, question: { explication?: string }, trapFeedback?: any }} result
 * @param {{ choices?: any[], explication?: string } | null} [original] question d'origine (ordre du CSV)
 */
export function buildAutoFeedbackSpeech(result, original = null) {
    return result.isCorrect
        ? [t('quiz.voice.speech.correct'), ...buildTrapSpeech(result.trapFeedback)].join(' ')
        : buildFeedbackSpeech(result, original);
}

/**
 * @param {number[]} indexes
 * @param {{text: string}[]} [choices]
 */
export function describeSelection(indexes, choices = []) {
    if (!indexes.length) return t('quiz.voice.speech.cleared');
    // Avec le texte des réponses : « B, Vent latéral. D, Aucun vent » ; sinon « B, D ».
    const withText = indexes.some((i) => choices && choices[i] && choices[i].text);
    const spokenOptions = indexes.map((i) => {
        const letter = optionLetter(i);
        const text = choices && choices[i] ? choices[i].text : '';
        return text ? `${letter}, ${text}` : letter;
    });
    return t('quiz.voice.speech.selection', { letters: spokenOptions.join(withText ? '. ' : ', ') });
}

/** Minuscules, sans accents, apostrophes et ponctuation remplacées par des espaces. */
function normalizeRaw(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[’'`]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/** Normalisation incluant les homophones de suites de lettres. */
function normalize(text) {
    return normalizeRaw(text)
        .replace(/\baider\b/g, 'a d')
        .replace(/\bassez\b/g, 'a c')
        .replace(/\babaisser\b/g, 'a b c')
        .replace(/\bbaisser\b/g, 'b c')
        .replace(/\bceder\b/g, 'c d')
        .replace(/\bdeces\b/g, 'd c');
}

const COMMANDS = {
    yes: [
        'oui',
        'oui oui',
        'ouais',
        'euh oui',
        'yes',
        'ok',
        'okay',
        'daccord',
        'dacord',
        'coche',
        'cocher',
        'cochez',
        'je coche',
        'vrai',
        'exact',
        'positif',
        'affirmatif',
        'cest ca',
        'oui cest ca',
        'oui merci',
        'confirmer',
        'confirme',
        'je confirme',
    ],
    no: [
        'non',
        'non non',
        'nan',
        'no',
        'nom',
        'euh non',
        'non merci',
        'pas celle la',
        'pas celui la',
        'pas ca',
        'non pas celle la',
        'faux',
        'negatif',
        'passe',
        'passer',
        'passez',
        'je passe',
        'ignore',
        'ignorer',
        'ne pas cocher',
        'decoche',
        'decocher',
    ],
    validate: ['valider', 'valide', 'validez', 'validation', 'je valide'],
    next: ['suivante', 'suivant', 'question suivante', 'la suivante', 'suite'],
    prev: ['precedente', 'precedent', 'question precedente', 'la precedente', 'retour'],
    repeat: ['repete', 'repeter', 'repetez', 'relis', 'relire', 'lire', 'explication', 'explique', 'explique moi'],
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
const ECHO_WORDS = new Set([
    'reponse',
    'reponses',
    'selection',
    'cochee',
    'passee',
    'bonne',
    'mauvaise',
    'incomplete',
    'terminee',
    'dites',
]);
const PHONETIC_HACK_WORDS = new Set(['aider', 'assez', 'abaisser', 'baisser', 'ceder', 'deces']);
const FILLERS = new Set(['reponse', 'reponses', 'et', 'la', 'le', 'les', 'lettre', 'lettres']);

/**
 * Vrai si la phrase reprend des mots que l'application prononce (« Réponse A : … »,
 * « Sélection : … », ou des mots contenus dans le texte actuellement/récemment lu) :
 * pendant une lecture (et juste après), c'est sans doute l'écho de sa propre voix.
 * @param {string} transcript
 * @param {string} [spokenContext]
 * @param {{ speaking?: boolean }} [options]
 */
export function looksLikeEcho(transcript, spokenContext = '', { speaking = false } = {}) {
    const raw = normalizeRaw(transcript);
    if (!raw) return false;
    const rawWords = raw.split(' ');
    if (rawWords.some((w) => ECHO_WORDS.has(w))) return true;

    const spokenRaw = normalizeRaw(spokenContext);
    if (!spokenRaw) return false;
    const spokenWordSet = new Set(spokenRaw.split(' '));

    // Homophones (« aider », « céder », « baisser »…) ou mots de réponse (« oui », « non »)
    // entendus depuis le haut-parleur alors que l'app est littéralement en train de les lire.
    if (rawWords.length === 1) {
        const w = rawWords[0];
        if (PHONETIC_HACK_WORDS.has(w) && spokenWordSet.has(w)) return true;
        if (
            speaking &&
            (w in WEAK_LETTERS || w === 'oui' || w === 'non' || w === 'confirmer') &&
            spokenWordSet.has(w)
        ) {
            return true;
        }
        return false;
    }

    return ` ${spokenRaw} `.includes(` ${raw} `);
}

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
    // Un homophone (« dé », « c'est »…) compte comme lettre s'il forme toute la phrase, ou s'il
    // suit « et » (« A et dé ») : « c'est la B » reste ainsi « pas compris ».
    const afterEt = new Set(tokens.flatMap((w, i) => (i > 0 && tokens[i - 1] === 'et' ? [i] : [])));
    for (const [i, word] of tokens.entries()) {
        if (FILLERS.has(word)) continue;
        if (word in STRONG_LETTERS) {
            indexes.add(STRONG_LETTERS[word]);
        } else if (word in WEAK_LETTERS && (tokens.length === 1 || afterEt.has(i))) {
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
