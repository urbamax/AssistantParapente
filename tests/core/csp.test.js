import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Spec 036 : une politique de sécurité sans « unsafe-inline » pour les scripts.
const source = readFileSync('index.html', 'utf8');
// Les commentaires HTML ne sont pas du code : on ne lit que les balises réelles.
const html = source.replace(/<!--[\s\S]*?-->/g, '');
const csp = source.match(/http-equiv="Content-Security-Policy"\s+content="([^"]*)"/)?.[1] ?? '';
const directive = (name) =>
    csp
        .split(';')
        .map((d) => d.trim().split(/\s+/))
        .find(([n]) => n === name)
        ?.slice(1) ?? [];

describe('Content-Security-Policy of index.html', () => {
    it('is declared', () => {
        expect(directive('default-src')).toEqual(["'self'"]);
    });

    it('does not allow inline or eval-ed scripts', () => {
        const scripts = directive('script-src');
        expect(scripts.length).toBeGreaterThan(0);
        expect(scripts).not.toContain("'unsafe-inline'");
        expect(scripts).not.toContain("'unsafe-eval'");
    });

    it('has no inline <script> block (every script has a src)', () => {
        const inline = [...html.matchAll(/<script\b([^>]*)>/gi)].filter(([, attrs]) => !/\ssrc=/.test(` ${attrs}`));
        expect(inline).toEqual([]);
    });

    it('loads scripts only from origins that script-src allows', () => {
        const allowed = directive('script-src');
        const hosts = [...html.matchAll(/<script\b[^>]*\ssrc="(https?:\/\/[^"/]+)/gi)].map(([, origin]) => origin);
        for (const origin of hosts) expect(allowed).toContain(origin);
    });

    it('still denies plugins and restricts base and form targets', () => {
        expect(directive('object-src')).toEqual(["'none'"]);
        expect(directive('base-uri')).toEqual(["'self'"]);
        expect(directive('form-action')).toEqual(["'self'"]);
    });
});

describe('the two scripts moved out of index.html', () => {
    const files = ['js/theme_boot.js', 'js/error_overlay.js'];

    it.each(files)('%s is loaded from <head> before the application (blocking, classic script)', (file) => {
        const tag = html.match(new RegExp(`<script\\b[^>]*src="${file.replace('.', '\\.')}[^"]*"[^>]*>`))?.[0] ?? '';
        expect(tag).not.toBe('');
        expect(tag).not.toMatch(/\b(defer|async|type="module")\b/);
        expect(html.indexOf(tag)).toBeLessThan(html.indexOf('</head>'));
    });

    it.each(files)('%s is copied by the build and precached for offline start-up', (file) => {
        expect(readFileSync('vite.config.mjs', 'utf8')).toContain(`'${file}'`);
        expect(readFileSync('sw.js', 'utf8')).toContain(`'./${file}'`);
    });
});
