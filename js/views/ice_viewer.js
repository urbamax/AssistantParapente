/**
 * VIEW - IceViewer
 * Écran « Fiche d'urgence & Secours (ICE) » en LECTURE SEULE.
 *
 * Affiché immédiatement quand un témoin ou un secouriste scanne le QR code du casque/sellette.
 * Accessible à tous sans connexion requise, lit directement les données encodées dans le QR code.
 */

import BaseView from '../core/base_view.js';
import {
    decodePayload,
    callingCodeForCountry,
    toInternationalPhone,
    formatPhoneDisplay,
    ageOf,
    flagEmoji,
    countryName,
    formatBirthDate,
    normalizeBirthDate,
    normalizeCountry,
    IceService,
} from '../services/ice_service.js';
import { escapeHTML } from '../core/security.js';
import AppRouter from '../core/router.js';
import { t } from '../utils/i18n.js';

const esc = (text) => escapeHTML(text || '');
/** @param {string} k @param {Record<string, string|number>} [p] */
const tt = (k, p) => t(`ice.${k}`, p);
/** @param {string} k @param {Record<string, string|number>} [p] */
const th = (k, p) => escapeHTML(tt(k, p));

export class IceViewClass extends BaseView {
    constructor() {
        super();
        /** @type {import('../services/ice_service.js').IceProfile|null} */
        this.profile = null;
    }

    async mount(params = {}) {
        await super.mount(params);
        const root = document.getElementById('ice-root');
        if (!root) return;

        // 1. Extraction du payload depuis le hash ou la query string
        let payloadString = '';
        if (typeof window !== 'undefined' && window.location) {
            if (window.location.hash && window.location.hash.length > 1) {
                payloadString = window.location.hash;
            } else if (window.location.search) {
                payloadString = window.location.search;
            }
        }

        const decoded = decodePayload(payloadString);

        // Si aucun payload dans l'URL, on affiche le profil local enregistré à titre de prévisualisation
        const hasData = Boolean(decoded.nom || decoded.prenom || decoded.contact1Phone);
        this.profile = hasData ? decoded : IceService.getProfile();

        root.innerHTML = this.renderPage();
    }

