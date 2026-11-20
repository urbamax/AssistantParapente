import { describe, it, expect, beforeEach, vi } from 'vitest';
import GlobalState from '../../js/core/app_state.js';
import StorageService from '../../js/services/storage.js';
import {
    FEEDBACK_CATEGORIES,
    FEEDBACK_LIMITS,
    WEB3FORMS_ENDPOINT,
    getCategoryMeta,
    isValidEmail,
    validateFeedback,
    collectFeedbackContext,
    formatTechnicalContext,
    formatCopyPayload,
    loadFeedbackDraft,
    saveFeedbackDraft,
    clearFeedbackDraft,
    isSubmissionConfigured,
    submitFeedback,
} from '../../js/services/feedback_service.js';

describe('FeedbackService', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.innerHTML = '';
        document.documentElement.removeAttribute('data-app-version');
        GlobalState.state.mode = 'MENU';
        GlobalState.state.level = 'ALL';
        GlobalState.state.themeMode = 'auto';
    });

    it('exposes all five feedback categories with i18n keys and verified icons', () => {
        expect(FEEDBACK_CATEGORIES.map((c) => c.id)).toEqual([
            'bug',
            'qcm_course',
            'site_weather',
            'suggestion',
            'other',
        ]);
        for (const cat of FEEDBACK_CATEGORIES) {
            expect(cat.icon).toMatch(/^ri-/);
            expect(cat.labelKey).toMatch(/^feedback\./);
            expect(cat.helpKey).toMatch(/^feedback\./);
            expect(cat.placeholderKey).toMatch(/^feedback\./);
        }
        expect(getCategoryMeta('unknown_id').id).toBe('bug');
        expect(getCategoryMeta('suggestion').id).toBe('suggestion');
    });

    it('validates email addresses accurately without rejecting handles in contact', () => {
        expect(isValidEmail('pilote@example.com')).toBe(true);
        expect(isValidEmail('jean.dupont+ffvl@club-aire.fr')).toBe(true);
        expect(isValidEmail('')).toBe(false);
        expect(isValidEmail('@pseudo_fb')).toBe(false);
        expect(isValidEmail('pilote@localhost')).toBe(false);
        expect(isValidEmail('pilote @example.com')).toBe(false);
    });

    it('validates description bounds, subject length and contact length', () => {
        const emptyResult = validateFeedback({
            category: 'bug',
            subject: '',
            description: '123456789',
            contact: '',
        });
        expect(emptyResult.valid).toBe(false);
        expect(emptyResult.errors.description).toBeTruthy();

        const exactMin = '1234567890';
        expect(
            validateFeedback({
                category: 'bug',
                subject: '',
                description: exactMin,
                contact: '',
            }).valid,
        ).toBe(true);

        const tooLongDesc = 'a'.repeat(FEEDBACK_LIMITS.DESCRIPTION_MAX + 1);
        expect(
            validateFeedback({
                category: 'suggestion',
                subject: 'Ok',
                description: tooLongDesc,
                contact: '@pseudo_fb',
            }).valid,
        ).toBe(false);

        const tooLongSubject = 'a'.repeat(FEEDBACK_LIMITS.SUBJECT_MAX + 1);
        expect(
            validateFeedback({
                category: 'suggestion',
                subject: tooLongSubject,
                description: 'Description valide et suffisamment détaillée.',
                contact: '',
            }).valid,
        ).toBe(false);

        const tooLongContact = 'a'.repeat(FEEDBACK_LIMITS.CONTACT_MAX + 1);
        expect(
            validateFeedback({
                category: 'suggestion',
                subject: 'Ok',
                description: 'Description valide et suffisamment détaillée.',
                contact: tooLongContact,
            }).valid,
        ).toBe(false);
    });

    it('collects strictly non-personal context across screens and never leaks personal data', () => {
        StorageService.set(StorageService.KEYS.LOGBOOK_DATA, [
            { date: '2026-07-12', site: 'Dune du Pilat secret', note: 'Vol perso confidentiel' },
        ]);
        StorageService.set(StorageService.KEYS.USER_PREFS, { iceName: 'Alice', icePhone: '0600000000' });

        document.documentElement.dataset.appVersion = 'abc1234567';
        GlobalState.state.mode = 'QCM';
        GlobalState.state.level = 'BP';
        GlobalState.state.themeMode = 'dark';
        document.body.innerHTML = `
            <div id="qcm-screen" class="mode-screen active">
                <div id="qcm-question-text"><span class="bank-item-code">Q-AERO-042</span> Question ?</div>
            </div>
        `;

        const ctxQcm = collectFeedbackContext({
            doc: document,
            width: 390,
            height: 844,
            standalone: true,
            online: true,
        });
        expect(ctxQcm.version).toBe('abc1234567');
        expect(ctxQcm.screen).toBe('QCM');
        expect(ctxQcm.level).toBe('BP');
        expect(ctxQcm.theme).toBe('dark');
        expect(ctxQcm.viewport).toBe('390x844');
        expect(ctxQcm.detail).toContain('Q-AERO-042');

        const serialized = JSON.stringify(ctxQcm) + formatTechnicalContext(ctxQcm);
        expect(serialized).not.toContain('Dune du Pilat secret');
        expect(serialized).not.toContain('Alice');
        expect(serialized).not.toContain('0600000000');

        GlobalState.state.mode = 'SITES';
        document.body.innerHTML = `
            <div id="sites-screen" class="mode-screen active">
                <details class="site-details-toggle" data-site-id="site-annecy-forclaz" open></details>
            </div>
        `;
        const ctxSites = collectFeedbackContext({ doc: document, width: 1280, height: 800, standalone: false });
        expect(ctxSites.detail).toContain('site-annecy-forclaz');

        GlobalState.state.mode = 'LOGBOOK';
        document.body.innerHTML = `
            <div id="logbook-screen" class="active">
                <button data-logbook-tab="stats" aria-current="true">Stats</button>
            </div>
        `;
        const ctxLogbook = collectFeedbackContext({ doc: document, width: 1280, height: 800, standalone: false });
        expect(ctxLogbook.detail).toContain('stats');

        GlobalState.state.mode = 'SAFETY';
        document.body.innerHTML = `
            <div id="safety-screen" class="active">
                <button data-safety-tab="prevol" aria-current="true">Pré-vol</button>
            </div>
        `;
        const ctxSafety = collectFeedbackContext({ doc: document, width: 1280, height: 800, standalone: false });
        expect(ctxSafety.detail).toContain('prevol');
    });

    it('formats copy payload with or without technical context based on user toggle', () => {
        const ctx = {
            version: '123456',
            screen: 'QCM',
            level: 'BP',
            theme: 'auto',
            viewport: '1024x768',
            runtime: 'Navigateur',
            network: 'En ligne',
            detail: 'Q-MTO-101',
        };
        const withCtx = formatCopyPayload(
            {
                category: 'qcm_course',
                subject: 'Réponse ambiguë',
                description: 'La question Q-MTO-101 semble avoir deux réponses valides.',
                contact: 'pilote@club.fr',
                includeContext: true,
            },
            ctx,
        );
        expect(withCtx).toContain('Réponse ambiguë');
        expect(withCtx).toContain('Q-MTO-101');
        expect(withCtx).toContain('1024x768');
        expect(withCtx).toContain('pilote@club.fr');

        const withoutCtx = formatCopyPayload(
            {
                category: 'qcm_course',
                subject: 'Réponse ambiguë',
                description: 'Description détaillée sans contexte technique.',
                contact: '',
                includeContext: false,
            },
            ctx,
        );
        expect(withoutCtx).not.toContain('1024x768');
        expect(withoutCtx).not.toContain('Q-MTO-101');
    });

    it('saves, loads and clears local feedback drafts', () => {
        expect(loadFeedbackDraft()).toEqual({
            category: 'bug',
            subject: '',
            description: '',
            contact: '',
            includeContext: true,
        });

        saveFeedbackDraft({
            category: 'site_weather',
            subject: 'Balise erronée',
            description: 'La balise pointe un mauvais secteur.',
            contact: '@monpseudo',
            includeContext: false,
        });

        expect(loadFeedbackDraft()).toEqual({
            category: 'site_weather',
            subject: 'Balise erronée',
            description: 'La balise pointe un mauvais secteur.',
            contact: '@monpseudo',
            includeContext: false,
        });

        clearFeedbackDraft();
        expect(localStorage.getItem(StorageService.KEYS.FEEDBACK_DRAFT)).toBeNull();
    });

    it('skips network submission when honeypot is filled, offline, or unconfigured', async () => {
        const fetchMock = vi.fn();

        const botRes = await submitFeedback(
            {
                category: 'bug',
                subject: 'Bot',
                description: 'Message automatisé assez long.',
                contact: '',
                includeContext: true,
                botcheck: 'http://spam.example',
            },
            {
                config: { web3FormsAccessKey: 'valid-key', customEndpoint: '' },
                fetchImpl: fetchMock,
                online: true,
            },
        );
        expect(botRes).toMatchObject({ ok: true, skipped: true });
        expect(fetchMock).not.toHaveBeenCalled();

        saveFeedbackDraft({
            category: 'bug',
            subject: 'Bug hors ligne',
            description: 'Erreur rencontrée en mode hors ligne.',
            contact: '',
            includeContext: true,
        });

        const offlineRes = await submitFeedback(loadFeedbackDraft(), {
            config: { web3FormsAccessKey: 'valid-key', customEndpoint: '' },
            fetchImpl: fetchMock,
            online: false,
        });
        expect(offlineRes).toMatchObject({ ok: false, reason: 'offline' });
        expect(fetchMock).not.toHaveBeenCalled();
        expect(localStorage.getItem(StorageService.KEYS.FEEDBACK_DRAFT)).not.toBeNull();

        expect(isSubmissionConfigured({ web3FormsAccessKey: '', customEndpoint: '' })).toBe(false);
        const unconfiguredRes = await submitFeedback(loadFeedbackDraft(), {
            config: { web3FormsAccessKey: '', customEndpoint: '' },
            fetchImpl: fetchMock,
            online: true,
        });
        expect(unconfiguredRes).toMatchObject({ ok: false, reason: 'unconfigured' });
        expect(fetchMock).not.toHaveBeenCalled();
        expect(localStorage.getItem(StorageService.KEYS.FEEDBACK_DRAFT)).not.toBeNull();
    });

    it('posts JSON to Web3Forms on valid submit, sets replyto only for emails, and clears draft on success', async () => {
        saveFeedbackDraft({
            category: 'suggestion',
            subject: 'Filtre altitude',
            description: 'Ajouter un filtre par altitude de décollage dans Sites.',
            contact: 'pilote@example.org',
            includeContext: true,
        });

        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: true, message: 'Email sent' }),
        });

        const res = await submitFeedback(loadFeedbackDraft(), {
            config: { web3FormsAccessKey: '00000000-0000-0000-0000-000000000000', customEndpoint: '' },
            fetchImpl: fetchMock,
            online: true,
            context: {
                version: 'vtest',
                screen: 'SITES',
                level: 'BP',
                theme: 'dark',
                viewport: '1200x800',
                runtime: 'Navigateur',
                network: 'En ligne',
                detail: '',
            },
        });

        expect(res).toMatchObject({ ok: true });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(WEB3FORMS_ENDPOINT);
        expect(init.method).toBe('POST');
        expect(init.headers['Content-Type']).toBe('application/json');

        const sentBody = JSON.parse(init.body);
        expect(sentBody.access_key).toBe('00000000-0000-0000-0000-000000000000');
        expect(sentBody.subject).toContain('Filtre altitude');
        expect(sentBody.replyto).toBe('pilote@example.org');
        expect(sentBody.message).toContain('Ajouter un filtre par altitude');
        expect(sentBody.botcheck).toBe('');
        expect(localStorage.getItem(StorageService.KEYS.FEEDBACK_DRAFT)).toBeNull();
    });

    it('omits replyto for non-email contact handles and preserves draft when API fails', async () => {
        saveFeedbackDraft({
            category: 'other',
            subject: '',
            description: 'Merci pour cette application très utile en club.',
            contact: '@max_para',
            includeContext: false,
        });

        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 502,
            json: async () => ({ success: false, message: 'Bad Gateway' }),
        });

        const res = await submitFeedback(loadFeedbackDraft(), {
            config: { web3FormsAccessKey: '00000000-0000-0000-0000-000000000000', customEndpoint: '' },
            fetchImpl: fetchMock,
            online: true,
        });

        expect(res).toMatchObject({ ok: false, reason: 'server' });
        const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(sentBody.replyto).toBeUndefined();
        expect(sentBody.message).toContain('@max_para');
        expect(localStorage.getItem(StorageService.KEYS.FEEDBACK_DRAFT)).not.toBeNull();
    });
});
