/**
 * VIEW - Safety ICE (Fiche d'urgence & Étiquette Casque)
 * Sous-module de SafetyView pour la gestion de la fiche ICE et de l'étiquette casque.
 */

import IceService, {
    BLOOD_GROUPS,
    ICE_COUNTRIES,
    ICE_FEDERATIONS,
    ICE_LIMITS,
    callingCodeForCountry,
    countryName,
    flagEmoji,
    formatBirthDate,
    formatPhoneDisplay,
    licenceLine,
    normalizeBirthDate,
    normalizeCountry,
    toInternationalPhone,
} from '../services/ice_service.js';
import {
    getIceCloudState,
    setIceCloudState,
    disableIceCloud as clearIceCloudState,
} from '../services/ice_cloud_state.js';
import { escapeHTML } from '../core/security.js';
import AppRouter from '../core/router.js';
import { t } from '../utils/i18n.js';

const esc = (text) => escapeHTML(text || '');
/** @param {string} k @param {Record<string, string|number>} [p] */
const tt = (k, p) => t(`ice.${k}`, p);
/** @param {string} k @param {Record<string, string|number>} [p] */
const th = (k, p) => escapeHTML(tt(k, p));

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
    if (date) return tt('stickerBornOn', { date });
    return /^\d{4}$/.test(p.birthYear || '') ? tt('stickerBornIn', { year: p.birthYear }) : '';
}

