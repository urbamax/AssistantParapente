/**
 * UTILS - textes fixes du HTML (spec 026)
 * index.html et les composants gardent leur texte français (affichage immédiat, sans JavaScript) ;
 * chaque texte porte une clé du catalogue (section html de js/i18n/fr.js) :
 *  - data-i18n : le texte de l'élément (ses balises enfants, comme une icône, sont conservées) ;
 *  - data-i18n-html : un texte mêlé de liens ou de gras, remplacé en entier ;
 *  - data-i18n-placeholder / -title / -aria-label / -alt : l'attribut correspondant.
 * applyStaticTexts() servira le jour où une autre langue sera proposée ; en français, le HTML est
 * déjà identique au catalogue (vérifié par tests/views/static_texts.test.js).
 */

export const STATIC_TEXT_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt'];

/**
 * @param {ParentNode} root
 * @param {(key: string) => string} lookup clé complète (« html.welcomeScreen.bienvenue ») → texte
 */
export function applyStaticTexts(root, lookup) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
        const text = lookup(`html.${el.getAttribute('data-i18n')}`);
        const nodes = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
        if (nodes.length === 0) {
            el.append(text);
            return;
        }
        // Le premier morceau de texte reçoit la traduction, espaces autour conservés.
        nodes[0].textContent = nodes[0].textContent.replace(/\S(?:[\s\S]*\S)?/, text);
        nodes.slice(1).forEach((n) => n.remove());
    });
    root.querySelectorAll('[data-i18n-html]').forEach((el) => {
        el.innerHTML = lookup(`html.${el.getAttribute('data-i18n-html')}`);
    });
    STATIC_TEXT_ATTRIBUTES.forEach((attr) => {
        root.querySelectorAll(`[data-i18n-${attr}]`).forEach((el) => {
            el.setAttribute(attr, lookup(`html.${el.getAttribute(`data-i18n-${attr}`)}`));
        });
    });
}