    renderPage() {
        /** @type {Partial<import('../services/ice_service.js').IceProfile>} */
        const p = this.profile || {};
        const fullName = `${p.prenom || ''} ${p.nom || ''}`.trim() || tt('pilotFallback');

        // Âge en années révolues, avec la date de naissance complète quand elle est connue.
        let ageText = '';
        const age = ageOf(p);
        if (age !== null && age > 0 && age < 120) {
            const born = normalizeBirthDate(p.birthDate)
                ? tt('bornOn', { date: formatBirthDate(p.birthDate) })
                : tt('bornIn', { year: p.birthYear });
            ageText = th('ageLine', { age, born });
        }

        const country = normalizeCountry(p.pays);
        const callingCode = callingCodeForCountry(p.pays);
        const flag = country
            ? `<span class="ice-flag" role="img" aria-label="${esc(countryName(country))}">${flagEmoji(country)}</span> `
            : '';
        const pilotPhone = toInternationalPhone(p.tel, callingCode);
        const pilotLines = [
            pilotPhone
                ? `<p class="ice-pilot-origin">${th('pilotPhone')} <a href="tel:${esc(pilotPhone)}">${esc(formatPhoneDisplay(pilotPhone))}</a></p>`
                : '',
            p.langues ? `<p class="ice-pilot-origin">${th('languages', { value: p.langues })}</p>` : '',
        ].join('');
        const origin = country
            ? `<p class="ice-pilot-origin">${th('nationality', { value: countryName(country) })}</p>`
            : '';

        const bloodBadge =
            p.bloodGroup && p.bloodGroup !== 'Inconnu'
                ? `<div class="ice-blood-badge" aria-label="${th('bloodGroupLabel', { value: p.bloodGroup })}">
                    <span class="ice-blood-drop">🩸</span>
                    <span class="ice-blood-val">${esc(p.bloodGroup)}</span>
               </div>`
                : '';

        return `
            <div class="ice-viewer-container">
                <!-- En-tête d'urgence haute visibilité -->
                <header class="ice-header-banner">
                    <div class="ice-banner-title">
                        <i class="ri-alarm-warning-fill" aria-hidden="true"></i>
                        <h1>${th('bannerTitle')}</h1>
                    </div>
                    <p class="ice-banner-subtitle">${th('bannerSubtitle')}</p>
                </header>

                <!-- Identité & Groupe sanguin -->
                <section class="ice-card ice-card-identity">
                    <div class="ice-identity-layout">
                        <div class="ice-identity-info">
                            <span class="ice-badge-pilot">${th('pilotBadge')}</span>
                            <h2 class="ice-pilot-name">${flag}${esc(fullName)}</h2>
                            ${origin}
                            ${pilotLines}
                            ${ageText ? `<p class="ice-pilot-age">${ageText}</p>` : ''}
                        </div>
                        ${bloodBadge}
                    </div>
                </section>

                <!-- Rappel secours d'urgence (en haut pour un accès immédiat sous stress) -->
                <section class="ice-card ice-card-emergency-actions">
                    <div class="ice-emergency-grid">
                        <a class="safety-call-btn" href="tel:112">
                            <i class="ri-phone-fill" aria-hidden="true"></i>
                            <span><strong>${th('call112')}</strong><small>${th('call112Sub')}</small></span>
                        </a>
                        <div class="safety-frequency" aria-label="${th('ffvlFreqLabel')}">
                            <i class="ri-broadcast-line" aria-hidden="true"></i>
                            <span><strong>${th('ffvlFreqValue')}</strong><small>${th('ffvlFreqSub')}</small></span>
                        </div>
                    </div>
                </section>

                <!-- Boutons d'appel direct contacts d'urgence -->
                <section class="ice-card ice-card-contacts">
                    <h3><i class="ri-contacts-fill" aria-hidden="true"></i> ${th('contactsTitle')}</h3>
                    ${this.renderContacts(p)}
                </section>

                <!-- Données médicales vitales -->
                ${this.renderMedical(p)}

                <!-- Infos fédérales & Assurance -->
                ${this.renderInsurance(p)}

                <!-- Actions de bas de page -->
                <footer class="ice-actions-footer">
                    <button type="button" class="safety-btn ice-import-btn" data-action="IceimportToProfile">
                        <i class="ri-download-2-line" aria-hidden="true"></i> ${th('importToProfileBtn')}
                    </button>
                    <button type="button" class="safety-btn" data-action="IcegoToApp">
                        <i class="ri-home-4-line" aria-hidden="true"></i> ${th('openAppBtn')}
                    </button>
                </footer>
            </div>
        `;
    }

