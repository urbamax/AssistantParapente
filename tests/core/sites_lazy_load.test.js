// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Le catalogue des sites pèse ≈ 3 Mo : il ne doit pas être téléchargé et analysé au démarrage
// pour quelqu'un qui ne vient que réviser le QCM. Chaque écran qui s'en sert l'attend lui-même.
describe('chargement différé du catalogue des sites', () => {
    it('main.js ne le charge pas au démarrage', () => {
        expect(readFileSync('js/core/main.js', 'utf8')).not.toContain('ensureSitesLoaded()');
    });

    it.each(['js/views/sites.js', 'js/views/logbook.js'])("%s l'attend dans mount()", (file) => {
        expect(readFileSync(file, 'utf8')).toContain('await SitesService.ensureSitesLoaded()');
    });
});
