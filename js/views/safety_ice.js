/**
 * VIEW - Safety ICE (Fiche d'urgence & Étiquette Casque)
 * Sous-module de SafetyView pour la gestion de la fiche ICE et de l'étiquette casque.
 */

import IceService, { BLOOD_GROUPS } from '../services/ice_service.js';
import { escapeHTML } from '../core/security.js';
import AppRouter from '../core/router.js';

const esc = (text) => escapeHTML(text || '');

export function renderIceSticker(profile) {
    const p = profile || IceService.getProfile();
    const fullName = `${p.prenom || ''} ${p.nom || ''}`.trim() || 'Pilote';
    const phone = p.contact1Phone ? esc(p.contact1Phone) : '112 / Secours';
    const contactLabel = p.contact1Name ? esc(p.contact1Name) : 'Contact';
    const blood = p.bloodGroup && p.bloodGroup !== 'Inconnu' ? ` · 🩸 ${esc(p.bloodGroup)}` : '';
    const qrSvg = IceService.generateQrSvg(p, { size: 140, border: 1 });

    return `
        <div class="ice-helmet-sticker" id="ice-helmet-sticker">
            <div class="ice-sticker-header">
                <span class="ice-sticker-cross">➕</span>
                <span class="ice-sticker-title">ICE · SECOURS</span>
                <span class="ice-sticker-ffvl">143.9875 MHz</span>
            </div>
            <div class="ice-sticker-body">
                <div class="ice-sticker-qr">${qrSvg}</div>
                <div class="ice-sticker-meta">
                    <div class="ice-sticker-pilot">${esc(fullName)}${blood}</div>
                    <div class="ice-sticker-contact">ICE : ${contactLabel}</div>
                    <div class="ice-sticker-phone">${phone}</div>
                    <div class="ice-sticker-scan">SCAN EN CAS D'URGENCE</div>
                </div>
            </div>
        </div>
    `;
}

export function renderIceTabHtml() {
    const p = IceService.getProfile();
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
                vos proches et connaître vos données médicales vitales, sans application ni connexion requise.
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
                            <input type="text" id="ice-prenom" value="${esc(p.prenom)}" placeholder="Ex: Thomas" />
                        </label>
                        <label>Nom
                            <input type="text" id="ice-nom" value="${esc(p.nom)}" placeholder="Ex: Dupont" />
                        </label>
                    </div>
                    <div class="ice-form-row">
                        <label>Année de naissance
                            <input type="number" id="ice-birthYear" value="${esc(p.birthYear)}" placeholder="Ex: 1988" min="1920" max="2025" />
                        </label>
                    </div>
                </fieldset>

                <fieldset class="ice-fieldset">
                    <legend>Contact d'urgence 1 (Prioritaire)</legend>
                    <div class="ice-form-row ice-form-row-2">
                        <label>Nom du contact
                            <input type="text" id="ice-c1-name" value="${esc(p.contact1Name)}" placeholder="Ex: Sophie" />
                        </label>
                        <label>Lien / Parenté
                            <input type="text" id="ice-c1-rel" value="${esc(p.contact1Rel)}" placeholder="Ex: Conjointe" />
                        </label>
                    </div>
                    <div class="ice-form-row">
                        <label>Téléphone d'urgence *
                            <input type="tel" id="ice-c1-phone" value="${esc(p.contact1Phone)}" placeholder="Ex: 06 12 34 56 78" />
                        </label>
                    </div>
                </fieldset>

                <fieldset class="ice-fieldset">
                    <legend>Contact d'urgence 2 (Optionnel)</legend>
                    <div class="ice-form-row ice-form-row-2">
                        <label>Nom du contact
                            <input type="text" id="ice-c2-name" value="${esc(p.contact2Name)}" placeholder="Ex: Pierre" />
                        </label>
                        <label>Lien / Parenté
                            <input type="text" id="ice-c2-rel" value="${esc(p.contact2Rel)}" placeholder="Ex: Frère / Ami" />
                        </label>
                    </div>
                    <div class="ice-form-row">
                        <label>Téléphone
                            <input type="tel" id="ice-c2-phone" value="${esc(p.contact2Phone)}" placeholder="Ex: 06 98 76 54 32" />
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
                            <input type="text" id="ice-allergies" value="${esc(p.allergies)}" placeholder="Ex: Pénicilline, aspirine, asthme..." />
                        </label>
                    </div>
                    <div class="ice-form-row">
                        <label>Antécédents / Traitements réguliers
                            <input type="text" id="ice-remarques" value="${esc(p.remarques || p.medical)}" placeholder="Ex: Diabète, anticoagulant..." />
                        </label>
                    </div>
                </fieldset>

                <fieldset class="ice-fieldset">
                    <legend>Informations Fédérales &amp; Assurance</legend>
                    <div class="ice-form-row ice-form-row-2">
                        <label>N° Licence FFVL
                            <input type="text" id="ice-ffvl" value="${esc(p.ffvl)}" placeholder="Ex: 1234567" />
                        </label>
                        <label>Assurance assistance / Rapatriement
                            <input type="text" id="ice-insurance" value="${esc(p.insurance)}" placeholder="Ex: Europ Assistance FFVL" />
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
        birthYear: val('ice-birthYear'),
        contact1Name: val('ice-c1-name'),
        contact1Rel: val('ice-c1-rel'),
        contact1Phone: val('ice-c1-phone'),
        contact2Name: val('ice-c2-name'),
        contact2Rel: val('ice-c2-rel'),
        contact2Phone: val('ice-c2-phone'),
        bloodGroup: val('ice-bloodGroup'),
        allergies: val('ice-allergies'),
        remarques: val('ice-remarques'),
        ffvl: val('ice-ffvl'),
        insurance: val('ice-insurance'),
    };
}

export function saveIceProfile() {
    const values = getIceFormValues();
    IceService.saveProfile(values);
    updateIceStickerPreview(values);
    alert('Fiche d’urgence enregistrée dans votre profil ! Votre étiquette casque a été mise à jour.');
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
        wrapper.innerHTML = renderIceSticker(values);
    }
}

export function printIceSticker() {
    const values = getIceFormValues();
    IceService.saveProfile(values);
    updateIceStickerPreview(values);
    window.print();
}

export function testIceView() {
    const values = getIceFormValues();
    IceService.saveProfile(values);
    const payload = IceService.encodePayload(values);
    window.location.hash = '#' + payload;
    AppRouter.navigate('ICE');
}
