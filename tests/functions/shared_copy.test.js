// @vitest-environment node
// Code serveur (Cloud Function) : environnement Node, pas de DOM simulé.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSharedFiles, SITES_DATA_SOURCE, SITES_DATA_TARGET } from '../../scripts/sync_functions_shared.mjs';

// Spec 001, US4 (FR-011/FR-012) : le serveur de notifications utilise une COPIE générée du
// calcul météo. Ce test échoue dès qu'une copie diffère de sa source : lancer
// `npm run sync:functions` puis enregistrer les fichiers régénérés.
const root = fileURLToPath(new URL('../../', import.meta.url));

describe('functions/ shared copies are in sync with their sources', () => {
    it.each(Object.entries(buildSharedFiles()))('%s matches its source', (target, expected) => {
        expect(readFileSync(root + target, 'utf8')).toBe(expected);
    });

    it('functions/sites_data.json matches js/data/sites_data.json', () => {
        expect(readFileSync(root + SITES_DATA_TARGET, 'utf8')).toBe(readFileSync(root + SITES_DATA_SOURCE, 'utf8'));
    });

    it('copies the scoring and everything it imports', () => {
        expect(Object.keys(buildSharedFiles()).sort()).toEqual([
            'functions/shared/fr.mjs',
            'functions/shared/geo_utils.mjs',
            'functions/shared/i18n.mjs',
            'functions/shared/weatherScoring.mjs',
        ]);
    });
});
