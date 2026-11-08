import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

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
            /#stats-content\s+div:has\(>\s*\[data-exam-id\]\)\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(440px,\s*1fr\)\)/,
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
});
