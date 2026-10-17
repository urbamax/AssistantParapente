import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    // En CI : annotations GitHub + rapport HTML téléversé en cas d'échec (spec 006).
    reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
    use: {
        baseURL: 'http://localhost:8080',
        trace: 'on-first-retry',
        // Les transitions de vue et animations de la page ne servent à rien dans un test et, sur WebKit en CI,
        // gardaient parfois un bouton « instable » jusqu'au délai de 30 s (clics qui n'aboutissent pas).
        reducedMotion: 'reduce',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
    ],
    webServer: {
        command: 'npx http-server . -p 8080',
        url: 'http://localhost:8080',
        reuseExistingServer: !process.env.CI,
    },
});
