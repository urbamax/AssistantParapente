/**
 * VIEW - Feedback Modal (spec 048)
 * Gère l'ouverture, la saisie, l'aperçu du contexte technique, la sauvegarde de brouillon,
 * la copie dans le presse-papiers et l'envoi via FeedbackService.
 */

import {
    FEEDBACK_LIMITS,
    clearFeedbackDraft,
    collectFeedbackContext,
    formatCopyPayload,
    formatTechnicalContext,
    getCategoryMeta,
    loadFeedbackDraft,
    saveFeedbackDraft,
    submitFeedback,
} from '../services/feedback_service.js';
import { t } from '../utils/i18n.js';

const CLOSE_TRANSITION_MS = 300;

function getElements() {
    return {
        modal: /** @type {(HTMLDialogElement & { _cancelBound?: boolean }) | null} */ (
            document.getElementById('feedback-modal')
        ),
        form: /** @type {(HTMLFormElement & { _feedbackSubmitBound?: boolean }) | null} */ (
            document.getElementById('feedback-form')
        ),
        helper: document.getElementById('feedback-category-helper'),
        subject: /** @type {HTMLInputElement | null} */ (document.getElementById('feedback-subject')),
        description: /** @type {HTMLTextAreaElement | null} */ (document.getElementById('feedback-description')),
        charCount: document.getElementById('feedback-description-count'),
        contact: /** @type {HTMLInputElement | null} */ (document.getElementById('feedback-contact')),
        includeContext: /** @type {HTMLInputElement | null} */ (document.getElementById('feedback-include-context')),
        contextPreview: document.getElementById('feedback-context-preview'),
        botcheck: /** @type {HTMLInputElement | null} */ (document.getElementById('feedback-botcheck')),
        status: document.getElementById('feedback-status'),
        submitBtn: /** @type {HTMLButtonElement | null} */ (document.getElementById('feedback-submit-btn')),
    };
}

function activeCategoryId() {
    const active = document.querySelector('#feedback-modal [data-feedback-category][aria-pressed="true"]');
    return active?.getAttribute('data-feedback-category') || 'bug';
}

function readFormDraft() {
    const els = getElements();
    return {
        category: activeCategoryId(),
        subject: els.subject ? els.subject.value : '',
        description: els.description ? els.description.value : '',
        contact: els.contact ? els.contact.value : '',
        includeContext: els.includeContext ? els.includeContext.checked : true,
    };
}

function applyCategorySelection(categoryId) {
    const meta = getCategoryMeta(categoryId);
    document.querySelectorAll('#feedback-modal [data-feedback-category]').forEach((btn) => {
        const isSelected = btn.getAttribute('data-feedback-category') === meta.id;
        btn.setAttribute('aria-pressed', String(isSelected));
    });

    const { helper, description } = getElements();
    if (helper) helper.textContent = t(meta.helpKey);
    if (description) description.placeholder = t(meta.placeholderKey);
}

function updateCharCounter() {
    const { description, charCount } = getElements();
    if (!charCount) return;
    const count = description ? description.value.length : 0;
    charCount.textContent = t('feedback.charCount', { count, max: FEEDBACK_LIMITS.DESCRIPTION_MAX });
}

function updateContextPreview(includeContext) {
    const { contextPreview } = getElements();
    if (!contextPreview) return;
    if (!includeContext) {
        contextPreview.hidden = true;
        return;
    }
    const ctx = collectFeedbackContext();
    contextPreview.textContent = formatTechnicalContext(ctx);
    contextPreview.hidden = false;
}

function applyDraftToDom(draft) {
    const els = getElements();
    applyCategorySelection(draft.category);
    if (els.subject) els.subject.value = draft.subject;
    if (els.description) els.description.value = draft.description;
    if (els.contact) els.contact.value = draft.contact;
    if (els.includeContext) els.includeContext.checked = draft.includeContext !== false;
    if (els.botcheck) els.botcheck.value = '';
    updateCharCounter();
    updateContextPreview(draft.includeContext !== false);
}

