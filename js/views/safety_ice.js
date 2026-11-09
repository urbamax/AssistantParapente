/**
 * VIEW - Safety ICE (Fiche d'urgence & Étiquette Casque)
 * Sous-module de SafetyView pour la gestion de la fiche ICE et de l'étiquette casque.
 */

import IceService, {
    BLOOD_GROUPS,
    ICE_COUNTRIES,
    ICE_LIMITS,
    countryName,
    flagEmoji,
    formatBirthDate,
    formatPhoneDisplay,
    normalizeBirthDate,
    normalizeCountry,
    toInternationalPhone,
} from '../services/ice_service.js';
import { escapeHTML } from '../core/security.js';
import AppRouter from '../core/router.js';

const esc = (text) => escapeHTML(text || '');

/** Drapeau de la nationalité (emoji) pour une étiquette : '' si aucune nationalité n'est renseignée. */
function stickerFlag(p) {
    const code = normalizeCountry(p.pays);
    return code
        ? `<span class="ice-sticker-flag" role="img" aria-label="${esc(countryName(code))}">${flagEmoji(code)}</span> `
        : '';
}

/** « Né le 12/03/1988 » (date complète) ou « Né en 1988 » (anciennes fiches) ; '' sans date. */
function stickerBirth(p) {
    const date = formatBirthDate(p.birthDate);
    if (date) return `Né le ${date}`;
    return /^\d{4}$/.test(p.birthYear || '') ? `Né en ${p.birthYear}` : '';
}

export function renderIceSticker(profile) {
    const p = profile || IceService.getProfile();
    const fullName = `${p.prenom || ''} ${p.nom || ''}`.trim() || 'Pilote';
    // Une fiche trop longue ne tient pas dans un QR lisible : on le dit au lieu de faire échouer tout l'onglet.
    let qrSvg;
    try {
        qrSvg = IceService.generateQrSvg(p, { size: 140, border: 1 });
    } catch {
        qrSvg =
            '<p class="ice-qr-error" role="alert">Fiche trop longue pour un QR lisible : raccourcissez les allergies ou les remarques.</p>';
    }

    // Les informations vitales sont écrites en toutes lettres, pas seulement dans le QR.
    const bloodTag =
        p.bloodGroup && p.bloodGroup !== 'Inconnu'
            ? `<span class="ice-sticker-vital">SANG ${esc(p.bloodGroup)}</span>`
            : '';
    const anticoagTag = p.anticoag ? '<span class="ice-sticker-vital">ANTICOAGULANT</span>' : '';
    const blood = bloodTag || anticoagTag ? `<div class="ice-sticker-tags">${bloodTag}${anticoagTag}</div>` : '';
    const allergy = p.allergies ? `<div class="ice-sticker-allergy">ALLERGIES : ${esc(p.allergies)}</div>` : '';
    // Numéros au format international (+33 …) : un secouriste étranger ou une carte SIM d'un autre pays les compose tels quels.
    const contact = (name, phone) => {
        const intl = toInternationalPhone(phone);
        if (!intl) return '';
        return `<div class="ice-sticker-contact">${name ? `${esc(name)} : ` : ''}<strong>${esc(formatPhoneDisplay(intl))}</strong></div>`;
    };
    // Seul le contact d'urgence principal est écrit sur l'étiquette (le second n'est que dans le QR) ; à défaut
    // de premier contact, le second ; sans aucun contact, le 112.
    const contacts =
        contact(p.contact1Name, p.contact1Phone) ||
        contact(p.contact2Name, p.contact2Phone) ||
        '<div class="ice-sticker-contact"><strong>112</strong></div>';
    // Drapeau de la nationalité à côté du nom : les secours voient d'où vient le pilote.
    const flag = stickerFlag(p);
    const birth = stickerBirth(p);
    const now = new Date();
    const updated = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    return `
        <div class="ice-helmet-sticker" id="ice-helmet-sticker">
            <div class="ice-sticker-header">
                <span class="ice-sticker-title">URGENCE · ICE</span>
                <span class="ice-sticker-sos">SOS 112</span>
            </div>
            <div class="ice-sticker-body">
                <div class="ice-sticker-qr">${qrSvg}</div>
                <div class="ice-sticker-meta">
                    <div class="ice-sticker-pilot">${flag}${esc(fullName)}</div>
                    ${birth ? `<div class="ice-sticker-birth">${esc(birth)}</div>` : ''}
                    ${blood}
                    ${allergy}
                    ${contacts}
                </div>
            </div>
            <div class="ice-sticker-foot">
                <span>Mis à jour ${updated}</span>
            </div>
        </div>
    `;
}