export function renderIceSticker(profile) {
    const p = profile || IceService.getProfile();
    const fullName = `${p.prenom || ''} ${p.nom || ''}`.trim() || tt('pilotBadge');
    // Une fiche trop longue ne tient pas dans un QR lisible : on le dit au lieu de faire échouer tout l'onglet.
    let qrSvg;
    try {
        qrSvg = IceService.generateQrSvg(p, { size: 140, border: 1 });
    } catch {
        qrSvg = `<p class="ice-qr-error" role="alert">${th('stickerQrTooLong')}</p>`;
    }

    // Les informations vitales sont écrites en toutes lettres, pas seulement dans le QR.
    const bloodTag =
        p.bloodGroup && p.bloodGroup !== 'Inconnu'
            ? `<span class="ice-sticker-vital">${th('stickerBlood', { value: p.bloodGroup })}</span>`
            : '';
    const anticoagTag = p.anticoag ? `<span class="ice-sticker-vital">${th('stickerAnticoag')}</span>` : '';
    const blood = bloodTag || anticoagTag ? `<div class="ice-sticker-tags">${bloodTag}${anticoagTag}</div>` : '';
    const allergy = p.allergies
        ? `<div class="ice-sticker-allergy">${th('stickerAllergies', { value: p.allergies })}</div>`
        : '';
    // Numéros au format international (+33 …) : un secouriste étranger ou une carte SIM d'un autre pays les compose tels quels.
    const callingCode = callingCodeForCountry(p.pays);
    const contact = (name, phone) => {
        const intl = toInternationalPhone(phone, callingCode);
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
                <span class="ice-sticker-title">${th('stickerTitle')}</span>
                <span class="ice-sticker-sos">${th('stickerSos')}</span>
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
                <span class="ice-sticker-licence">${esc(licenceLine(p))}</span>
                <span>${th('stickerUpdated', { date: updated })}</span>
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
    const fullName = `${p.prenom || ''} ${p.nom || ''}`.trim() || tt('pilotBadge');
    const birth = stickerBirth(p);
    let qrSvg;
    try {
        qrSvg = IceService.generateQrSvg(p, { size: 140, border: 1 });
    } catch {
        qrSvg = `<p class="ice-qr-error" role="alert">${th('stickerQrTooLong')}</p>`;
    }
    return `
        <div class="ice-helmet-sticker ice-sticker-compact" id="ice-helmet-sticker-compact">
            <div class="ice-sticker-header ice-sticker-header-compact">
                <span class="ice-sticker-title">${th('stickerCompactTitle')}</span>
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
    // Nouvelle fiche : fédération FFVL par défaut (comme la France pour la nationalité).
    const federation = p.federation || (p.nom || p.prenom ? '' : 'FFVL');
    // Nouvelle fiche : France par défaut (la plupart des pilotes de l'application) ; sinon le choix enregistré.
    const currentCountry = normalizeCountry(p.pays) || (p.nom || p.prenom ? '' : 'FR');
    const countries = ICE_COUNTRIES.some(([code]) => code === currentCountry)
        ? ICE_COUNTRIES
        : currentCountry
          ? [...ICE_COUNTRIES, [currentCountry, currentCountry]]
          : ICE_COUNTRIES;
    const countryOptions =
        `<option value=""${currentCountry ? '' : ' selected'}>${th('countryUnspecified')}</option>` +
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
            <h3><i class="ri-qr-code-line" aria-hidden="true"></i> ${th('introTitle')}</h3>
            <p class="safety-hint">${th('introHint')}</p>
        </div>

        <div class="ice-grid-layout">
            <!-- Formulaire Pilote -->
            <div class="safety-card ice-form-card">
                <h3><i class="ri-user-settings-line" aria-hidden="true"></i> ${th('formTitle')}</h3>
                
                <fieldset class="ice-fieldset">
                    <legend>${th('fieldsetIdentity')}</legend>
                    <div class="ice-form-row ice-form-row-2">
                        <label>${th('fieldFirstName')}
                            <input type="text" id="ice-prenom" maxlength="${ICE_LIMITS.name}" value="${esc(p.prenom)}" placeholder="${th('placeholderFirstName')}" />
                        </label>
                        <label>${th('fieldLastName')}
                            <input type="text" id="ice-nom" maxlength="${ICE_LIMITS.name}" value="${esc(p.nom)}" placeholder="${th('placeholderLastName')}" />
                        </label>
                    </div>
                    <div class="ice-form-row">
                        <label>${th('fieldNationality')}
                            <select id="ice-pays">${countryOptions}</select>
                        </label>
                    </div>
                    <div class="ice-form-row ice-form-row-2">
                        <label>${th('fieldBirthDate')}
                            <input type="date" id="ice-birthDate" value="${esc(normalizeBirthDate(p.birthDate))}" min="1900-01-01" max="${new Date().toISOString().slice(0, 10)}" />
                        </label>
                        <label>${th('fieldPilotPhone')}
                            <input type="tel" id="ice-tel" maxlength="${ICE_LIMITS.phone}" value="${esc(p.tel)}" placeholder="${th('placeholderPilotPhone')}" />
                        </label>
                    </div>
                    <div class="ice-form-row">
                        <label>${th('fieldLanguages')}
                            <input type="text" id="ice-langues" maxlength="${ICE_LIMITS.langues}" value="${esc(p.langues)}" placeholder="${th('placeholderLanguages')}" />
                        </label>
                    </div>
                </fieldset>

                <fieldset class="ice-fieldset">
                    <legend>${th('fieldsetContact1')}</legend>
                    <div class="ice-form-row ice-form-row-2">
                        <label>${th('fieldContactName')}
                            <input type="text" id="ice-c1-name" maxlength="${ICE_LIMITS.name}" value="${esc(p.contact1Name)}" placeholder="${th('placeholderContact1Name')}" />
                        </label>
                        <label>${th('fieldContactRel')}
                            <input type="text" id="ice-c1-rel" maxlength="${ICE_LIMITS.relation}" value="${esc(p.contact1Rel)}" placeholder="${th('placeholderContact1Rel')}" />
                        </label>
                    </div>
                    <div class="ice-form-row">
                        <label>${th('fieldContact1Phone')}
                            <input type="tel" id="ice-c1-phone" maxlength="${ICE_LIMITS.phone}" value="${esc(p.contact1Phone)}" placeholder="${th('placeholderContact1Phone')}" />
                        </label>
                    </div>
                </fieldset>

                <fieldset class="ice-fieldset">
                    <legend>${th('fieldsetContact2')}</legend>
                    <div class="ice-form-row ice-form-row-2">
                        <label>${th('fieldContactName')}
                            <input type="text" id="ice-c2-name" maxlength="${ICE_LIMITS.name}" value="${esc(p.contact2Name)}" placeholder="${th('placeholderContact2Name')}" />
                        </label>
                        <label>${th('fieldContactRel')}
                            <input type="text" id="ice-c2-rel" maxlength="${ICE_LIMITS.relation}" value="${esc(p.contact2Rel)}" placeholder="${th('placeholderContact2Rel')}" />
                        </label>
                    </div>
                    <div class="ice-form-row">
                        <label>${th('fieldContact2Phone')}
                            <input type="tel" id="ice-c2-phone" maxlength="${ICE_LIMITS.phone}" value="${esc(p.contact2Phone)}" placeholder="${th('placeholderContact2Phone')}" />
                        </label>
                    </div>
                </fieldset>

                <fieldset class="ice-fieldset">
                    <legend>${th('fieldsetMedical')}</legend>
                    <div class="ice-form-row">
                        <label>${th('fieldBloodGroup')}
                            <select id="ice-bloodGroup">${bloodOptions}</select>
                        </label>
                    </div>
                    <div class="ice-form-row">
                        <label>${th('fieldAllergies')}
                            <input type="text" id="ice-allergies" maxlength="${ICE_LIMITS.allergies}" value="${esc(p.allergies)}" placeholder="${th('placeholderAllergies')}" />
                        </label>
                    </div>
                    <div class="ice-form-row">
                        <label>${th('fieldHistory')}
                            <input type="text" id="ice-remarques" maxlength="${ICE_LIMITS.remarques}" value="${esc(p.remarques || p.medical)}" placeholder="${th('placeholderHistory')}" />
                        </label>
                    </div>
                    <div class="ice-form-row ice-form-row-2">
                        <label class="ice-check-label">
                            <input type="checkbox" id="ice-anticoag" ${p.anticoag ? 'checked' : ''} />
                            ${th('fieldAnticoag')}
                        </label>
                        <label>${th('fieldTetanos')}
                            <input type="number" id="ice-tetanos" value="${esc(p.tetanos)}" placeholder="${th('placeholderTetanos')}" min="1950" max="${new Date().getFullYear()}" />
                        </label>
                    </div>
                </fieldset>

                <fieldset class="ice-fieldset">
                    <legend>${th('fieldsetFederal')}</legend>
                    <div class="ice-form-row ice-form-row-2">
                        <label>${th('fieldFederation')}
                            <input type="text" id="ice-federation" list="ice-federations" maxlength="${ICE_LIMITS.federation}" value="${esc(federation)}" placeholder="${th('placeholderFederation')}" autocomplete="off" />
                            <datalist id="ice-federations">${ICE_FEDERATIONS.map((f) => `<option value="${esc(f)}"></option>`).join('')}</datalist>
                        </label>
                        <label>${th('fieldLicenceNumber')}
                            <input type="text" id="ice-ffvl" maxlength="${ICE_LIMITS.ffvl}" value="${esc(p.ffvl)}" placeholder="${th('placeholderLicenceNumber')}" />
                        </label>
                    </div>
                    <div class="ice-form-row">
                        <label>${th('fieldInsurance')}
                            <input type="text" id="ice-insurance" maxlength="${ICE_LIMITS.insurance}" value="${esc(p.insurance)}" placeholder="${th('placeholderInsurance')}" />
                        </label>
                    </div>
                </fieldset>

                <div class="ice-form-actions">
                    <button type="button" class="safety-btn safety-btn-primary" data-action="SafetysaveIceProfile">
                        <i class="ri-save-3-line" aria-hidden="true"></i> ${th('saveProfileBtn')}
                    </button>
                    <button type="button" class="safety-btn" data-action="SafetyclearIceProfile">
                        <i class="ri-delete-bin-line" aria-hidden="true"></i> ${th('resetProfileBtn')}
                    </button>
                </div>
            </div>

            <!-- Aperçu & Impression Étiquette Casque -->
            <div class="safety-card ice-preview-card">
                <h3><i class="ri-printer-line" aria-hidden="true"></i> ${th('previewTitle')}</h3>
                <p class="safety-hint">${th('previewHint')}</p>

                <div id="ice-sticker-wrapper" class="ice-sticker-wrapper">
                    ${renderIceSticker(p)}
                    ${renderIceStickerCompact(p)}
                </div>

                <div class="ice-sticker-actions">
                    <button type="button" class="safety-btn safety-btn-primary" data-action="SafetyprintIceSticker">
                        <i class="ri-printer-fill" aria-hidden="true"></i> ${th('printStickerBtn')}
                    </button>
                    <button type="button" class="safety-btn" data-action="SafetytestIceView">
                        <i class="ri-eye-line" aria-hidden="true"></i> ${th('testViewBtn')}
                    </button>
                </div>

                <div class="ice-print-tips">
                    <h4>${th('tipsTitle')}</h4>
                    <ul>
                        <li>${th('tip1')}</li>
                        <li>${th('tip2')}</li>
                        <li>${th('tip3')}</li>
                    </ul>
                </div>
            </div>
        </div>
        ${renderIceCloudCard()}
    `;
}

/** Date et heure en français (jj/mm/aaaa hh:mm) d'un horodatage en millisecondes. */
function formatDateTime(ms) {
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Carte « Sauvegarde en ligne » : la fiche reste sur l'appareil, sauf demande expresse du pilote.
 * @returns {string}
 */
export function renderIceCloudCard() {
    const engine = typeof window !== 'undefined' ? window.FirebaseAuthEngine : null;
    const state = getIceCloudState();
    let body;
    if (!engine?.enabled) {
        body = `<p class="safety-hint">${th('cloudDisabledHint')}</p>`;
    } else if (!engine.currentUser) {
        body = `<p class="safety-hint">${th('cloudSignInHint')}</p>`;
    } else if (state.enabled) {
        const when = state.lastSyncedAt ? tt('cloudSyncedOn', { date: formatDateTime(state.lastSyncedAt) }) : '';
        body = `
            <p class="ice-cloud-status" role="status"><i class="ri-cloud-fill" aria-hidden="true"></i> ${th('cloudStatus', { when })}</p>
            <button type="button" class="safety-btn" data-action="SafetydisableIceCloud">
                <i class="ri-delete-bin-line" aria-hidden="true"></i> ${th('cloudDeleteBtn')}
            </button>`;
    } else {
        body = `
            <button type="button" class="safety-btn safety-btn-primary" data-action="SafetyenableIceCloud">
                <i class="ri-cloud-line" aria-hidden="true"></i> ${th('cloudEnableBtn')}
            </button>`;
    }
    return `
        <div class="safety-card ice-cloud-card" id="ice-cloud-card">
            <h3><i class="ri-cloud-line" aria-hidden="true"></i> ${th('cloudTitle')}</h3>
            <p class="safety-hint">
                ${th('cloudIntroPrefix')} <strong>${th('cloudIntroLocalOnly')}</strong>${th('cloudIntroSuffix')}
            </p>
            ${body}
        </div>
    `;
}

function refreshIcePanel() {
    const panel = document.getElementById('safety-panel-ice');
    if (panel) panel.innerHTML = renderIceTabHtml();
}

/** Envoie la fiche en ligne si le pilote a demandé la sauvegarde (sans bloquer l'écran). */
function pushIceIfEnabled() {
    if (!getIceCloudState().enabled) return;
    const engine = window.FirebaseAuthEngine;
    if (engine?.saveIceToCloud) void engine.saveIceToCloud().then(refreshIcePanelStatus);
}

/** Met à jour la ligne d'état de la carte en ligne (date de dernière sauvegarde) sans toucher au formulaire. */
function refreshIcePanelStatus() {
    const card = document.getElementById('ice-cloud-card');
    if (card) card.outerHTML = renderIceCloudCard();
}

/**
 * Demande expresse du pilote : enregistrer sa fiche dans son profil en ligne. Une fiche déjà en ligne est
 * reprise si cet appareil n'a pas la sienne, sinon le pilote choisit laquelle garder.
 */
export async function enableIceCloud() {
    const engine = window.FirebaseAuthEngine;
    if (!engine?.enabled || !engine.currentUser) {
        alert(tt('cloudSignInAlert'));
        return;
    }
    const agreed = confirm(tt('cloudConsentConfirm'));
    if (!agreed) return;

    const local = IceService.getProfile();
    const hasLocal = Boolean(local.nom || local.prenom || local.contact1Phone || local.contact2Phone);
    const remote = await engine.fetchIceFromCloud();
    if (!remote.success) {
        alert(tt('cloudUnreachableAlert'));
        return;
    }

    let useRemote = false;
    if (remote.data && hasLocal) {
        const date = remote.data.updatedAt
            ? tt('cloudConflictDate', { date: formatDateTime(remote.data.updatedAt) })
            : '';
        useRemote = !confirm(tt('cloudConflictConfirm', { date }));
    } else if (remote.data) {
        useRemote = true;
    }

    setIceCloudState({ enabled: true, consentAt: new Date().toISOString() });
    if (useRemote) {
        IceService.saveProfile(remote.data, { updatedAt: remote.data.updatedAt || Date.now() });
        setIceCloudState({ lastSyncedAt: Date.now() });
    } else {
        const sent = await engine.saveIceToCloud();
        if (!sent.success) {
            clearIceCloudState();
            alert(tt('cloudSaveFailedAlert'));
            refreshIcePanel();
            return;
        }
    }
    refreshIcePanel();
}

/** Supprime la fiche du profil en ligne (elle reste sur cet appareil) et arrête la sauvegarde. */
export async function disableIceCloud() {
    if (!confirm(tt('cloudDisableConfirm'))) return;
    const engine = window.FirebaseAuthEngine;
    const deleted = engine?.deleteIceFromCloud ? await engine.deleteIceFromCloud() : { success: false };
    if (!deleted.success) {
        alert(tt('cloudDeleteFailedAlert'));
        return;
    }
    clearIceCloudState();
    refreshIcePanel();
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
        federation: val('ice-federation'),
        insurance: val('ice-insurance'),
    };
}

export function saveIceProfile() {
    const values = getIceFormValues();
    IceService.saveProfile(values);
    updateIceStickerPreview(values);
    pushIceIfEnabled();
    alert(IceService.qrFits(values) ? tt('saveOkAlert') : tt('saveTooLongAlert'));
}

export async function clearIceProfile() {
    const online = getIceCloudState().enabled;
    if (!confirm(online ? tt('clearConfirmOnline') : tt('clearConfirmLocal'))) return;
    if (online) {
        const deleted = await window.FirebaseAuthEngine?.deleteIceFromCloud?.();
        if (!deleted?.success) {
            alert(tt('clearDeleteOnlineFailedAlert'));
            return;
        }
        clearIceCloudState();
    }
    IceService.clearProfile();
    refreshIcePanel();
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
    pushIceIfEnabled();

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
    // replaceState et non `location.hash = ...` : changer le hash déclenche « popstate » avec un état vide, et le
    // routeur renvoie alors vers l'accueil (la fiche s'affichait un instant puis disparaissait).
    window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.search}#${payload}`,
    );
    AppRouter.navigate('ICE');
}
