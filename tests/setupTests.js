import { beforeEach, vi } from 'vitest';

beforeEach(() => {
    // 1. Nettoyer le LocalStorage natif de Happy-DOM
    localStorage.clear();
    
    // 2. Réinitialiser la variable globale qui stocke la DB de QCM
    window.QCM_OFFICIAL = undefined;
    
    // 3. Mocker la fonction fetch au cas où le service essaie de télécharger le CSV
    global.fetch = vi.fn();
});
