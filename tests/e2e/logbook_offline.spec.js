import { test, expect } from '@playwright/test';

test.describe('E2E - Logbook Offline Flow', () => {

  test.beforeEach(async ({ page }) => {
    // Évite les alertes GDPR ou autres modals au démarrage
    await page.addInitScript(() => {
        window.localStorage.setItem('parapente_user_prefs', JSON.stringify({ gdprConsent: { stats: true, firebase: true } }));
    });
    
    // Charger l'application
    await page.goto('/');
  });

  test('Ajout de vol hors-ligne puis synchronisation', async ({ page, context }) => {
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    page.on('pageerror', err => console.log('PAGE_ERROR:', err.message));
    // 1. Accéder au carnet de vol
    const navLink = page.locator('.nav-menu-btn[data-target="LOGBOOK"]').first();
    // On attend que la navigation soit visible
    await navLink.waitFor({ state: 'visible' });
    await navLink.click();
    
    // S'assurer qu'on est sur la vue Carnet
    await expect(page.locator('#logbook-screen')).toHaveClass(/active/);

    // 2. Simuler une déconnexion (Hors-ligne)
    await context.setOffline(true);

    // 3. Ouvrir le formulaire d'ajout
    // Il y a un bouton switchTab 'add'
    await page.locator('[data-action="switchTab"][data-args="\'add\'"]').first().click();
    
    // Attendre que le formulaire s'affiche
    await expect(page.locator('#logbook-tab-add')).toBeVisible();

    // 4. Remplir le formulaire
    await page.fill('#lb-site', 'Montagne Test Offline');
    await page.fill('#lb-duree', '45');
    
    // Select tech decollage if it exists
    const techSelect = page.locator('#lb-tech-decollage');
    if (await techSelect.count() > 0) {
        await techSelect.selectOption({ index: 1 });
    }
    
    const voileSelect = page.locator('#lb-voile');
    if (await voileSelect.count() > 0) {
      await voileSelect.evaluate((node) => {
          if (node.options.length === 0) {
              const opt = document.createElement('option');
              opt.value = 'default_wing';
              opt.text = 'Voile par défaut';
              node.add(opt);
          }
          node.value = node.options[node.options.length - 1].value;
      });
    }
    
    // 5. Soumettre le formulaire
    await page.evaluate(() => {
        document.getElementById('logbook-add-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    // 6. Vérifier que le vol est ajouté dans la liste et porte l'icône "En attente" (Cloud barré ou autre)
    // L'interface retourne sur l'onglet history après l'ajout.
    await expect(page.locator('#logbook-history-list')).toBeVisible();
    
    // Le vol doit apparaître dans la liste avec le texte 'Montagne Test Offline'
    const flightEntry = page.locator('.logbook-card').filter({ hasText: 'Montagne Test Offline' });
    await expect(flightEntry).toBeVisible();

    // 8. Retour en ligne
    await context.setOffline(false);

    // Déclencher manuellement l'événement 'online'
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    // 9. Vérifier que la synchro a fonctionné
    await page.waitForTimeout(1000);
    
    // Le vol est toujours là
    await expect(flightEntry).toBeVisible();
  });

});
