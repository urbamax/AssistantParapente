import { defineConfig } from 'vitest/config';

// Tests des règles Firestore : exigent l'émulateur (npm run test:rules), donc hors de `npm test`.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/firestore_rules/**/*.test.js'],
        // Les écritures de l'émulateur sont séquentielles : un seul fichier à la fois.
        fileParallelism: false,
    },
});
