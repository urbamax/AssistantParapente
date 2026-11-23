#!/usr/bin/env node
/**
 * Spec 064 : fabrique js/data/qcm_trap_types.json, le type de chaque piège du QCM et les choix qu'il
 * touche (positions dans les choix du CSV officiel), pour la section « Vos pièges » des statistiques.
 *
 * Entrées (hors dépôt) : le dossier de sortie de l'audit 6 (audit_out_K.json : pieges[].choix_touches)
 * et le classement des pièges ({ "CODE#rang": type }).
 *
 *   node scripts/build_trap_types.mjs <dossier audit6/out> <types.json>
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'js/data/qcm_trap_types.json');
export const TRAP_TYPES = Object.freeze([
    'absolu',
    'un_mot',
    'cadre',
    'inversion',
    'vrai_hors_sujet',
    'valeur',
    'autre',
]);

function main() {
    const [dir, typesFile] = process.argv.slice(2);
    if (!dir || !typesFile) {
        console.error('Usage : node scripts/build_trap_types.mjs <dossier audit6/out> <types.json>');
        process.exit(2);
    }
    const types = JSON.parse(readFileSync(typesFile, 'utf8'));
    const out = {};
    const problems = [];
    const files = readdirSync(dir).filter((f) => /^audit_out_\d+\.json$/.test(f));
    for (const f of files) {
        for (const entry of JSON.parse(readFileSync(join(dir, f), 'utf8'))) {
            if (/^[HRX]/.test(entry.code) || !entry.pieges?.length) continue;
            out[entry.code] = entry.pieges.map((p, i) => {
                const type = types[`${entry.code}#${i}`];
                if (!TRAP_TYPES.includes(type)) problems.push(`${entry.code}#${i} : type inconnu (${type})`);
                const choices = [...new Set(p.choix_touches || [])].filter(Number.isInteger).sort((a, b) => a - b);
                if (!choices.length) problems.push(`${entry.code}#${i} : aucun choix touché`);
                return { type, choices };
            });
        }
    }
    if (problems.length) {
        console.error(problems.join('\n'));
        process.exit(1);
    }
    const sorted = Object.fromEntries(
        Object.keys(out)
            .sort()
            .map((k) => [k, out[k]]),
    );
    writeFileSync(OUT, JSON.stringify(sorted, null, 2) + '\n');
    const n = Object.values(sorted).reduce((a, v) => a + v.length, 0);
    console.log(`${Object.keys(sorted).length} questions, ${n} pièges → js/data/qcm_trap_types.json`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