    /** @param {Partial<import('../services/ice_service.js').IceProfile>} p */
    renderContacts(p) {
        const callingCode = callingCodeForCountry(p.pays);
        const c1Phone = toInternationalPhone(p.contact1Phone, callingCode);
        const c2Phone = toInternationalPhone(p.contact2Phone, callingCode);

        if (!c1Phone && !c2Phone) {
            return `<p class="ice-empty-hint">${th('noContacts')}</p>`;
        }

        let html = '';
        if (c1Phone) {
            const rawLabel = p.contact1Name || tt('contact1Fallback');
            const label = esc(rawLabel);
            const rel = p.contact1Rel ? `<span class="ice-contact-rel">(${esc(p.contact1Rel)})</span>` : '';
            html += `
                <div class="ice-contact-item">
                    <div class="ice-contact-details">
                        <strong>${label}</strong> ${rel}
                        <span class="ice-contact-num">${esc(formatPhoneDisplay(c1Phone))}</span>
                    </div>
                    <a class="ice-call-action-btn" href="tel:${c1Phone}" aria-label="${th('callActionLabel', { name: rawLabel })}">
                        <i class="ri-phone-fill" aria-hidden="true"></i> ${th('callAction')}
                    </a>
                </div>
            `;
        }

        if (c2Phone) {
            const rawLabel = p.contact2Name || tt('contact2Fallback');
            const label = esc(rawLabel);
            const rel = p.contact2Rel ? `<span class="ice-contact-rel">(${esc(p.contact2Rel)})</span>` : '';
            html += `
                <div class="ice-contact-item">
                    <div class="ice-contact-details">
                        <strong>${label}</strong> ${rel}
                        <span class="ice-contact-num">${esc(formatPhoneDisplay(c2Phone))}</span>
                    </div>
                    <a class="ice-call-action-btn" href="tel:${c2Phone}" aria-label="${th('callActionLabel', { name: rawLabel })}">
                        <i class="ri-phone-fill" aria-hidden="true"></i> ${th('callAction')}
                    </a>
                </div>
            `;
        }

        return html;
    }

    /** @param {Partial<import('../services/ice_service.js').IceProfile>} p */
    renderMedical(p) {
        const rem = p.remarques || p.medical;
        if (!p.allergies && !rem && !p.anticoag && !p.tetanos) return '';

        return `
            <section class="ice-card ice-card-medical">
                <h3><i class="ri-heart-pulse-fill" aria-hidden="true"></i> ${th('medicalTitle')}</h3>
                ${
                    p.anticoag
                        ? `<div class="ice-medical-alert">
                            <strong><i class="ri-drop-fill" aria-hidden="true"></i> ${th('anticoagAlert')}</strong>
                        </div>`
                        : ''
                }
                ${
                    p.allergies
                        ? `<div class="ice-medical-alert">
                            <strong><i class="ri-error-warning-fill" aria-hidden="true"></i> ${th('allergiesLabel')}</strong>
                            <p>${esc(p.allergies)}</p>
                        </div>`
                        : ''
                }
                ${
                    rem
                        ? `<div class="ice-medical-info">
                            <strong>${th('historyLabel')}</strong>
                            <p>${esc(rem)}</p>
                        </div>`
                        : ''
                }
                ${
                    p.tetanos
                        ? `<div class="ice-medical-info">
                            <strong>${th('tetanosLabel')}</strong>
                            <p>${esc(p.tetanos)}</p>
                        </div>`
                        : ''
                }
            </section>
        `;
    }

    /** @param {Partial<import('../services/ice_service.js').IceProfile>} p */
    renderInsurance(p) {
        if (!p.ffvl && !p.insurance) return '';

        const licenceTitle = p.federation ? th('licenceWithFed', { fed: p.federation }) : th('licenceLabel');
        return `
            <section class="ice-card ice-card-federal">
                <h3><i class="ri-shield-fill" aria-hidden="true"></i> ${th('insuranceTitle')}</h3>
                <dl class="ice-dl-grid">
                    ${p.ffvl ? `<dt>${licenceTitle}</dt><dd><strong>${esc(p.ffvl)}</strong></dd>` : ''}
                    ${p.insurance ? `<dt>${th('insuranceLabel')}</dt><dd>${esc(p.insurance)}</dd>` : ''}
                </dl>
            </section>
        `;
    }

    // ------------------------------------------------------------------ Actions

    importToProfile() {
        if (!this.profile) return;
        // Ne jamais remplacer sa propre fiche par celle d'un autre sans le demander.
        const current = IceService.getProfile();
        const hasCurrent = Boolean(current.nom || current.prenom || current.contact1Phone);
        if (hasCurrent && !confirm(tt('confirmReplace'))) return;
        IceService.saveProfile(this.profile);
        alert(tt('savedAlert'));
    }

    goToApp() {
        AppRouter.navigate('WELCOME');
    }
}

const IceView = new IceViewClass();
export default IceView;