function setStatus(type, message) {
    const { status } = getElements();
    if (!status) return;
    if (!message) {
        status.textContent = '';
        status.hidden = true;
        delete status.dataset.statusType;
        return;
    }
    status.textContent = message;
    status.dataset.statusType = type;
    status.hidden = false;
}

async function writeClipboardText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        return;
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    const ok = typeof document.execCommand === 'function' && document.execCommand('copy');
    area.remove();
    if (!ok) {
        throw new Error('Clipboard unavailable');
    }
}

const FeedbackView = {
    open() {
        const { modal, form } = getElements();
        if (!modal) return;

        const draft = loadFeedbackDraft();
        applyDraftToDom(draft);
        setStatus('', '');

        if (!modal._cancelBound) {
            modal._cancelBound = true;
            modal.addEventListener('cancel', (e) => {
                e.preventDefault();
                this.close();
            });
        }
        if (form && !form._feedbackSubmitBound) {
            form._feedbackSubmitBound = true;
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submit();
            });
        }

        if (typeof modal.showModal === 'function' && !modal.open) {
            modal.showModal();
        }
        modal.style.display = 'flex';
        void modal.offsetWidth;
        modal.classList.add('active');
    },

    close() {
        const { modal } = getElements();
        if (!modal) return;
        modal.classList.remove('active');
        setTimeout(() => {
            if (!modal.classList.contains('active')) {
                if (typeof modal.close === 'function' && modal.open) {
                    modal.close();
                }
                modal.style.display = 'none';
            }
        }, CLOSE_TRANSITION_MS);
    },

    setCategory(categoryId) {
        const meta = getCategoryMeta(categoryId);
        applyCategorySelection(meta.id);
        saveFeedbackDraft(readFormDraft());
        setStatus('', '');
    },

    onFieldInput() {
        const draft = readFormDraft();
        saveFeedbackDraft(draft);
        updateCharCounter();
    },

    onFieldChange() {
        const draft = readFormDraft();
        saveFeedbackDraft(draft);
        updateContextPreview(draft.includeContext);
    },

    async submit(options = {}) {
        const els = getElements();
        const rawDraft = {
            ...readFormDraft(),
            botcheck: els.botcheck ? els.botcheck.value : '',
        };

        if (els.submitBtn) els.submitBtn.disabled = true;
        setStatus('info', t('feedback.statusSending'));

        try {
            const result = await submitFeedback(rawDraft, {
                ...options,
                context: options.context || collectFeedbackContext(),
            });

            if (result.ok) {
                applyDraftToDom({
                    category: 'bug',
                    subject: '',
                    description: '',
                    contact: '',
                    includeContext: true,
                });
                setStatus('success', t('feedback.statusSent'));
                return result;
            }

            const statusType =
                result.reason === 'offline' || result.reason === 'unconfigured' || result.reason === 'network'
                    ? 'warning'
                    : 'error';
            setStatus(statusType, result.message);

            if (result.reason === 'validation') {
                if (result.errors?.subject && els.subject) els.subject.focus();
                else if (result.errors?.description && els.description) els.description.focus();
                else if (result.errors?.contact && els.contact) els.contact.focus();
            }
            return result;
        } finally {
            if (els.submitBtn) els.submitBtn.disabled = false;
        }
    },

    async copyMessage() {
        const draft = readFormDraft();
        const text = formatCopyPayload(draft, collectFeedbackContext());
        try {
            await writeClipboardText(text);
            setStatus('success', t('feedback.statusCopied'));
        } catch {
            setStatus('error', t('feedback.errCopyFailed'));
        }
    },

    resetForm() {
        clearFeedbackDraft();
        applyDraftToDom({
            category: 'bug',
            subject: '',
            description: '',
            contact: '',
            includeContext: true,
        });
        setStatus('info', t('feedback.statusReset'));
    },
};

export default FeedbackView;
