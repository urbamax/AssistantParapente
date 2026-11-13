import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import QuizView from '../../js/views/quiz.js';

describe('Quiz Stats Screen Mobile Layout & Overflow Rules (css/quiz.css)', () => {
    const css = readFileSync('css/quiz.css', 'utf8');

    it('defines base overflow-x prevention on stats-screen, course-container and stats-content', () => {
        expect(css).toMatch(/#stats-screen\s*\{[^}]*overflow-x:\s*hidden/);
        expect(css).toMatch(/#stats-screen\s+\.course-container\s*\{[^}]*overflow-x:\s*hidden/);
        expect(css).toMatch(/#stats-content\s*\{[^}]*overflow-x:\s*hidden/);
    });

    it('ensures #all-questions-list has overflow-x: hidden to prevent horizontal scrolling', () => {
        expect(css).toMatch(/#all-questions-list\s*\{[^}]*overflow-x:\s*hidden/);
    });

    it('ensures .question-stat-item and its content do not force horizontal expansion', () => {
        expect(css).toMatch(/\.question-stat-item\s*\{[^}]*overflow:\s*hidden/);
        expect(css).toMatch(/\.question-stat-item\s*\{[^}]*min-width:\s*0/);
        expect(css).toMatch(
            /\.question-stat-item\s*>\s*div\s*>\s*div:first-child\s*>\s*div:nth-child\(2\)\s*\{[^}]*word-break:\s*break-word/,
        );
    });

    it('ensures dropdown sort select is used on mobile rather than multiple button rows', () => {
        const mobileSection = css.slice(css.indexOf('@media (max-width: 768px)'));
        expect(mobileSection).toMatch(/\.sort-select-btn\s*\{[^}]*width:\s*100%/);
        expect(mobileSection).toMatch(/\.stats-sort-container/);
    });

    it('reduces bulky padding on mobile stats cards and containers to fit narrow screens', () => {
        const mobileSection = css.slice(css.indexOf('@media (max-width: 768px)'));
        expect(mobileSection).toMatch(/#stats-screen\s+\.course-container\s*\{[^}]*padding:\s*8px\s+6px/);
        expect(mobileSection).toMatch(/#stats-content\s+div:has\(>\s*#all-questions-list\)[^}]*padding:\s*14px\s+10px/);
    });

    it('packs desktop stats layout: pairs top banners, pairs gauge with mastery distribution, aligns theme sort header, and uses multi-column exam history grid', () => {
        expect(css).toMatch(
            /#stats-content\s*>\s*div:has\(\[data-action="QuizsetThemeSort"\]\)\s*\{[^}]*grid-template-columns:\s*1fr\s+auto/,
        );
        expect(css).toMatch(
            /#stats-content\s+div:has\(>\s*\[data-exam-id\]\)\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(310px,\s*1fr\)\)/,
        );
        expect(css).toMatch(
            /#stats-content\s+div\[data-exam-id\]\s*>\s*div:first-child\s*>\s*div:first-child\s*\{[^}]*min-width:\s*0/,
        );
        const desktopSection = css.slice(css.indexOf('@media (min-width: 960px)'));
        expect(desktopSection).toMatch(
            /#stats-screen\s+#stats-content\s*>\s*\.premium-gauge-container\s*\{[^}]*grid-column:\s*1\s*\/\s*4/,
        );
        expect(desktopSection).toMatch(
            /#stats-screen\s+#stats-content\s*>\s*div:has\(\[data-action="QuizsetMasteryFilter"\]\)\s*\{[^}]*grid-column:\s*4\s*\/\s*-1/,
        );
    });

    it('ne fixe pas la hauteur des cartes de thème du bureau (texte coupé vers 1000 px de large)', () => {
        expect(css).toMatch(/#stats-content\s+\.theme-card\s*\{[^}]*min-height:\s*108px/);
        expect(css).not.toMatch(/\.theme-card\s*\{[^}]*[^-]height:\s*108px/);
    });

    it('limite la grille des examens à 3 lignes avec une barre de défilement discrète', () => {
        expect(css).toMatch(/#stats-content\s+div:has\(>\s*\[data-exam-id\]\)\s*\{[^}]*overflow-y:\s*auto/);
        expect(css).toMatch(/#stats-content\s+div:has\(>\s*\[data-exam-id\]\)\s*\{[^}]*scrollbar-width:\s*thin/);
        expect(css).toMatch(
            /#stats-content\s+div:has\(>\s*\[data-exam-id\]\)\.exam-history-scrollable\s*\{[^}]*padding-right:\s*8px/,
        );
        expect(css).toMatch(
            /#stats-content\s+div:has\(>\s*\[data-exam-id\]\)::-webkit-scrollbar\s*\{[^}]*width:\s*6px/,
        );
    });
});

describe('QuizStatsBase.syncExamHistoryScrollHeight', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    function setupExamGrid(rowTops, cardHeight = 65) {
        document.body.innerHTML = '<div id="stats-content"><div id="exam-grid"></div></div>';
        const grid = document.getElementById('exam-grid');
        grid.style.paddingTop = '4px';
        grid.style.paddingBottom = '4px';
        vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue(
            /** @type {DOMRect} */ ({ top: 100, bottom: 500, left: 0, right: 1200, width: 1200, height: 400 }),
        );
        rowTops.forEach((relTop, idx) => {
            const card = document.createElement('div');
            card.setAttribute('data-exam-id', `e${idx}`);
            Object.defineProperty(card, 'offsetHeight', { value: cardHeight, configurable: true });
            vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(
                /** @type {DOMRect} */ ({
                    top: 100 + relTop,
                    bottom: 100 + relTop + cardHeight,
                    left: 0,
                    right: 310,
                    width: 310,
                    height: cardHeight,
                }),
            );
            grid.appendChild(card);
        });
        return grid;
    }

    it("n'ajoute pas de défilement tant qu'il y a au plus 3 lignes", () => {
        const grid = setupExamGrid([4, 4, 79, 79, 154, 154]);
        QuizView.syncExamHistoryScrollHeight();

        expect(grid.style.maxHeight).toBe('none');
        expect(grid.classList.contains('exam-history-scrollable')).toBe(false);
    });

    it('plafonne la hauteur au bas de la 3e ligne et active le défilement dès la 4e ligne', () => {
        const grid = setupExamGrid([4, 4, 79, 79, 154, 154, 229]);
        QuizView.syncExamHistoryScrollHeight();

        expect(grid.classList.contains('exam-history-scrollable')).toBe(true);
        // 3e ligne : top=154, height=65 -> bottom=219 + paddingBottom 4 = 223px
        expect(grid.style.maxHeight).toBe('223px');
    });

    it('diffère le recalcul via requestAnimationFrame et débranche observateur + frame en attente', () => {
        const disconnect = vi.fn();
        const cancelRaf = vi.fn();
        let lastCallback = null;
        let pendingRaf = null;
        vi.stubGlobal(
            'ResizeObserver',
            class {
                constructor(cb) {
                    lastCallback = cb;
                }
                observe() {}
                disconnect() {
                    disconnect();
                }
            },
        );
        vi.stubGlobal('requestAnimationFrame', (cb) => {
            pendingRaf = cb;
            return 42;
        });
        vi.stubGlobal('cancelAnimationFrame', cancelRaf);

        const grid = setupExamGrid([4, 79, 154, 229]);
        QuizView.syncExamHistoryScrollHeight();
        expect(grid.classList.contains('exam-history-scrollable')).toBe(true);

        // Réaffiche en 3 lignes lors d'un élargissement de fenêtre
        const cards = Array.from(grid.querySelectorAll('[data-exam-id]'));
        [4, 4, 79, 154].forEach((relTop, idx) => {
            vi.spyOn(cards[idx], 'getBoundingClientRect').mockReturnValue(
                /** @type {DOMRect} */ ({
                    top: 100 + relTop,
                    bottom: 100 + relTop + 65,
                    left: 0,
                    right: 310,
                    width: 310,
                    height: 65,
                }),
            );
        });

        // Ne doit pas muter le DOM synchronement dans le callback ResizeObserver (boucle WebKit/Safari)
        lastCallback();
        expect(grid.classList.contains('exam-history-scrollable')).toBe(true);
        expect(typeof pendingRaf).toBe('function');

        pendingRaf(0);
        expect(grid.classList.contains('exam-history-scrollable')).toBe(false);
        expect(grid.style.maxHeight).toBe('none');

        // Re-planifier puis débrancher avant la frame suivante doit annuler cancelAnimationFrame(42)
        lastCallback();
        QuizView.syncExamHistoryScrollHeight();
        expect(disconnect).toHaveBeenCalledTimes(1);
        expect(cancelRaf).toHaveBeenCalledWith(42);
    });
});
