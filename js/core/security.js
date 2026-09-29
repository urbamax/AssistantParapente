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
    },
};

export const escapeHTML = Security.escapeHTML;

/**
 * Rend un texte de fiche de site (données FFVL / communautaires) de façon sûre et fidèle
 * (spec 003, contracts/sanitizer.md) : tout est échappé, puis seuls les retours à la ligne, le
 * gras et les liens http(s) sont restaurés — les liens s'ouvrent dans un nouvel onglet sans accès
 * à l'application. Tout autre balisage reste visible comme du texte (ex. « <Les terrains… »), et
 * un lien vers une autre adresse garde son texte sans être cliquable.
 * @param {string|null|undefined} text
 * @returns {string} HTML sûr à insérer
 */
export function renderSiteText(text) {
    if (text === null || text === undefined || text === '') return '';
    let html = escapeHTML(String(text));
    html = html.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
    html = html.replace(/&lt;b&gt;([\s\S]*?)&lt;\/b&gt;/gi, '<b>$1</b>');
    html = html.replace(
        /&lt;a href=&quot;(https?:\/\/(?:[^\s&]|&amp;)+?)&quot;&gt;([\s\S]*?)&lt;\/a&gt;/gi,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$2</a>',
    );
    // Tout autre lien (adresse non http(s), autres attributs) : on garde le texte seulement.
    html = html.replace(/&lt;a\b(?:(?!&gt;)[\s\S])*&gt;([\s\S]*?)&lt;\/a&gt;/gi, '$1');
    return html;
}

/**
 * Adresse web utilisable dans un lien : conservée seulement si c'est une adresse http(s) valide,
 * sinon '' (pas de lien) — spec 003, FR-004.
 * @param {string|null|undefined} url
 * @returns {string}
 */
export function safeHttpUrl(url) {
    if (!url || typeof url !== 'string') return '';
    try {
        const parsed = new URL(url.trim());
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url.trim() : '';
    } catch {
        return '';
    }
}