/**
 * Étiquette compacte : « URGENCE », le QR code, et en dessous l'identité (drapeau, nom, date de naissance) pour
 * savoir à qui est le casque sans rien scanner. Toutes les autres informations sont dans le QR ; l'étiquette
 * complète les écrit en toutes lettres.
 * @param {Partial<import('../services/ice_service.js').IceProfile>} [profile]
 */
export function renderIceStickerCompact(profile) {
    const p = profile || IceService.getProfile();
    const fullName = `${p.prenom || ''} ${p.nom || ''}`.trim() || 'Pilote';
    const birth = stickerBirth(p);
    let qrSvg;
    try {
        qrSvg = IceService.generateQrSvg(p, { size: 140, border: 1 });
    } catch {
        qrSvg =
            '<p class="ice-qr-error" role="alert">Fiche trop longue pour un QR lisible : raccourcissez les allergies ou les remarques.</p>';
    }
    return `
        <div class="ice-helmet-sticker ice-sticker-compact" id="ice-helmet-sticker-compact">
            <div class="ice-sticker-header ice-sticker-header-compact">
                <span class="ice-sticker-title">URGENCE</span>
            </div>
            <div class="ice-sticker-qr">${qrSvg}</div>
            <div class="ice-sticker-id">
                <div class="ice-sticker-pilot">${stickerFlag(p)}${esc(fullName)}</div>
                ${birth ? `<div class="ice-sticker-birth">${esc(birth)}</div>` : ''}
            </div>
        </div>
    `;
}

