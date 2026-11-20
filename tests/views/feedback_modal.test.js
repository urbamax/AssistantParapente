import { describe, it, expect, beforeEach, vi } from 'vitest';
import GlobalState from '../../js/core/app_state.js';
import StorageService from '../../js/services/storage.js';
import FeedbackView from '../../js/views/feedback.js';

function renderModalDOM() {
    document.body.innerHTML = `
        <dialog id="feedback-modal" class="gdpr-modal-overlay" data-backdrop-action="closeFeedbackModal" style="display: none">
            <div class="gdpr-modal feedback-modal-box">
                <div class="gdpr-modal-header">
                    <div class="gdpr-modal-title">Signaler un problème / Suggestion</div>
                    <button type="button" class="gdpr-modal-close-btn" data-action="closeFeedbackModal" aria-label="Fermer">×</button>
                </div>
                <div class="gdpr-modal-body feedback-modal-body">
                    <form id="feedback-form" novalidate>
                        <div id="feedback-categories">
                            <button type="button" class="feedback-category-btn" data-action="setFeedbackCategory" data-args="bug" data-feedback-category="bug" aria-pressed="true">Bug</button>
                            <button type="button" class="feedback-category-btn" data-action="setFeedbackCategory" data-args="qcm_course" data-feedback-category="qcm_course" aria-pressed="false">QCM</button>
                            <button type="button" class="feedback-category-btn" data-action="setFeedbackCategory" data-args="site_weather" data-feedback-category="site_weather" aria-pressed="false">Sites</button>
                            <button type="button" class="feedback-category-btn" data-action="setFeedbackCategory" data-args="suggestion" data-feedback-category="suggestion" aria-pressed="false">Suggestion</button>
                            <button type="button" class="feedback-category-btn" data-action="setFeedbackCategory" data-args="other" data-feedback-category="other" aria-pressed="false">Autre</button>
                        </div>
                        <p id="feedback-category-helper"></p>
                        <input id="feedback-subject" type="text" maxlength="120" data-input-action="feedbackFieldInput" />
                        <textarea id="feedback-description" maxlength="3000" required data-input-action="feedbackFieldInput"></textarea>
                        <span id="feedback-description-count"></span>
                        <input id="feedback-contact" type="text" maxlength="120" data-input-action="feedbackFieldInput" />
                        <input id="feedback-include-context" type="checkbox" checked data-change-action="feedbackFieldChange" />
                        <pre id="feedback-context-preview"></pre>
                        <div class="feedback-honeypot" aria-hidden="true">
                            <input id="feedback-botcheck" type="text" tabindex="-1" autocomplete="off" />
                        </div>
                        <div id="feedback-status" role="status" aria-live="polite" hidden></div>
                    </form>
                </div>
                <div class="gdpr-modal-footer feedback-modal-footer">
                    <button type="button" id="feedback-reset-btn" data-action="resetFeedbackForm">Effacer le brouillon</button>
                    <button type="button" id="feedback-copy-btn" data-action="copyFeedbackMessage">Copier le message</button>
                    <button type="button" id="feedback-submit-btn" data-action="submitFeedback">Envoyer</button>
                    <a id="feedback-facebook-link" href="https://www.facebook.com/maxime.urbaniak/" target="_blank" rel="noopener noreferrer">Facebook</a>
                </div>
            </div>
        </dialog>
    `;
}

