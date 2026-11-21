import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ACRONYMS_DATA } from '../../js/data/acronyms_data.js';
import { COURSES_DATA } from '../../js/data/courses_data.js';

const explanations = readFileSync('js/data/qcm_ffvl_explanations.csv', 'utf8');
const entries = Object.entries(ACRONYMS_DATA);

describe('acronym dictionary (tooltips of the quiz explanations)', () => {
    it.each(entries)('%s has a definition and a library page as its source', (_key, entry) => {
        expect(typeof entry.def).toBe('string');
        expect(entry.def.length).toBeGreaterThan(10);
        const course = COURSES_DATA[entry.source?.course];
        expect(course, `unknown course ${entry.source?.course}`).toBeTruthy();
        expect(course.pdf).toMatch(/^courses\/[0-9a-f]+\.pdf$/);
        expect(Number.isInteger(entry.source.page) && entry.source.page >= 1).toBe(true);
    });

    it.each(entries)('%s appears in at least one explanation (no dead entry)', (key) => {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        expect(new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`).test(explanations)).toBe(true);
    });
});
