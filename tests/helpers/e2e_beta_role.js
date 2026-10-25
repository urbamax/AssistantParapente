/**
 * Le pilote a le rôle « beta » (météo calculée, js/services/access_service.js), comme après une
 * connexion, sans compte Firebase réel. Les rôles sont posés sur l'appareil au démarrage ; et
 * comme le SDK Firebase constate ensuite qu'il n'y a aucune session et les efface (c'est voulu en
 * production, testé dans tests/services/access_service.test.js), on retire cet effacement de la
 * copie du module servie à la page, pour que le test reste déterministe.
 */
export async function grantBetaRole(page) {
    await page.addInitScript(() => {
        localStorage.setItem('parapente_access', JSON.stringify({ uid: 'pilote-e2e', roles: ['beta'] }));
    });
    await page.route('**/js/services/access_service.js*', async (route) => {
        const response = await route.fetch();
        const source = await response.text();
        const marker = '    clear() {\n';
        if (!source.includes(marker))
            throw new Error('access_service.js : clear() introuvable, adapter e2e_beta_role.js');
        await route.fulfill({
            response,
            body: source.replace(marker, `${marker}        return; // e2e : pas de session\n`),
        });
    });
}
