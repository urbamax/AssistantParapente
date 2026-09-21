/**
 * VIEW - WelcomeView
 * Écran d'accueil de la toute première visite : choix du niveau puis de la première page.
 * Le choix du niveau passe par l'action `changeLevel` ; les cartes par `navigate`.
 */
import GlobalState from '../core/app_state.js';
import BaseView from '../core/base_view.js';

class WelcomeViewClass extends BaseView {
    async mount(params) {
        await super.mount(params);
        this._unsubscribeLevel = GlobalState.subscribe('level', (level) => this.highlightLevel(level));
    }

    async unmount() {
        await super.unmount();
        if (this._unsubscribeLevel) {
            this._unsubscribeLevel();
            this._unsubscribeLevel = null;
        }
    }

    highlightLevel(level) {
        document.querySelectorAll('#welcome-screen [data-level]').forEach((btn) => {
            btn.setAttribute('aria-pressed', String(btn.dataset.level === level));
        });
    }
}

const WelcomeView = new WelcomeViewClass();
export default WelcomeView;
