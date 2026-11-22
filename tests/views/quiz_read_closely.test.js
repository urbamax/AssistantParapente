import { describe, it, expect } from 'vitest';
import { readCloselyHtml } from '../../js/views/quiz_read_closely.js';

// Spec 061 : encart « À lire de près » de la correction, construit à partir des phrases de la question.
const parse = (html) => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
};

describe('readCloselyHtml (spec 061)', () => {
    it('renders nothing without sentences', () => {
        expect(readCloselyHtml([])).toBe('');
        expect(readCloselyHtml(null)).toBe('');
        expect(readCloselyHtml(undefined)).toBe('');
    });

    it('renders one note box with the catalogue title and one paragraph per sentence', () => {
        const root = parse(readCloselyHtml(['Une seule phrase.']));
        const box = root.querySelector('aside.quiz-read-closely');
        expect(box).not.toBeNull();
        expect(box.getAttribute('role')).toBe('note');
        expect(box.getAttribute('aria-label')).toBe('À lire de près : ce qui rend cette question délicate');
        expect(box.querySelector('.quiz-read-closely-title').textContent.trim()).toBe('À lire de près');
        expect([...box.querySelectorAll('.quiz-read-closely-text')].map((p) => p.textContent)).toEqual([
            'Une seule phrase.',
        ]);
    });

    it('keeps the order of several sentences', () => {
        const root = parse(readCloselyHtml(['Un.', 'Deux.', 'Trois.']));
        expect([...root.querySelectorAll('.quiz-read-closely-text')].map((p) => p.textContent)).toEqual([
            'Un.',
            'Deux.',
            'Trois.',
        ]);
    });

    it('escapes the sentences', () => {
        const html = readCloselyHtml(['<img src=x onerror=alert(1)> & « mot ».']);
        expect(html).not.toContain('<img');
        const root = parse(html);
        expect(root.querySelector('img')).toBeNull();
        expect(root.querySelector('.quiz-read-closely-text').textContent).toBe(
            '<img src=x onerror=alert(1)> & « mot ».',
        );
    });
});