export function renderIceTabHtml() {
    const p = IceService.getProfile();
    // Nouvelle fiche : France par défaut (la plupart des pilotes de l'application) ; sinon le choix enregistré.
    const currentCountry = normalizeCountry(p.pays) || (p.nom || p.prenom ? '' : 'FR');
    const countries = ICE_COUNTRIES.some(([code]) => code === currentCountry)
        ? ICE_COUNTRIES
        : currentCountry
          ? [...ICE_COUNTRIES, [currentCountry, currentCountry]]
          : ICE_COUNTRIES;
    const countryOptions =
        `<option value=""${currentCountry ? '' : ' selected'}>Non précisée</option>` +
        countries
            .map(
                ([code, name]) =>
                    `<option value="${esc(code)}"${code === currentCountry ? ' selected' : ''}>${flagEmoji(code)} ${esc(name)}</option>`,
            )
            .join('');
    const bloodOptions = BLOOD_GROUPS.map((bg) => {
        const selected = (p.bloodGroup || 'Inconnu') === bg ? 'selected' : '';
        return `<option value="${esc(bg)}" ${selected}>${esc(bg)}</option>`;
    }).join('');

    return `
        <div class="safety-card ice-card-intro">
            <h3><i class="ri-qr-code-line" aria-hidden="true"></i> Fiche d'Urgence Pilote &amp; Étiquette Casque</h3>
            <p class="safety-hint">
                Générez une étiquette étanche avec QR Code à coller sur votre casque ou votre sellette. En cas d'accident,
                les témoins ou les secouristes peuvent la scanner avec n'importe quel smartphone pour joindre immédiatement
                vos proches et connaître vos données médicales vitales. Le QR contient une fiche contact : l'appareil photo du téléphone l'ouvre sans réseau et sans ce site, avec vos contacts d'urgence et vos informations médicales dans les notes. Votre fiche reste sur cet appareil : elle n'est ni synchronisée ni exportée.
            </p>
        </div>

        <div class="ice-grid-layout">
            <!-- Formulaire Pilote -->
            <div class="safety-card ice-form-card">
                <h3><i class="ri-user-settings-line" aria-hidden="true"></i> Mes Informations d'Urgence</h3>
                
                <fieldset class="ice-fieldset">
                    <legend>Identité</legend>
                    <div class="ice-form-row ice-form-row-2">
                        <label>Prénom
                            <input type="text" id="ice-prenom" maxlength="${ICE_LIMITS.name}" value="${esc(p.prenom)}" placeholder="Ex: Thomas" />
                        </label>
                        <label>Nom
                            <input type="text" id="ice-nom" maxlength="${ICE_LIMITS.name}" value="${esc(p.nom)}" placeholder="Ex: Dupont" />
                        </label>
                    </div>
                    <div class="ice-form-row">
                        <label>Nationalité (drapeau à côté du nom)
                            <select id="ice-pays">${countryOptions}</select>
                        </label>
                    </div>
                    <div class="ice-form-row ice-form-row-2">
                        <label>Date de naissance
                            <input type="date" id="ice-birthDate" value="${esc(normalizeBirthDate(p.birthDate))}" min="1900-01-01" max="${new Date().toISOString().slice(0, 10)}" />
                        </label>
                        <label>Mon numéro de téléphone
                            <input type="tel" id="ice-tel" maxlength="${ICE_LIMITS.phone}" value="${esc(p.tel)}" placeholder="Ex: 06 00 11 22 33" />
                        </label>
                    </div>
                    <div class="ice-form-row">
                        <label>Langues parlées
                            <input type="text" id="ice-langues" maxlength="${ICE_LIMITS.langues}" value="${esc(p.langues)}" placeholder="Ex: Français, Anglais" />
                        </label>
                    </div>
                </fieldset>

                <fieldset class="ice-fieldset">
                    <legend>Contact d'urgence 1 (Prioritaire)</legend>
                    <div class="ice-form-row ice-form-row-2">
                        <label>Nom du contact
                            <input type="text" id="ice-c1-name" maxlength="${ICE_LIMITS.name}" value="${esc(p.contact1Name)}" placeholder="Ex: Sophie" />
                        </label>
                        <label>Lien / Parenté
                            <input type="text" id="ice-c1-rel" maxlength="${ICE_LIMITS.relation}" value="${esc(p.contact1Rel)}" placeholder="Ex: Conjointe" />
                        </label>
                    </div>
                    <div class="ice-form-row">
                        <label>Téléphone d'urgence *
                            <input type="tel" id="ice-c1-phone" maxlength="${ICE_LIMITS.phone}" value="${esc(p.contact1Phone)}" placeholder="Ex: 06 12 34 56 78" />
                        </label>
                    </div>
                </fieldset>

                <fieldset class="ice-fieldset">
                    <legend>Contact d'urgence 2 (Optionnel)</legend>
                    <div class="ice-form-row ice-form-row-2">
                        <label>Nom du contact
                            <input type="text" id="ice-c2-name" maxlength="${ICE_LIMITS.name}" value="${esc(p.contact2Name)}" placeholder="Ex: Pierre" />
                        </label>
                        <label>Lien / Parenté
                            <input type="text" id="ice-c2-rel" maxlength="${ICE_LIMITS.relation}" value="${esc(p.contact2Rel)}" placeholder="Ex: Frère / Ami" />
                        </label>
                    </div>
                    <div class="ice-form-row">
                        <label>Téléphone
                            <input type="tel" id="ice-c2-phone" maxlength="${ICE_LIMITS.phone}" value="${esc(p.contact2Phone)}" placeholder="Ex: 06 98 76 54 32" />
                        </label>
                    </div>
                </fieldset>

                <fieldset class="ice-fieldset">
                    <legend>Données Médicales Vitales</legend>
                    <div class="ice-form-row">
                        <label>Groupe sanguin
                            <select id="ice-bloodGroup">${bloodOptions}</select>
                        </label>
                    </div>
                    <div class="ice-form-row">
                        <label>Allergies majeures / Contre-indications
                            <input type="text" id="ice-allergies" maxlength="${ICE_LIMITS.allergies}" value="${esc(p.allergies)}" placeholder="Ex: Pénicilline, aspirine, asthme..." />
                        </label>
                    </div>
                    <div class="ice-form-row">
                        <label>Antécédents / Traitements réguliers
                            <input type="text" id="ice-remarques" maxlength="${ICE_LIMITS.remarques}" value="${esc(p.remarques || p.medical)}" placeholder="Ex: Diabète, anticoagulant..." />
                        </label>
                    </div>
                    <div class="ice-form-row ice-form-row-2">
                        <label class="ice-check-label">
                            <input type="checkbox" id="ice-anticoag" ${p.anticoag ? 'checked' : ''} />
                            Traitement anticoagulant (saignement à risque)
                        </label>
                        <label>Dernier rappel antitétanique (année)
                            <input type="number" id="ice-tetanos" value="${esc(p.tetanos)}" placeholder="Ex: 2022" min="1950" max="${new Date().getFullYear()}" />
                        </label>
                    </div>
                </fieldset>

                <fieldset class="ice-fieldset">
                    <legend>Informations Fédérales &amp; Assurance</legend>
                    <div class="ice-form-row ice-form-row-2">
                        <label>N° Licence FFVL
                            <input type="text" id="ice-ffvl" maxlength="${ICE_LIMITS.ffvl}" value="${esc(p.ffvl)}" placeholder="Ex: 1234567" />
                        </label>
                        <label>Assurance assistance / Rapatriement
                            <input type="text" id="ice-insurance" maxlength="${ICE_LIMITS.insurance}" value="${esc(p.insurance)}" placeholder="Ex: Europ Assistance FFVL" />
                        </label>
                    </div>
                </fieldset>

                <div class="ice-form-actions">
                    <button type="button" class="btn btn-primary" data-action="SafetysaveIceProfile">
                        <i class="ri-save-3-line" aria-hidden="true"></i> Enregistrer dans mon profil
                    </button>
                    <button type="button" class="btn btn-outline" data-action="SafetyclearIceProfile">
                        <i class="ri-delete-bin-line" aria-hidden="true"></i> Réinitialiser
                    </button>
                </div>
            </div>

            <!-- Aperçu & Impression Étiquette Casque -->
            <div class="safety-card ice-preview-card">
                <h3><i class="ri-printer-line" aria-hidden="true"></i> Mon Étiquette Casque</h3>
                <p class="safety-hint">Aperçu en taille réelle de l'étiquette à découper :</p>

                <div id="ice-sticker-wrapper" class="ice-sticker-wrapper">
                    ${renderIceSticker(p)}
                    ${renderIceStickerCompact(p)}
                </div>

                <div class="ice-sticker-actions">
                    <button type="button" class="btn btn-primary" data-action="SafetyprintIceSticker">
                        <i class="ri-printer-fill" aria-hidden="true"></i> Imprimer l'étiquette casque
                    </button>
                    <button type="button" class="btn btn-secondary" data-action="SafetytestIceView">
                        <i class="ri-eye-line" aria-hidden="true"></i> Tester la vue Secours
                    </button>
                </div>

                <div class="ice-print-tips">
                    <h4>💡 Conseils de pose pour le vol :</h4>
                    <ul>
                        <li>Découpez l'étiquette en suivant les pointillés.</li>
                        <li>Collez-la sur le côté ou l'arrière du casque (ou sur le côté de la sellette).</li>
                        <li>Recouvrez-la d'un morceau d'adhésif transparent large pour la rendre 100% étanche à l'eau et aux frottements.</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
}

export function getIceFormValues() {
    const val = (id) => /** @type {HTMLInputElement} */ (document.getElementById(id))?.value?.trim() || '';
    return {
        prenom: val('ice-prenom'),
        nom: val('ice-nom'),
        birthDate: val('ice-birthDate'),
        tel: val('ice-tel'),
        langues: val('ice-langues'),
        contact1Name: val('ice-c1-name'),
        contact1Rel: val('ice-c1-rel'),
        contact1Phone: val('ice-c1-phone'),
        contact2Name: val('ice-c2-name'),
        contact2Rel: val('ice-c2-rel'),
        contact2Phone: val('ice-c2-phone'),
        bloodGroup: val('ice-bloodGroup'),
        allergies: val('ice-allergies'),
        remarques: val('ice-remarques'),
        anticoag: /** @type {HTMLInputElement | null} */ (document.getElementById('ice-anticoag'))?.checked ? '1' : '',
        tetanos: val('ice-tetanos'),
        pays: val('ice-pays'),
        ffvl: val('ice-ffvl'),
        insurance: val('ice-insurance'),
    };
}

export function saveIceProfile() {
    const values = getIceFormValues();
    IceService.saveProfile(values);
    updateIceStickerPreview(values);
    alert(
        IceService.qrFits(values)
            ? 'Fiche d’urgence enregistrée sur cet appareil. Votre étiquette casque a été mise à jour.'
            : 'Fiche enregistrée, mais trop longue pour tenir dans un QR lisible : raccourcissez les allergies ou les remarques avant d’imprimer.',
    );
}

export function clearIceProfile() {
    if (!confirm('Voulez-vous réinitialiser votre fiche d’urgence ?')) return;
    IceService.clearProfile();
    const panel = document.getElementById('safety-panel-ice');
    if (panel) panel.innerHTML = renderIceTabHtml();
}

export function updateIceStickerPreview(values) {
    const wrapper = document.getElementById('ice-sticker-wrapper');
    if (wrapper) {
        wrapper.innerHTML = renderIceSticker(values) + renderIceStickerCompact(values);
    }
}

export function printIceSticker() {
    const values = getIceFormValues();
    IceService.saveProfile(values);
    updateIceStickerPreview(values);

    // Une feuille : l'étiquette complète (sellette) et deux compactes (les deux côtés du casque). La copie de
    // l'étiquette compacte n'existe que le temps de l'impression.
    const compact = document.getElementById('ice-helmet-sticker-compact');
    if (compact) {
        const copy = /** @type {HTMLElement} */ (compact.cloneNode(true));
        copy.id = 'ice-helmet-sticker-compact-copy';
        copy.setAttribute('aria-hidden', 'true');
        copy.classList.add('ice-sticker-copy');
        compact.after(copy);
        window.addEventListener('afterprint', () => copy.remove(), { once: true });
    }
    window.print();
}

export function testIceView() {
    // Simple essai du lecteur web avec ce qui est dans le formulaire : rien n'est enregistré.
    const values = getIceFormValues();
    const payload = IceService.encodePayload(values);
    window.location.hash = '#' + payload;
    AppRouter.navigate('ICE');
}
