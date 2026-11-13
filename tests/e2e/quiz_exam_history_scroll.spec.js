import { test, expect } from '@playwright/test';
import { grantBetaRole } from '../helpers/e2e_beta_role.js';

test.use({ serviceWorkers: 'block' });

function makeExams(count) {
    return Array.from({ length: count }, (_, i) => ({
        id: `exam_${i}`,
        date: Date.now() - i * 3600000,
        level: 'BP',
        score: 350,
        total: 360,
        questionsCorrect: 58,
        questionsTotal: 60,
        invalidated: false,
        results: [],
    }));
}

async function seedStatsAndExams(page, count) {
    await grantBetaRole(page);
    const exams = makeExams(count);
    await page.addInitScript((seededExams) => {
        localStorage.setItem(
            'parapente_gdpr_consent',
            JSON.stringify({
                stats: true,
                firebase: false,
                gps: false,
                version: 2026,
                date: new Date().toISOString(),
            }),
        );
        localStorage.setItem('userLevel', 'BP');
        localStorage.setItem('parapente_exam_history', JSON.stringify(seededExams));
    }, exams);
}

test('historique des examens : 4 colonnes desktop, 3 lignes visibles et aucune erreur ResizeObserver lors du redimensionnement', async ({
    page,
}) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.setViewportSize({ width: 1440, height: 900 });
    await seedStatsAndExams(page, 15);
    await page.goto('/?mode=STATS');

    const cards = page.locator('#stats-content [data-exam-id]');
    await expect(cards).toHaveCount(15);

    const desktopLayout = await page.evaluate(() => {
        const first = document.querySelector('#stats-content [data-exam-id]');
        const grid = first && first.parentElement;
        const cardEls = Array.from(grid.querySelectorAll(':scope > [data-exam-id]'));
        const firstRowTop = Math.round(cardEls[0].getBoundingClientRect().top);
        const cols = cardEls.filter(
            (el) => Math.abs(Math.round(el.getBoundingClientRect().top) - firstRowTop) <= 4,
        ).length;
        const gridRect = grid.getBoundingClientRect();
        const visibleRowsFully = cardEls.filter((el) => {
            const r = el.getBoundingClientRect();
            return r.top >= gridRect.top - 1 && r.bottom <= gridRect.bottom + 1;
        }).length;
        return {
            cols,
            visibleRowsFully,
            scrollable: grid.scrollHeight > grid.clientHeight + 1,
            hasClass: grid.classList.contains('exam-history-scrollable'),
            overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
    });

    expect(desktopLayout.cols).toBe(4);
    expect(desktopLayout.visibleRowsFully).toBe(12);
    expect(desktopLayout.scrollable).toBe(true);
    expect(desktopLayout.hasClass).toBe(true);
    expect(desktopLayout.overflowX).toBe(false);

    // Balayage de largeurs critique (bureau -> tablette -> mobile -> bureau) pour WebKit/Safari
    for (const width of [900, 768, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(80);
    }

    expect(pageErrors).toEqual([]);
    await expect(page.getByText('GLOBAL ERROR:')).toHaveCount(0);
});

test('historique des examens : aucune barre de défilement jusqu’à 3 lignes complètes', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.setViewportSize({ width: 1512, height: 900 });
    await seedStatsAndExams(page, 12);
    await page.goto('/?mode=STATS');

    const cards = page.locator('#stats-content [data-exam-id]');
    await expect(cards).toHaveCount(12);

    const layout = await page.evaluate(() => {
        const first = document.querySelector('#stats-content [data-exam-id]');
        const grid = first && first.parentElement;
        return {
            scrollable: grid.scrollHeight > grid.clientHeight + 1,
            hasClass: grid.classList.contains('exam-history-scrollable'),
            maxHeight: grid.style.maxHeight,
        };
    });

    expect(layout.scrollable).toBe(false);
    expect(layout.hasClass).toBe(false);
    expect(layout.maxHeight).toBe('none');
    expect(pageErrors).toEqual([]);
});
