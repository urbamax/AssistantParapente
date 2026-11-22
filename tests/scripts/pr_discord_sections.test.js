import { describe, it, expect } from 'vitest';
import {
    readSection,
    checkPrBody,
    extractSections,
    DISCORD_MESSAGE_LIMIT,
} from '../../scripts/pr_discord_sections.mjs';

// Spec 056 : chaque PR dit ce qu'il faut annoncer sur Discord (#mises-a-jour) et ce qu'il faut changer
// dans le guide (#guide-utilisation), pour qu'une session les publie en une fois après le déploiement.

const body = (notice, guide) =>
    [
        '## Why',
        'Because.',
        '',
        notice === undefined ? '' : `## Discord notice\n${notice}`,
        '',
        guide === undefined ? '' : `## Discord guide\n${guide}`,
        '',
        '🤖 Generated',
    ].join('\n');

describe('readSection', () => {
    it('reads a section up to the next heading', () => {
        const b = '## Discord notice\nNouveau : la météo.\n\n## Discord guide\nNone: rien à changer.';
        expect(readSection(b, 'Discord notice')).toBe('Nouveau : la météo.');
        expect(readSection(b, 'Discord guide')).toBe('None: rien à changer.');
    });

    it('returns null when the heading is missing, and ignores HTML comments', () => {
        expect(readSection('## Why\nx', 'Discord notice')).toBeNull();
        expect(readSection('## Discord notice\n<!-- write here -->\n', 'Discord notice')).toBe('');
    });

    it('stops at the generated-by line and at a horizontal rule', () => {
        const b = '## Discord guide\nFiche 5.\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)';
        expect(readSection(b, 'Discord guide')).toBe('Fiche 5.');
        expect(readSection('## Discord notice\nTexte.\n---\nPied', 'Discord notice')).toBe('Texte.');
    });

    it('leaves no comment opener behind, even with nested or unclosed comments', () => {
        expect(readSection('## Discord notice\nA<!-<!-- x -->- y -->B', 'Discord notice')).not.toContain('<!--');
        expect(readSection('## Discord notice\nTexte <!-- jamais fermé', 'Discord notice')).toBe('Texte');
        expect(readSection('## Discord notice\n<<!-- a -->!-- b -->C', 'Discord notice')).not.toContain('<!--');
    });

    it('accepts CRLF line endings and a heading in any case', () => {
        expect(readSection('## discord NOTICE\r\nTexte.\r\n## Next\r\n', 'Discord notice')).toBe('Texte.');
    });
});

describe('checkPrBody', () => {
    it('passes with a French notice and a guide change', () => {
        expect(checkPrBody(body('Nouveau : X.', 'Fiche 5 : décrire X.'))).toEqual({ ok: true, errors: [] });
    });

    it('passes with « None: reason » in both sections', () => {
        expect(checkPrBody(body('None: correction interne.', 'Aucune : rien de visible.')).ok).toBe(true);
    });

    it('fails and names each missing section', () => {
        const result = checkPrBody(body(undefined, undefined));
        expect(result.ok).toBe(false);
        expect(result.errors.join('\n')).toMatch(/## Discord notice/);
        expect(result.errors.join('\n')).toMatch(/## Discord guide/);
    });

    it('fails on an empty section, a template comment only, or « None » without a reason', () => {
        expect(checkPrBody(body('', 'None: x y z')).ok).toBe(false);
        expect(checkPrBody(body('<!-- texte -->', 'None: x y z')).ok).toBe(false);
        expect(checkPrBody(body('None', 'None: x y z')).ok).toBe(false);
        expect(checkPrBody(body('None:', 'None: x y z')).ok).toBe(false);
    });

    it('fails when the notice does not fit in one Discord message', () => {
        const long = 'a'.repeat(DISCORD_MESSAGE_LIMIT + 1);
        expect(checkPrBody(body(long, 'None: x y z')).ok).toBe(false);
    });

    it('fails on an empty or missing body', () => {
        expect(checkPrBody('').ok).toBe(false);
        expect(checkPrBody(null).ok).toBe(false);
    });
});

describe('extractSections', () => {
    it('gives the texts to post, and null for « None » or a missing section', () => {
        const b = '## Discord notice\nNouveau : X.\n\n## Discord guide\nNone: rien.\n\n🤖 Generated';
        expect(extractSections(b)).toEqual({ notice: 'Nouveau : X.', guide: null });
        expect(extractSections('## Why\nx')).toEqual({ notice: null, guide: null });
    });
});
