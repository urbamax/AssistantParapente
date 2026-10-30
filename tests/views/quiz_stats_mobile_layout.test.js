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

    it('ensures sort buttons toolbar wraps and adapts cleanly on mobile', () => {
        const mobileSection = css.slice(css.indexOf('@media (max-width: 768px)'));
        expect(mobileSection).toMatch(/#stats-content\s+div:has\([^)]*\.sort-btn\)/);
        expect(mobileSection).toMatch(/#stats-content\s+\.sort-btn\s*\{[^}]*flex:\s*1\s+1\s+0/);
    });

    it('reduces bulky padding on mobile stats cards and containers to fit narrow screens', () => {
        const mobileSection = css.slice(css.indexOf('@media (max-width: 768px)'));
        expect(mobileSection).toMatch(/#stats-screen\s+\.course-container\s*\{[^}]*padding:\s*8px\s+6px/);
        expect(mobileSection).toMatch(/#stats-content\s+div:has\(>\s*#all-questions-list\)[^}]*padding:\s*14px\s+10px/);
    });
});
