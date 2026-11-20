import { describe, it, expect, afterEach, vi } from 'vitest';
import QuizView from '../../js/views/quiz.js';

describe('syncOptionGroupHeights', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
    });

    it('n’observe chaque ligne de choix qu’une fois, même si la section est rouverte', () => {
        const observe = vi.fn();
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe(el) {
                    observe(el);
                }
            },
        );
        document.body.innerHTML =
            '<div id="root"><div class="bank-item-choices"><div class="qcm-option-group"><div class="bank-choice">A</div></div></div></div>';
        const root = document.getElementById('root');

        QuizView.syncOptionGroupHeights(root);
        QuizView.syncOptionGroupHeights(root);
        QuizView.syncOptionGroupHeights(root);

        expect(observe).toHaveBeenCalledTimes(1);
    });

    it('déconnecte tous les ResizeObserver suivis lors de unmount()', async () => {
        const disconnect = vi.fn();
        vi.stubGlobal(
            'ResizeObserver',
            class {
                observe() {}
                disconnect() {
                    disconnect();
                }
            },
        );
        document.body.innerHTML =
            '<div id="root"><div class="bank-item-choices"><div class="qcm-option-group"><div class="bank-choice">A</div></div></div></div>';
        const root = document.getElementById('root');

        QuizView.syncOptionGroupHeights(root);
        await QuizView.unmount();

        expect(disconnect).toHaveBeenCalledTimes(1);
    });
});
