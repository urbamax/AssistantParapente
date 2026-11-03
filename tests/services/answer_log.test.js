import { describe, it, expect } from 'vitest';
import {
    ANSWER_LOG_SIZE,
    appendAnswer,
    dayNumber,
    encodeAnswerLog,
    flattenAnswerLogs,
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
        expect(readAnswerLog(log)[0]).toEqual([10, 3]);
        expect(readAnswerLog(log).at(-1)).toEqual([10, ANSWER_LOG_SIZE + 2]);
    });

    it('uses the UTC day number', () => {
        expect(dayNumber(5 * DAY + 123)).toBe(5);
    });

    it('removes the last answer with a given mask only', () => {
        const log = encodeAnswerLog([
            [1, 2],
            [2, 5],
            [3, 2],
        ]);
        expect(readAnswerLog(removeLastAnswer(log, 2))).toEqual([
            [1, 2],
            [2, 5],
        ]);
        expect(readAnswerLog(removeLastAnswer(encodeAnswerLog([[1, 2]]), 7))).toEqual([[1, 2]]);
    });

    it('ignores malformed entries from old or corrupted data', () => {
        expect(readAnswerLog([[1, 2], 'x', [1], [1.5, 2], null, -3, 2.5])).toEqual([[1, 2]]);
        expect(readAnswerLog(undefined)).toEqual([]);
    });

    it('stores a flat array of integers, because Firestore refuses nested arrays', () => {
        const log = appendAnswer(appendAnswer(undefined, 0b101, 12 * DAY), 0b010, 13 * DAY);
        expect(log.every(Number.isInteger)).toBe(true);
        expect(readAnswerLog(log)).toEqual([
            [12, 0b101],
            [13, 0b010],
        ]);
        expect(log.some(Array.isArray)).toBe(false);
    });

    it('still reads the pairs written by the first version of the log', () => {
        expect(readAnswerLog([[7, 3], 7 * 1024 + 1])).toEqual([
            [7, 3],
            [7, 1],
        ]);
    });

    it('flattens legacy pairs in place and reports whether anything changed', () => {
        const stats = { questions: { A1V: { answers: [[1, 2]] }, A2V: { answers: [1026] }, A3V: { total: 1 } } };
        expect(flattenAnswerLogs(stats)).toBe(true);
        expect(stats.questions.A1V.answers).toEqual([1026]);
        expect(flattenAnswerLogs(stats)).toBe(false);
        expect(flattenAnswerLogs(undefined)).toBe(false);
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
        const merged = mergeAnswerLogs(local, cloud);
        expect(merged.some(Array.isArray)).toBe(false);
        expect(readAnswerLog(merged)).toEqual([
            [1, 2],
            [2, 2],
            [2, 2],
            [3, 1],
        ]);
    });

    it('caps the merged log to the most recent answers', () => {
        const a = Array.from({ length: 5 }, (_, i) => [i, 1]);
        const b = Array.from({ length: 5 }, (_, i) => [i + 5, 1]);
        const merged = readAnswerLog(mergeAnswerLogs(a, b));
        expect(merged).toHaveLength(ANSWER_LOG_SIZE);
        expect(merged[0][0]).toBe(4);
    });
});
