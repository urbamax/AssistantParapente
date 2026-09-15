/**
 * MODULE SÉCURITÉ (XSS Prevention)
 * Fournit des utilitaires pour sécuriser les données avant injection dans le DOM.
 */

export const Security = {
    /**
     * Échappe les caractères HTML spéciaux d'une chaîne de caractères pour prévenir les failles XSS.
     * À utiliser systématiquement avant d'injecter des données utilisateur via innerHTML.
     * @param {string} str - La chaîne à échapper.
     * @returns {string} - La chaîne sécurisée.
     */
    escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
};

export const escapeHTML = Security.escapeHTML;
