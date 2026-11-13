import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'happy-dom',
        setupFiles: ['./tests/setupTests.js'],
        globals: true,
        // Le délai par défaut (5 s) est trop juste quand la suite complète tourne sur une machine chargée
        // (vérification du pré-push, CI) : des tests sans rapport entre eux le dépassent au hasard et bloquent
        // l'envoi. Le délai ne sert qu'à arrêter un test qui ne finit jamais, 30 s y suffisent.
        testTimeout: 30_000,
        hookTimeout: 30_000,
        // .claude/ : copies de travail des autres sessions (worktrees), jamais les tests de ce dépôt.
        // tests/firestore_rules : exigent l'émulateur Firestore, voir vitest.rules.config.js (npm run test:rules).
        exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**', '**/tests/firestore_rules/**', '.claude/**'],
        // npm run test:coverage : résumé dans le terminal et rapport détaillé dans coverage/index.html
        // (fichiers du code de l'application seulement : ni les données, ni la configuration Firebase).
        coverage: {
            provider: 'v8',
            include: ['js/**/*.js'],
            exclude: ['js/data/**', 'js/firebase_config.js'],
            reporter: ['text-summary', 'html'],
        },
    },
});
