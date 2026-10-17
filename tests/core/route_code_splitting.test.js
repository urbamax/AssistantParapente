// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Les écrans sont chargés à la demande (un fichier chacun dans le build). Un seul import statique d'une
// vue depuis le cœur ou un service la remet dans le fichier de démarrage : le gain disparaît en silence.
const VIEWS = ['quiz', 'logbook', 'sites', 'manual', 'welcome', 'safety'];
const read = (file) => readFileSync(file, 'utf8');

function jsFiles(dir) {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return name === 'data' ? [] : jsFiles(path);
        return name.endsWith('.js') ? [path] : [];
    });
}

describe('chargement à la demande des écrans', () => {
    it('main.js déclare chaque écran en import() dynamique, jamais en import statique', () => {
        const main = read('js/core/main.js');
        for (const view of VIEWS) {
            expect(main, view).toContain(`import('../views/${view}.js')`);
            expect(main, view).not.toMatch(new RegExp(`^import .* from '../views/${view}\\.js'`, 'm'));
        }
    });

    it('aucun module hors de js/views n’importe une vue statiquement', () => {
        const offenders = jsFiles('js')
            .filter((file) => !file.startsWith(join('js', 'views')))
            .filter((file) => /^import .* from '(\.\.?\/)+(\.\.\/)?views\/[^']+'/m.test(read(file)));
        expect(offenders).toEqual([]);
    });

    it('le champ d’import IGC global copie sa liste de fichiers avant d’appeler le carnet (liste vivante)', () => {
        const main = read('js/core/main.js');
        const handler = main.slice(main.indexOf("getElementById('global-igc-input')"));
        const beforeCall = handler.slice(0, handler.indexOf('LogbookView._processFiles('));
        expect(beforeCall).toContain('Array.from(');
        // et ne passe jamais la liste vivante telle quelle
        expect(beforeCall).not.toMatch(/const files = \/\*\* @type \{HTMLInputElement\} \*\/ \(e\.target\)\.files;/);
    });

    it('les routes enregistrent des écrans à la demande, partagés pour QCM, QCM_BANK et STATS', () => {
        const main = read('js/core/main.js');
        for (const mode of ['QCM', 'QCM_BANK', 'STATS']) {
            expect(main).toContain(`AppRouter.register('${mode}', quizModule)`);
        }
        for (const [mode, module] of [
            ['LOGBOOK', 'logbookModule'],
            ['SITES', 'sitesModule'],
            ['LIBRARY', 'libraryModule'],
            ['WELCOME', 'welcomeModule'],
            ['SAFETY', 'safetyModule'],
        ]) {
            expect(main).toContain(`AppRouter.register('${mode}', ${module})`);
        }
    });
});

describe('visualiseur 3D du carnet', () => {
    it("n'est pas importé statiquement par le carnet : il se télécharge au clic sur « Voir la trace »", () => {
        const source = readFileSync('js/views/logbook_history.js', 'utf8');
        expect(source).not.toMatch(/^import .*map_3d\.js/m);
        expect(source).toMatch(/import\('\.\.\/components\/map_3d\.js'\)/);
    });
});

describe('prévisions du service des sites', () => {
    it('les méthodes réseau sont dans un fichier téléchargé au premier besoin, pas dans le démarrage', () => {
        const service = readFileSync('js/services/sites_service.js', 'utf8');
        expect(service).not.toMatch(/^import .*sites_forecast_fetch\.js/m);
        expect(service).toMatch(/import\('\.\/sites_forecast_fetch\.js'\)/);
        expect(service).not.toMatch(/api\.open-meteo\.com/);
    });
});
