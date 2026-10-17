// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Chaque sous-collection de users/{uid} lue ou écrite par l'application doit être autorisée par
// firestore.rules (refus par défaut pour le reste) : sinon la synchronisation casse en production
// sans que rien ne le signale avant. Le comportement exact des règles est testé par
// npm run test:rules (émulateur).
// Tous les fichiers du client qui parlent à Firestore (la synchro, et la synchro des traces de vol).
const CLIENT = ['js/services/firebase_service.js', 'js/services/flight_trace_sync.js']
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
const RULES = readFileSync('firestore.rules', 'utf8');

const usedSubcollections = [...CLIENT.matchAll(/(?:doc|collection)\(\s*db,\s*'users',\s*[\w.]+,\s*'(\w+)'/g)].map(
    (m) => m[1],
);
// `databases` et `users` sont des niveaux racines, pas des sous-collections.
const allowedSubcollections = [...RULES.matchAll(/match \/(\w+)\/\{\w+\}/g)]
    .map((m) => m[1])
    .filter((name) => !['databases', 'users'].includes(name));

describe("firestore.rules couvre les chemins utilisés par l'application", () => {
    it('le code utilise bien des sous-collections (le motif de recherche fonctionne)', () => {
        expect(new Set(usedSubcollections)).toEqual(
            new Set(['logbook', 'equipment', 'stats', 'preferences', 'igcTraces']),
        );
    });

    it.each([...new Set(usedSubcollections)])('autorise la sous-collection %s', (name) => {
        expect(allowedSubcollections).toContain(name);
    });

    it("n'autorise aucune sous-collection que l'application n'utilise pas", () => {
        const unused = allowedSubcollections.filter((name) => !usedSubcollections.includes(name));
        expect(unused).toEqual([]);
    });

    it('ne contient aucune règle ouverte', () => {
        expect(RULES).not.toMatch(/if\s+true/);
        expect(RULES).not.toMatch(/\{document=\*\*\}/);
    });
});
