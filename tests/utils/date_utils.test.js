import { describe, it, expect } from 'vitest';
import {
    formatDuration,
    formatDateOnly,
    formatDateTime,
    formatRelativeTime,
    getFileTimestamp,
} from '../../js/utils/date_utils.js';

describe('Date Utils', () => {
    it('formatDuration handles minutes and hours', () => {
        expect(formatDuration(45)).toBe('45min');
        expect(formatDuration(60)).toBe('1h 00min');
        expect(formatDuration(95)).toBe('1h 35min');
        expect(formatDuration(0)).toBe('0min');
        expect(formatDuration(NaN)).toBe('0min');
        expect(formatDuration(null)).toBe('0min');
    });

    it('formatDateOnly localizes date', () => {
        const d = new Date('2026-08-21T10:00:00Z');
        expect(formatDateOnly(d)).toMatch(/21\/08\/2026/); // local timezone might shift if we test at midnight, but usually passes
        expect(formatDateOnly('invalid')).toBe('');
        expect(formatDateOnly(null)).toBe('');
    });

    it('formatDateTime localizes date and time', () => {
        const d = new Date('2026-08-21T10:30:00Z');
        expect(formatDateTime(d)).toContain('21/08/2026');
        expect(formatDateTime('invalid')).toBe('');
        expect(formatDateTime(null)).toBe('');
    });

    it('formatRelativeTime formats relative differences correctly', () => {
        const base = new Date('2026-08-21T12:00:00Z');

        // Instant
        expect(formatRelativeTime(new Date('2026-08-21T12:00:20Z'), base)).toBe("à l'instant");

        // Minutes
        const tenMinutesAgo = new Date('2026-08-21T11:50:00Z');
        expect(formatRelativeTime(tenMinutesAgo, base)).toMatch(/il y a 10 minutes/i);

        // Hours
        const threeHoursAgo = new Date('2026-08-21T09:00:00Z');
        expect(formatRelativeTime(threeHoursAgo, base)).toMatch(/il y a 3 heures/i);

        // Days
        const twoDaysAgo = new Date('2026-08-19T12:00:00Z');
        expect(formatRelativeTime(twoDaysAgo, base)).toBe('avant-hier');

        const fiveDaysAgo = new Date('2026-08-16T12:00:00Z');
        expect(formatRelativeTime(fiveDaysAgo, base)).toMatch(/il y a 5 jours/i);

        // Invalid / null
        expect(formatRelativeTime('invalid', base)).toBe('');
        expect(formatRelativeTime(null, base)).toBe('');
    });

    it('getFileTimestamp returns correct format', () => {
        const d = new Date('2026-08-21T14:30:00Z');
        const ts = getFileTimestamp(d);
        expect(ts).toMatch(/^2026-08-21_\d{2}-\d{2}$/);
    });
});
