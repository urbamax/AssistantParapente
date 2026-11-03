import { describe, it, expect } from 'vitest';
import {
    ANSWER_LOG_SIZE,
    appendAnswer,
    dayNumber,
    mergeAnswerLogs,
    pickMask,
    readAnswerLog,
    removeLastAnswer,
} from '../../js/services/answer_log.js';

const DAY = 86_400_000;

describe('answer_log', () => {
    const choices = [{ pts: 6 }, { pts: -6 }, { pts: 3 }];

    it('encodes the ticked choices as a bit mask by position', () => {
        expect(pickMask({ choices }, [choices[1]])).toBe(0b010);
        expect(pickMask({ choices }, [choices[0], choices[2]])).toBe(0b101);
        expect(pickMask({ choices }, [])).toBe(0);
        expect(pickMask({ choices }, [{ pts: 1 }])).toBe(0);
    });

    it('appends [day, mask] and keeps only the most recent answers', () => {
        let log;
        for (let i = 0; i < ANSWER_LOG_SIZE + 3; i++) log = appendAnswer(log, i, 10 * DAY);
        expect(log).toHaveLength(ANSWER_LOG_SIZE);
        expect(log[0]).toEqual([10, 3]);
        expect(log.at(-1)).toEqual([10, ANSWER_LOG_SIZE + 2]);
    });

    it('uses the UTC day number', () => {
        expect(dayNumber(5 * DAY + 123)).toBe(5);
    });

    it('removes the last answer with a given mask only', () => {
        expect(
            removeLastAnswer(
                [
                    [1, 2],
                    [2, 5],
                    [3, 2],
                ],
                2,
            ),
        ).toEqual([
            [1, 2],
            [2, 5],
        ]);
        expect(removeLastAnswer([[1, 2]], 7)).toEqual([[1, 2]]);
    });

    it('ignores malformed entries from old or corrupted data', () => {
        expect(readAnswerLog([[1, 2], 'x', [1], [1.5, 2], null])).toEqual([[1, 2]]);
        expect(readAnswerLog(undefined)).toEqual([]);
    });

    it('merges by max occurrences per (day, mask), never by sum', () => {
        const local = [
            [1, 2],
            [2, 2],
            [2, 2],
        ];
        const cloud = [
            [1, 2],
            [2, 2],
            [3, 1],
        ];
        expect(mergeAnswerLogs(local, cloud)).toEqual([
            [1, 2],
            [2, 2],
            [2, 2],
            [3, 1],
        ]);
    });

    it('caps the merged log to the most recent answers', () => {
        const a = Array.from({ length: 5 }, (_, i) => [i, 1]);
        const b = Array.from({ length: 5 }, (_, i) => [i + 5, 1]);
        const merged = mergeAnswerLogs(a, b);
        expect(merged).toHaveLength(ANSWER_LOG_SIZE);
        expect(merged[0][0]).toBe(4);
    });
});
