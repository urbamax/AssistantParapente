import { describe, it, expect } from 'vitest';
import { generateQrSvg, generateQrMatrix, qrcodegen } from '../../js/utils/qrcode.js';

describe('QR Code generator (js/utils/qrcode.js)', () => {
    it('exports qrcodegen and helper functions', () => {
        expect(qrcodegen).toBeDefined();
        expect(qrcodegen.QrCode).toBeDefined();
        expect(typeof generateQrSvg).toBe('function');
        expect(typeof generateQrMatrix).toBe('function');
    });

    it('generates a valid SVG string with default parameters', () => {
        const svg = generateQrSvg('https://assistant-parapente.web.app/?mode=ICE#test');
        expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
        expect(svg).toContain('viewBox="0 0 ');
        expect(svg).toContain('shape-rendering="crispEdges"');
        expect(svg).toContain('<path d="M');
        expect(svg).toContain('width="200" height="200"');
    });

    it('supports custom size, border and colors', () => {
        const svg = generateQrSvg('HELLO', {
            size: 300,
            border: 4,
            lightColor: '#f0f0f0',
            darkColor: '#123456',
            ecc: 'HIGH',
        });
        expect(svg).toContain('width="300" height="300"');
        expect(svg).toContain('fill="#f0f0f0"');
        expect(svg).toContain('fill="#123456"');
    });

    it('generates a 2D boolean matrix of modules', () => {
        const matrix = generateQrMatrix('TEST');
        expect(Array.isArray(matrix)).toBe(true);
        expect(matrix.length).toBeGreaterThan(20);
        expect(matrix[0].length).toBe(matrix.length);
        // Top-left finder pattern corners must be dark (true)
        expect(matrix[0][0]).toBe(true);
        expect(matrix[0][6]).toBe(true);
        expect(matrix[6][0]).toBe(true);
    });

    it('handles unicode and french accents correctly', () => {
        const svg = generateQrSvg('Éléphant Rhône-Alpes Ça vole !');
        expect(svg).toContain('<svg');
        expect(svg).toContain('<path');
    });

    it('throws when text is empty or invalid', () => {
        expect(() => generateQrSvg('')).toThrow();
        expect(() => generateQrSvg(null)).toThrow();
    });
});
