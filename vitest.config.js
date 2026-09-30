import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'happy-dom',
        setupFiles: ['./tests/setupTests.js'],
        globals: true,
        // .claude/ : copies de travail des autres sessions (worktrees), jamais les tests de ce dépôt.
        exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**', '.claude/**'],
    },
});
