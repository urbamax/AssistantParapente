#!/usr/bin/env node
/**
 * Spec 056 : sections Discord obligatoires dans la description d'une pull request.
 *
 * Chaque PR vers main dit ce qu'il faut annoncer dans #mises-a-jour (« ## Discord notice ») et ce
 * qu'il faut changer dans le guide #guide-utilisation (« ## Discord guide ») : un texte en français,
 * ou « None: <raison> ». Une session les publie ensuite en une fois, après le déploiement et avec
 * l'accord du propriétaire, avec son outillage Discord local (jamais versionné).
 *
 * Usage :
 *   node scripts/pr_discord_sections.mjs --check <fichier d'événement GitHub>   (CI)
 *   node scripts/pr_discord_sections.mjs --extract < corps.md                   (outil local : JSON)
 *
 * Le corps de la PR est lu dans le fichier d'événement, jamais passé par la ligne de commande.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SECTIONS = Object.freeze(['Discord notice', 'Discord guide']);

/** Taille maximale d'un message Discord. */
export const DISCORD_MESSAGE_LIMIT = 2000;

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Contenu d'une section « ## <name> » jusqu'à la fin de la section, sans commentaires HTML.
 * @param {string | null | undefined} body
 * @param {string} name
 * @returns {string | null} null si le titre est absent
 */
export function readSection(body, name) {
    if (!body) return null;
    const lines = String(body).replace(/\r\n?/g, '\n').split('\n');
    const heading = new RegExp(`^##\\s+${escapeRegExp(name)}\\s*$`, 'i');
    const start = lines.findIndex((line) => heading.test(line.trim()));
    if (start === -1) return null;
    const rest = lines.slice(start + 1);
    // Fin de la section : titre suivant, ligne horizontale, ou la mention « 🤖 Generated with … ».
    const end = rest.findIndex((line) => /^#{1,2}\s/.test(line) || /^\s*(-{3,}|🤖)/u.test(line));
    const content = (end === -1 ? rest : rest.slice(0, end)).join('\n');
    return stripHtmlComments(content).trim();
}

/**
 * Retire les commentaires HTML, y compris un commentaire jamais fermé (jusqu'à la fin). Répété jusqu'à
 * ce que le texte ne change plus : un retrait peut recoller un nouveau « <!-- » (ex. « <<!-- a -->!-- »).
 * @param {string} text
 * @returns {string}
 */
function stripHtmlComments(text) {
    let previous;
    let out = text;
    do {
        previous = out;
        let result = '';
        let i = 0;
        for (;;) {
            const start = out.indexOf('<!--', i);
            if (start === -1) {
                result += out.slice(i);
                break;
            }
            result += out.slice(i, start);
            const end = out.indexOf('-->', start + 4);
            if (end === -1) break;
            i = end + 3;
        }
        out = result;
    } while (out !== previous);
    return out;
}

/** « None: raison » / « Aucune : raison » ; renvoie la raison, '' sans raison, null sinon. */
function noneReason(text) {
    const m = /^(none|aucune?)\b\s*[:—–-]?\s*(.*)$/is.exec(text);
    return m ? m[2].trim() : null;
}

/**
 * Vérifie les deux sections Discord d'une description de PR.
 * @param {string | null | undefined} body
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function checkPrBody(body) {
    const errors = [];
    for (const name of SECTIONS) {
        const content = readSection(body, name);
        if (content === null) {
            errors.push(`Section « ## ${name} » absente.`);
            continue;
        }
        if (content === '') {
            errors.push(`Section « ## ${name} » vide : écrivez le texte en français, ou « None: <raison> ».`);
            continue;
        }
        const reason = noneReason(content);
        if (reason !== null && reason.length < 3) {
            errors.push(`Section « ## ${name} » : « None » doit être suivi d'une raison (« None: <raison> »).`);
            continue;
        }
        if (name === 'Discord notice' && reason === null && content.length > DISCORD_MESSAGE_LIMIT) {
            errors.push(
                `Section « ## Discord notice » : ${content.length} caractères, un message Discord en accepte ${DISCORD_MESSAGE_LIMIT}.`,
            );
        }
    }
    return { ok: errors.length === 0, errors };
}

/**
 * Notice et changement de guide d'une PR, pour l'outil local de publication.
 * @param {string} body
 * @returns {{ notice: string | null, guide: string | null }} null : rien à publier (« None » ou absent)
 */
export function extractSections(body) {
    const pick = (name) => {
        const content = readSection(body, name);
        if (!content || noneReason(content) !== null) return null;
        return content;
    };
    return { notice: pick('Discord notice'), guide: pick('Discord guide') };
}

function main(argv) {
    const [mode, file] = argv;
    if (mode === '--check') {
        const event = JSON.parse(readFileSync(file, 'utf8'));
        const pr = event.pull_request || {};
        if (pr.user?.type === 'Bot') {
            console.log('PR ouverte par un robot : sections Discord non exigées.');
            return 0;
        }
        const { ok, errors } = checkPrBody(pr.body);
        if (ok) {
            console.log('Sections Discord présentes (## Discord notice, ## Discord guide).');
            return 0;
        }
        for (const e of errors) console.log(`::error::${e}`);
        console.log(
            'Ajoutez à la description de la PR « ## Discord notice » (annonce pour #mises-a-jour) et ' +
                '« ## Discord guide » (changement de #guide-utilisation), chacune avec un texte en français ' +
                'ou « None: <raison> » (constitution, Development Workflow ; spec 056).',
        );
        return 1;
    }
    if (mode === '--extract') {
        const body = readFileSync(0, 'utf8');
        console.log(JSON.stringify(extractSections(body)));
        return 0;
    }
    console.error('Usage : --check <event.json> | --extract < body.md');
    return 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
    process.exitCode = main(process.argv.slice(2));
}
