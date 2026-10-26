/**
 * Clics et défilements qui ne restent pas bloqués sur la « stabilité » de l'élément.
 *
 * Avant un clic ou un `scrollIntoViewIfNeeded`, Playwright attend que l'élément soit stable : sa
 * position doit être la même sur deux images d'animation de suite. Sur la CI (WebKit sous Linux, sans
 * écran), le rendu s'arrête parfois : le DOM est complet mais plus aucune image n'est produite, et
 * l'attente dure jusqu'au délai de 30 s sans jamais réessayer (« waiting for element to be visible,
 * enabled and stable »). Les traces des échecs montrent une page Sites entièrement montée, un bouton
 * présent et visible, une capture d'écran vide.
 *
 * Le clic normal est donc tenté d'abord, mais seulement pendant `STABLE_TIMEOUT` : c'est lui qui laisse
 * à l'application le temps de finir son démarrage (un clic forcé tout de suite partirait avant que les
 * écouteurs soient posés). S'il reste bloqué, la visibilité est contrôlée par sondage, qui ne dépend pas
 * des images d'animation, puis l'action est faite sans attendre la stabilité.
 */
import { expect } from '@playwright/test';

// Assez long pour un rendu lent mais sain, bien en dessous du délai d'un test (30 s)
const STABLE_TIMEOUT = 5_000;
// Autant que l'attente d'un clic ordinaire : un élément lent à apparaître reste toléré
const VISIBLE_TIMEOUT = 30_000;

/** Vrai si l'erreur est un dépassement de délai Playwright (et non, par exemple, un élément introuvable). */
const timedOut = (error) =>
    error instanceof Error && (error.name === 'TimeoutError' || /Timeout [\d.]+ms exceeded/i.test(error.message));

/** @param {import('@playwright/test').Locator} locator */
export async function clickWhenVisible(locator) {
    try {
        await locator.click({ timeout: STABLE_TIMEOUT });
    } catch (error) {
        if (!timedOut(error)) throw error;
        await expect(locator).toBeVisible({ timeout: VISIBLE_TIMEOUT });
        await locator.click({ force: true });
    }
}

/** @param {import('@playwright/test').Locator} locator */
export async function scrollIntoViewWhenVisible(locator) {
    try {
        await locator.scrollIntoViewIfNeeded({ timeout: STABLE_TIMEOUT });
    } catch (error) {
        if (!timedOut(error)) throw error;
        await expect(locator).toBeVisible({ timeout: VISIBLE_TIMEOUT });
        await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    }
}
