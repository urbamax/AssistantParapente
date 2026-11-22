import { test, expect } from '@playwright/test';
import { disableBackdropBlur } from '../helpers/e2e_no_backdrop_blur.js';

// Suppression du compte depuis l'Espace Synchro (spec 059). Pas de vrai Firebase en e2e : le pilote est
// « connecté » en remplaçant les SDK Auth et Firestore du moteur par des faux en mémoire.

const CONSENT = { stats: true, firebase: false, gps: false, version: 2026, date: '2026-10-01T00:00:00.000Z' };
const FLIGHT = { id: 'vol-1', datetime: '2026-09-01T10:00:00Z', site: 'Annecy', updatedAt: 1000 };

test.describe('Supprimer mon compte', () => {
    test.beforeEach(async ({ page }) => {
        await disableBackdropBlur(page);
        await page.addInitScript(
            ({ consent, flight }) => {
                localStorage.clear();
                localStorage.setItem('parapente_gdpr_consent', JSON.stringify(consent));
                localStorage.setItem('tp_logbook_data', JSON.stringify([flight]));
            },
            { consent: CONSENT, flight: FLIGHT },
        );
        await page.goto('/?mode=SITES');
        await page.waitForFunction(() => Boolean(window.FirebaseAuthEngine));
        await page.evaluate(() => {
            const engine = window.FirebaseAuthEngine;
            const docs = new Map(
                Object.entries({
                    'users/u1': { fcmToken: 'jeton' },
                    'users/u1/logbook/vol-1': { id: 'vol-1' },
                    'users/u1/igcTraces/vol-1_0': { flightId: 'vol-1', index: 0 },
                    'users/u1/equipment/e1': { id: 'e1' },
                    'users/u1/stats/qcm_stats': { total: 1 },
                    'users/u1/preferences/user_prefs': {},
                    'users/u1/ice/profile': { updatedAt: 1 },
                    'users/u1/access/profile': { roles: [] },
                    'users/u1/pushState/favoriteSitesFlyable': {},
                }),
            );
            const ref = (_db, ...segments) => ({ path: segments.join('/') });
            window.__fakeDocs = docs;
            engine._loadFirestore = async () => ({
                doc: ref,
                collection: ref,
                deleteDoc: async (r) => void docs.delete(r.path),
                getDocs: async (col) => {
                    const prefix = `${col.path}/`;
                    const snaps = [...docs.keys()]
                        .filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
                        .map((p) => ({ id: p.slice(prefix.length), ref: { path: p }, data: () => docs.get(p) }));
                    return { docs: snaps, size: snaps.length, forEach: (cb) => snaps.forEach(cb) };
                },
            });
            engine._loadAuth = async () => ({
                EmailAuthProvider: { credential: (email, password) => ({ email, password }) },
                reauthenticateWithCredential: async (_user, cred) => {
                    if (cred.password !== 'bon-mot-de-passe') {
                        throw Object.assign(new Error('wrong'), { code: 'auth/wrong-password' });
                    }
                },
                // Le vrai SDK déconnecte, et onAuthStateChanged remet currentUser à null.
                deleteUser: async () => {
                    engine.currentUser = null;
                },
            });
            engine.enabled = true;
            engine.currentUser = { uid: 'u1', email: 'pilote@example.test' };
        });
        await page.locator('[data-action="FirebaseAuthopenAuthModal"]:visible').first().click();
        await expect(page.locator('#auth-logged-in-view')).toBeVisible();
    });

    const remaining = (page) => page.evaluate(() => [...window.__fakeDocs.keys()]);

    test('le panneau explique ce qui est supprimé ; Annuler ne supprime rien', async ({ page }) => {
        const panel = page.locator('#auth-delete-account-panel');
        await expect(panel).toBeHidden();
        await page.locator('#auth-delete-account-open').click();
        await expect(panel).toBeVisible();
        await expect(panel).toContainText("C'est définitif");
        await expect(panel).toContainText('cet appareil');
        await expect(page.locator('#delete-account-password')).toBeFocused();
        await panel.getByRole('button', { name: 'Annuler' }).click();
        await expect(panel).toBeHidden();
        await expect(page.locator('#auth-delete-account-open')).toBeVisible();
        expect(await remaining(page)).toHaveLength(9);
    });

    test('un mot de passe faux ne supprime rien et propose de réessayer', async ({ page }) => {
        await page.locator('#auth-delete-account-open').click();
        await page.locator('#delete-account-password').fill('faux');
        await page.locator('#delete-account-confirm').click();
        await expect(page.locator('#delete-account-error')).toContainText('Mot de passe incorrect');
        await expect(page.locator('#delete-account-confirm')).toHaveText(/Réessayer la suppression/);
        expect(await remaining(page)).toHaveLength(9);
    });

    test('avec le bon mot de passe : tout est supprimé en ligne, le pilote est déconnecté, le carnet local reste', async ({
        page,
    }) => {
        await page.locator('#auth-delete-account-open').click();
        await page.locator('#delete-account-confirm').click();
        await expect(page.locator('#delete-account-error')).toContainText('Saisissez votre mot de passe');
        await page.locator('#delete-account-password').fill('bon-mot-de-passe');
        await page.locator('#delete-account-confirm').click();
        await expect(page.locator('#auth-alert')).toContainText('ont été supprimés');
        await expect(page.locator('#auth-logged-in-view')).toBeHidden();
        expect(await remaining(page)).toEqual([]);
        const logbook = await page.evaluate(() => JSON.parse(localStorage.getItem('tp_logbook_data') || '[]'));
        expect(logbook.map((f) => f.id)).toEqual(['vol-1']);
    });
});
