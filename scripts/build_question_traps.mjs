#!/usr/bin/env node
/**
 * Spec 061 : fabrique js/data/qcm_question_traps.json, les phrases de l'encart « À lire de près »
 * affiché dans la correction du QCM.
 *
 * Entrée : le fichier de l'audit 6 (hors dépôt), { code: [{ element, ou, choix, encart }] }.
 * Sortie : { code: [phrase, …] }, clés triées, seules les phrases destinées à l'élève.
 * Les codes de delta (H, R, X) sont écartés, comme dans le QCM. Chaque phrase est contrôlée avec
 * les mêmes règles que tests/data/quiz_question_traps.test.js ; la moindre faute arrête le script.
 *
 *   node scripts/build_question_traps.mjs <fichier de l'audit>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'js/data/qcm_question_traps.json');

const VERDICT =
    /\b(?:justes?|faux|fausses?|vraie?s?|correcte?s?|exacte?s?|inexacte?s?|pi[eè]ges?)\b|bonne réponse|à tort/i;
const ADDRESS = /\b(?:tu|toi|ton|ta|tes|vous|votre|vos)\b|\b(?:repérez|regardez|regarde|repère|demandez|lisez|lis)\b/i;

/** Raison pour laquelle une phrase est refusée, ou null si elle convient. */
export function sentenceProblem(s) {
    if (typeof s !== 'string' || !s.trim()) return 'vide';
    if (s !== s.trim()) return 'espaces en bord';
    if (!s.endsWith('.')) return 'pas de point final';
    if (s.length >= 240) return 'trop longue';
    if (VERDICT.test(s)) return 'mot de verdict';
    if (ADDRESS.test(s)) return "adresse à l'élève";
    if (s.includes(';')) return 'point-virgule';
    if (s.includes('"')) return 'guillemet droit';
    return null;
}

function main() {
    const src = process.argv[2];
    if (!src) {
        console.error('Usage : node scripts/build_question_traps.mjs <fichier de l’audit>');
        process.exit(2);
    }
    const audit = JSON.parse(readFileSync(src, 'utf8'));
    const out = {};
    const problems = [];
    for (const code of Object.keys(audit).sort()) {
        if (/^[HRX]/.test(code)) continue;
        const sentences = (audit[code] || []).map((p) => p.encart);
        if (!sentences.length) continue;
        if (sentences.length > 3) problems.push(`${code} : plus de 3 phrases`);
        sentences.forEach((s, i) => {
            const why = sentenceProblem(s);
            if (why) problems.push(`${code} #${i + 1} : ${why} (${s})`);
        });
        out[code] = sentences;
    }
    if (problems.length) {
        console.error(problems.join('\n'));
        process.exit(1);
    }
    writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
    const n = Object.values(out).reduce((a, v) => a + v.length, 0);
    console.log(`${Object.keys(out).length} questions, ${n} phrases → js/data/qcm_question_traps.json`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