describe('FeedbackView modal', () => {
    beforeEach(() => {
        localStorage.clear();
        GlobalState.state.mode = 'MENU';
        GlobalState.state.level = 'BP';
        GlobalState.state.themeMode = 'dark';
        renderModalDOM();
    });

    it('opens the modal, populates context preview, and restores any saved draft', () => {
        StorageService.set(StorageService.KEYS.FEEDBACK_DRAFT, {
            category: 'qcm_course',
            subject: 'Question MTO',
            description: 'Une faute de frappe dans l explication de cette question.',
            contact: 'pilote@example.fr',
            includeContext: true,
        });

        FeedbackView.open();

        const modal = document.getElementById('feedback-modal');
        expect(modal.classList.contains('active')).toBe(true);
        expect(modal.style.display).toBe('flex');
        expect(document.getElementById('feedback-subject').value).toBe('Question MTO');
        expect(document.getElementById('feedback-description').value).toContain('faute de frappe');
        expect(document.getElementById('feedback-contact').value).toBe('pilote@example.fr');
        expect(document.querySelector('[data-feedback-category="qcm_course"]').getAttribute('aria-pressed')).toBe(
            'true',
        );
        expect(document.getElementById('feedback-category-helper').textContent.length).toBeGreaterThan(5);
        expect(document.getElementById('feedback-context-preview').textContent).toContain('MENU');
        expect(document.getElementById('feedback-context-preview').textContent).toContain('BP');
    });

    it('updates category helper, persists field inputs, and hides context preview when unchecked', () => {
        FeedbackView.open();
        FeedbackView.setCategory('suggestion');

        expect(document.querySelector('[data-feedback-category="suggestion"]').getAttribute('aria-pressed')).toBe(
            'true',
        );
        const sugHelper = document.getElementById('feedback-category-helper').textContent;

        FeedbackView.setCategory('site_weather');
        expect(document.getElementById('feedback-category-helper').textContent).not.toBe(sugHelper);

        document.getElementById('feedback-subject').value = 'Ajout balise';
        document.getElementById('feedback-description').value = 'Merci d ajouter la balise voisine.';
        document.getElementById('feedback-include-context').checked = false;
        FeedbackView.onFieldChange();

        const preview = document.getElementById('feedback-context-preview');
        expect(preview.hidden).toBe(true);

        const saved = StorageService.get(StorageService.KEYS.FEEDBACK_DRAFT);
        expect(saved.category).toBe('site_weather');
        expect(saved.subject).toBe('Ajout balise');
        expect(saved.includeContext).toBe(false);
    });

    it('shows validation error when description is too short without clearing draft', async () => {
        FeedbackView.open();
        document.getElementById('feedback-description').value = 'Court';
        FeedbackView.onFieldInput();

        const res = await FeedbackView.submit({
            config: { web3FormsAccessKey: 'test-key', customEndpoint: '' },
        });
        expect(res.ok).toBe(false);
        const status = document.getElementById('feedback-status');
        expect(status.hidden).toBe(false);
        expect(status.dataset.statusType).toBe('error');
        expect(StorageService.get(StorageService.KEYS.FEEDBACK_DRAFT).description).toBe('Court');
    });

    it('copies formatted message to clipboard and handles resetForm cleanly', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        });

        FeedbackView.open();
        document.getElementById('feedback-subject').value = 'Export IGC';
        document.getElementById('feedback-description').value = 'Le graphe vario coupe la dernière minute.';
        FeedbackView.onFieldInput();

        await FeedbackView.copyMessage();
        expect(writeText).toHaveBeenCalledTimes(1);
        expect(writeText.mock.calls[0][0]).toContain('Export IGC');
        expect(writeText.mock.calls[0][0]).toContain('graphe vario');
        expect(document.getElementById('feedback-status').dataset.statusType).toBe('success');

        FeedbackView.resetForm();
        expect(document.getElementById('feedback-description').value).toBe('');
        expect(document.getElementById('feedback-subject').value).toBe('');
        expect(localStorage.getItem(StorageService.KEYS.FEEDBACK_DRAFT)).toBeNull();
    });

    it('submits through configured endpoint, clears form and draft on success, and closes modal', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
        });

        FeedbackView.open();
        document.getElementById('feedback-subject').value = 'Test complet';
        document.getElementById('feedback-description').value = 'Tout fonctionne bien sauf ce détail précis.';
        FeedbackView.onFieldInput();

        const res = await FeedbackView.submit({
            config: { web3FormsAccessKey: 'test-key-uuid', customEndpoint: '' },
            fetchImpl: fetchMock,
            online: true,
        });

        expect(res.ok).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(document.getElementById('feedback-description').value).toBe('');
        expect(document.getElementById('feedback-status').dataset.statusType).toBe('success');
        expect(localStorage.getItem(StorageService.KEYS.FEEDBACK_DRAFT)).toBeNull();

        FeedbackView.close();
        expect(document.getElementById('feedback-modal').classList.contains('active')).toBe(false);
    });
});
