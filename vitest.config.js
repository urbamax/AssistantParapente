import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'happy-dom',
        setupFiles: ['./tests/setupTests.js'],
        globals: true,
        // .claude/ : copies de travail des autres sessions (worktrees), jamais les tests de ce dépôt.
        exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**', '.claude/**'],
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
