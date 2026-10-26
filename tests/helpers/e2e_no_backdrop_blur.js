/**
 * Supprime le flou d'arrière-plan (`backdrop-filter`) de la page pour les tests de l'écran Sites.
 *
 * Cet écran superpose une vingtaine de flous (en-tête, cartes, boutons, fenêtres) à la carte. Sur WebKit
 * sous Linux en CI, sans carte graphique, leur rendu logiciel fige parfois la page : plus aucune image n'est
 * peinte, `requestAnimationFrame` ne répond plus, et le contrôle de stabilité de Playwright (qui s'appuie
 * dessus avant tout clic ou défilement) attend jusqu'au délai de 30 s. Mesuré en CI, 12 essais de chacun des
 * deux tests concernés : 7 réussites sur 24 avec les flous, 24 sur 24 sans. Les tests ne vérifient aucun
 * flou ; en production, sur Safari ou iOS (rendu par la carte graphique), rien ne change.
 */
export async function disableBackdropBlur(page) {
    await page.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => {
            const style = document.createElement('style');
            style.textContent = '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';
            document.head.appendChild(style);
        });
    });
}
