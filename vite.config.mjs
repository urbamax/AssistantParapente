import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Le code source reste servable tel quel (python3 -m http.server) : Vite ne sert qu'à produire
// dist/ (fichiers hachés, minifiés, sw.js versionné). Voir DOCUMENTATION.md.

// Fichiers chargés à l'exécution par chemin relatif (fetch, <img>, PDF...) ou par importScripts :
// Vite ne les voit pas dans le graphe d'imports, on les recopie à l'identique dans dist/.
const STATIC_PATHS = [
    'components',
    'courses',
    'img',
    // Bibliothèques et polices hébergées (spec 009) ; leaflet.js est un script classique copié tel quel.
    'vendor',
    'manifest.json',
    'js/firebase_config.js',
    'js/data/sites_data.json',
    'js/data/qcm_ffvl.csv',
    'js/data/qcm_ffvl_explanations.csv',
    'js/data/question_course_mapping.json',
];

// Ne sont pas mis en pré-cache par le service worker (trop lourds / ouverts à la demande).
const NOT_PRECACHED = ['courses'];

function listFiles(dir) {
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        return statSync(full).isDirectory() ? listFiles(full) : [full];
    });
}

function staticAndServiceWorker() {
    let outDir;
    let root;
    return {
        name: 'static-and-service-worker',
        apply: 'build',
        // Vite hache et déplace manifest.json dans assets/, ce qui casse les chemins relatifs de
        // ses icônes : on garde le manifest d'origine, recopié à la racine (voir STATIC_PATHS).
        enforce: 'post',
        generateBundle(_options, bundle) {
            for (const [name, file] of Object.entries(bundle)) {
                if (/^assets\/manifest-.*\.json$/.test(name)) delete bundle[name];
                if (name === 'index.html') {
                    file.source = file.source.replace(
                        /href="[^"]*assets\/manifest-[^"]+\.json"/,
                        'href="manifest.json"',
                    );
                }
            }
        },
        configResolved(config) {
            outDir = join(config.root, config.build.outDir);
            root = config.root;
        },
        closeBundle() {
            const copied = [];
            for (const path of STATIC_PATHS) {
                const source = join(root, path);
                if (!existsSync(source)) continue;
                const target = join(outDir, path);
                mkdirSync(join(target, '..'), { recursive: true });
                cpSync(source, target, { recursive: true });
                copied.push(...(statSync(source).isDirectory() ? listFiles(source) : [source]));
            }

            // Pré-cache = tout ce que le build a émis + les fichiers statiques critiques.
            const toUrl = (file) => './' + relative(outDir, file).split(sep).join('/');
            const emitted = listFiles(outDir)
                .filter((file) => !file.endsWith('sw.js'))
                .map(toUrl)
                .filter((url) => !NOT_PRECACHED.some((dir) => url.startsWith(`./${dir}/`)));
            const assets = ['./', ...emitted.sort()];

            // Nom de cache dérivé du contenu : chaque build différent invalide l'ancien cache.
            const hash = createHash('sha256');
            for (const url of assets.slice(1)) hash.update(url);
            const version = hash.digest('hex').slice(0, 10);

            let sw = readFileSync(join(root, 'sw.js'), 'utf8');
            sw = sw.replace(/const CACHE_NAME = '[^']*';/, `const CACHE_NAME = 'parapente-app-v${version}';`);
            sw = sw.replace(
                /const CRITICAL_ASSETS = \[[\s\S]*?\];/,
                `const CRITICAL_ASSETS = ${JSON.stringify(assets, null, 4)};`,
            );
            writeFileSync(join(outDir, 'sw.js'), sw);
            console.log(`[sw] ${assets.length} fichiers pré-cachés, cache parapente-app-v${version}`);
        },
    };
}

export default defineConfig({
    base: './',
    plugins: [staticAndServiceWorker()],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            // Garde-fou : une adresse absolue importée n'est jamais regroupée dans le build.
            // Le SDK Firebase est hébergé dans vendor/ (spec 013), recopié tel quel (STATIC_PATHS).
            external: [/^https:\/\//],
        },
    },
});
