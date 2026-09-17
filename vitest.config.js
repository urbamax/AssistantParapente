import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'happy-dom',
        setupFiles: ['./tests/setupTests.js'],
        globals: true,
        exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**'],
    },
});
