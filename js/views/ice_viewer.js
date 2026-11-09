/**
 * VIEW - IceViewer
 * Écran « Fiche d'urgence & Secours (ICE) » en LECTURE SEULE.
 *
 * Affiché immédiatement quand un témoin ou un secouriste scanne le QR code du casque/sellette.
 * Accessible à tous sans connexion requise, lit directement les données encodées dans le QR code.
 */

import BaseView from '../core/base_view.js';
import { decodePayload, sanitizePhone, formatPhoneDisplay, IceService } from '../services/ice_service.js';
import { escapeHTML } from '../core/security.js';
import AppRouter from '../core/router.js';

const esc = (text) => escapeHTML(text || '');

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
        const fullName = `${p.prenom || ''} ${p.nom || ''}`.trim() || 'Pilote non renseigné';

        // Calcul indicatif de l'âge
        let ageText = '';
        if (p.birthYear && /^\d{4}$/.test(p.birthYear)) {
            const currentYear = new Date().getFullYear();
            const age = currentYear - parseInt(p.birthYear, 10);
            if (age > 0 && age < 120) {
                ageText = `(${age} ans · né en ${esc(p.birthYear)})`;
            }
        }

        const bloodBadge =
            p.bloodGroup && p.bloodGroup !== 'Inconnu'
                ? `<div class="ice-blood-badge" aria-label="Groupe sanguin : ${esc(p.bloodGroup)}">
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
                        <h1>URGENCE PILOTE · ICE</h1>
                    </div>
                    <p class="ice-banner-subtitle">In Case of Emergency · Données médicales et contacts de secours</p>
                </header>

                <!-- Identité & Groupe sanguin -->
                <section class="ice-card ice-card-identity">
                    <div class="ice-identity-layout">
                        <div class="ice-identity-info">
                            <span class="ice-badge-pilot">Pilote</span>
                            <h2 class="ice-pilot-name">${esc(fullName)}</h2>
                            ${ageText ? `<p class="ice-pilot-age">${ageText}</p>` : ''}
                        </div>
                        ${bloodBadge}
                    </div>
                </section>

                <!-- Boutons d'appel direct contacts d'urgence -->
                <section class="ice-card ice-card-contacts">
                    <h3><i class="ri-contacts-fill" aria-hidden="true"></i> Personnes à contacter</h3>
                    ${this.renderContacts(p)}
                </section>

                <!-- Données médicales vitales -->
                ${this.renderMedical(p)}

                <!-- Infos fédérales & Assurance -->
                ${this.renderInsurance(p)}

                <!-- Rappel secours d'urgence -->
                <section class="ice-card ice-card-emergency-actions">
                    <div class="ice-emergency-grid">
                        <a class="safety-call-btn" href="tel:112">
                            <i class="ri-phone-fill" aria-hidden="true"></i>
                            <span><strong>Appeler le 112</strong><small>Numéro d'urgence européen</small></span>
                        </a>
                        <div class="safety-frequency" aria-label="Fréquence sécurité FFVL">
                            <i class="ri-broadcast-line" aria-hidden="true"></i>
                            <span><strong>143,9875 MHz</strong><small>Fréquence sécurité FFVL / Secours</small></span>
                        </div>
                    </div>
                </section>

                <!-- Actions de bas de page -->
                <footer class="ice-actions-footer">
                    <button type="button" class="btn btn-secondary ice-import-btn" data-action="IceimportToProfile">
                        <i class="ri-download-2-line" aria-hidden="true"></i> Enregistrer cette fiche dans mon profil
                    </button>
                    <button type="button" class="btn btn-outline" data-action="IcegoToApp">
                        <i class="ri-home-4-line" aria-hidden="true"></i> Ouvrir l'application
                    </button>
                </footer>
            </div>
        `;
    }

    /** @param {Partial<import('../services/ice_service.js').IceProfile>} p */
    renderContacts(p) {
        const c1Phone = sanitizePhone(p.contact1Phone);
        const c2Phone = sanitizePhone(p.contact2Phone);

        if (!c1Phone && !c2Phone) {
            return `<p class="ice-empty-hint">Aucun contact d'urgence renseigné.</p>`;
        }

        let html = '';
        if (c1Phone) {
            const label = p.contact1Name ? esc(p.contact1Name) : 'Contact d’urgence 1';
            const rel = p.contact1Rel ? `<span class="ice-contact-rel">(${esc(p.contact1Rel)})</span>` : '';
            html += `
                <div class="ice-contact-item">
                    <div class="ice-contact-details">
                        <strong>${label}</strong> ${rel}
                        <span class="ice-contact-num">${esc(formatPhoneDisplay(p.contact1Phone))}</span>
                    </div>
                    <a class="ice-call-action-btn" href="tel:${c1Phone}" aria-label="Appeler ${label}">
                        <i class="ri-phone-fill" aria-hidden="true"></i> Appeler
                    </a>
                </div>
            `;
        }

        if (c2Phone) {
            const label = p.contact2Name ? esc(p.contact2Name) : 'Contact d’urgence 2';
            const rel = p.contact2Rel ? `<span class="ice-contact-rel">(${esc(p.contact2Rel)})</span>` : '';
            html += `
                <div class="ice-contact-item">
                    <div class="ice-contact-details">
                        <strong>${label}</strong> ${rel}
                        <span class="ice-contact-num">${esc(formatPhoneDisplay(p.contact2Phone))}</span>
                    </div>
                    <a class="ice-call-action-btn" href="tel:${c2Phone}" aria-label="Appeler ${label}">
                        <i class="ri-phone-fill" aria-hidden="true"></i> Appeler
                    </a>
                </div>
            `;
        }

        return html;
    }

    /** @param {Partial<import('../services/ice_service.js').IceProfile>} p */
    renderMedical(p) {
        const rem = p.remarques || p.medical;
        if (!p.allergies && !rem) return '';

        return `
            <section class="ice-card ice-card-medical">
                <h3><i class="ri-heart-pulse-fill" aria-hidden="true"></i> Santé & Alertes Médicales</h3>
                ${
                    p.allergies
                        ? `<div class="ice-medical-alert">
                            <strong><i class="ri-error-warning-fill" aria-hidden="true"></i> Allergies / Contre-indications :</strong>
                            <p>${esc(p.allergies)}</p>
                        </div>`
                        : ''
                }
                ${
                    rem
                        ? `<div class="ice-medical-info">
                            <strong>Antécédents / Traitements en cours :</strong>
                            <p>${esc(rem)}</p>
                        </div>`
                        : ''
                }
            </section>
        `;
    }

    /** @param {Partial<import('../services/ice_service.js').IceProfile>} p */
    renderInsurance(p) {
        if (!p.ffvl && !p.insurance) return '';

        return `
            <section class="ice-card ice-card-federal">
                <h3><i class="ri-shield-fill" aria-hidden="true"></i> Assurance & Licence</h3>
                <dl class="ice-dl-grid">
                    ${p.ffvl ? `<dt>Licence FFVL</dt><dd><strong>${esc(p.ffvl)}</strong></dd>` : ''}
                    ${p.insurance ? `<dt>Assurance / Rapatriement</dt><dd>${esc(p.insurance)}</dd>` : ''}
                </dl>
            </section>
        `;
    }

    // ------------------------------------------------------------------ Actions

    importToProfile() {
        if (!this.profile) return;
        IceService.saveProfile(this.profile);
        alert('Fiche d’urgence enregistrée avec succès dans votre profil sur cet appareil.');
    }

    goToApp() {
        AppRouter.navigate('WELCOME');
    }
}

const IceView = new IceViewClass();
export default IceView;
