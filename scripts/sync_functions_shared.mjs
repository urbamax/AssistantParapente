#!/usr/bin/env node
/**
 * Copie dans functions/ le code partagé avec la Cloud Function de notifications (spec 001,
 * US4) : Firebase ne déploie QUE le dossier functions/, qui ne peut donc pas importer js/.
 *
 * - js/weatherScoring.js et ses imports → functions/shared/*.mjs (chemins d'import réécrits)
 * - js/data/sites_data.json → functions/sites_data.json
 *
 * Lancé automatiquement avant `firebase deploy` (predeploy, firebase.json) et à la main via
 * `npm run sync:functions`. tests/functions/shared_copy.test.js échoue si une copie diverge.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

/** Source (relative à la racine) → nom du fichier copié dans functions/shared/. */
const SHARED_MODULES = {
    'js/weatherScoring.js': 'weatherScoring.mjs',
    'js/utils/geo_utils.js': 'geo_utils.mjs',
    'js/utils/i18n.js': 'i18n.mjs',
    'js/i18n/fr.js': 'fr.mjs',
};

/** Import relatif tel qu'écrit dans chaque source → nom plat dans functions/shared/. */
const IMPORT_REWRITES = {
    './utils/geo_utils.js': './geo_utils.mjs',
    './utils/i18n.js': './i18n.mjs',
    '../i18n/fr.js': './fr.mjs',
};

export const SITES_DATA_SOURCE = 'js/data/sites_data.json';
export const SITES_DATA_TARGET = 'functions/sites_data.json';

const HEADER = (source) =>
    `// GÉNÉRÉ — ne pas modifier. Copie de ${source}, régénérée par scripts/sync_functions_shared.mjs.\n`;

function rewriteImports(code, source) {
    return code.replace(/from '(\.{1,2}\/[^']+)'/g, (match, specifier) => {
        const target = IMPORT_REWRITES[specifier];
        if (!target) throw new Error(`${source} : import « ${specifier} » non prévu dans IMPORT_REWRITES`);
        return `from '${target}'`;
    });
}

/**
 * Contenu attendu de chaque fichier partagé, sans rien écrire (utilisé par le test de dérive).
 * @returns {Record<string, string>} chemin cible (relatif à la racine) → contenu
 */
export function buildSharedFiles() {
    const files = {};
    for (const [source, targetName] of Object.entries(SHARED_MODULES)) {
        const code = readFileSync(ROOT + source, 'utf8');
        files[`functions/shared/${targetName}`] = HEADER(source) + rewriteImports(code, source);
    }
    return files;
}

function main() {
    for (const [target, content] of Object.entries(buildSharedFiles())) {
        mkdirSync(dirname(ROOT + target), { recursive: true });
        writeFileSync(ROOT + target, content);
        console.log(`écrit : ${target}`);
    }
    writeFileSync(ROOT + SITES_DATA_TARGET, readFileSync(ROOT + SITES_DATA_SOURCE, 'utf8'));
    console.log(`écrit : ${SITES_DATA_TARGET}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
