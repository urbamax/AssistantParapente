// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Ces zones changent de texte après une action (réponse au QCM, statut GPS, synchro, fichier IGC
// chargé) : sans région live, un lecteur d'écran n'annonce rien.
const SOURCES = ['index.html', 'js/views/logbook.js'].map((file) => readFileSync(file, 'utf8')).join('\n');

describe('régions aria-live des retours dynamiques', () => {
    it.each(['qcm-feedback', 'address-status-message', 'auth-sync-time', 'igc-upload-filename'])(
        '#%s est une région live polie',
        (id) => {
            const tag = SOURCES.match(new RegExp(`<[^>]*\\bid="${id}"[^>]*>`))?.[0] ?? '';
            expect(tag).toContain('aria-live="polite"');
            expect(tag).toContain('role="status"');
        },
    );
});
