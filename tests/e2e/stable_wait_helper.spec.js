import { test, expect } from '@playwright/test';
import { clickWhenVisible, scrollIntoViewWhenVisible } from '../helpers/e2e_stable_wait.js';

// Un élément qui bouge à chaque image n'est jamais « stable » pour Playwright : c'est ce que subit un clic
// quand le rendu de WebKit s'arrête sur la CI (voir tests/helpers/e2e_stable_wait.js).
const MOVING_PAGE = `
    <style>body { margin: 0; height: 3000px; } #b { position: absolute; top: 2000px; left: 0; width: 120px; height: 40px; }</style>
    <button id="b">Cliquer</button>
    <script>
        window.clicks = 0;
        const b = document.getElementById('b');
        b.addEventListener('click', () => window.clicks++);
        let x = 0;
        (function move() { b.style.left = (x++ % 200) + 'px'; requestAnimationFrame(move); })();
    </script>`;

test.describe('clics qui ne se bloquent pas sur la stabilité', () => {
    test.beforeEach(async ({ page }) => {
        await page.setContent(MOVING_PAGE);
    });

    test('un clic ordinaire attend en vain un élément qui bouge toujours', async ({ page }) => {
        await expect(page.locator('#b').click({ timeout: 1500 })).rejects.toThrow(/Timeout/);
        expect(await page.evaluate(() => window.clicks)).toBe(0);
    });

    test('clickWhenVisible finit par cliquer sur un élément visible qui ne se stabilise pas', async ({ page }) => {
        await clickWhenVisible(page.locator('#b'));
        expect(await page.evaluate(() => window.clicks)).toBe(1);
    });

    test('scrollIntoViewWhenVisible amène à l’écran un élément qui bouge toujours', async ({ page }) => {
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
        await scrollIntoViewWhenVisible(page.locator('#b'));
        expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
    });
});
