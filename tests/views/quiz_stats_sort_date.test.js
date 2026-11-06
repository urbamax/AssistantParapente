import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import QuizView from '../../js/views/quiz.js';
import { getQuestionLastSeen, buildQuestionsHtml } from '../../js/views/quiz_stats_html.js';
import { encodeAnswerLog } from '../../js/services/answer_log.js';

describe('Quiz Stats - Chronological question sorting (Par date)', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="stats-content"></div>';
        QuizView.state = {
            masteryFilter: 'ALL',
            themeFilter: null,
            themeSort: 'alpha',
            themeSortDir: 'asc',
            questionSort: 'rate',
            questionSortDir: 'asc',
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    describe('getQuestionLastSeen', () => {
        it('returns 0 when data is empty or question has never been attempted', () => {
            expect(getQuestionLastSeen(undefined)).toBe(0);
            expect(getQuestionLastSeen(null)).toBe(0);
            expect(getQuestionLastSeen({})).toBe(0);
            expect(getQuestionLastSeen({ total: 0 })).toBe(0);
        });

        it('returns numeric lastSeen directly', () => {
            const timestamp = 1730000000000;
            expect(getQuestionLastSeen({ lastSeen: timestamp })).toBe(timestamp);
        });

        it('parses valid date string in lastSeen', () => {
            const dateStr = '2026-11-01T12:00:00.000Z';
            const expected = Date.parse(dateStr);
            expect(getQuestionLastSeen({ lastSeen: dateStr })).toBe(expected);
        });

        it('falls back to answer log when lastSeen is absent or older', () => {
            // Day 19000 -> 19000 * 86400000 = 1641600000000
            const answers = encodeAnswerLog([[19000, 1]]);
            const expected = 19000 * 86400000;
            expect(getQuestionLastSeen({ answers })).toBe(expected);

            // If lastSeen is older than answer log day, take answer log day
            expect(getQuestionLastSeen({ lastSeen: expected - 100000, answers })).toBe(expected);
            // If lastSeen is newer, keep lastSeen
            expect(getQuestionLastSeen({ lastSeen: expected + 100000, answers })).toBe(expected + 100000);
        });

        it('takes exam date if newer than lastSeen and answers', () => {
            const examDateByCode = new Map([['Q1', 1730500000000]]);
            expect(getQuestionLastSeen({ lastSeen: 1730000000000 }, 'Q1', examDateByCode)).toBe(1730500000000);
            // If code not in map, keeps lastSeen
            expect(getQuestionLastSeen({ lastSeen: 1730000000000 }, 'Q2', examDateByCode)).toBe(1730000000000);
        });
    });

    describe('buildQuestionsHtml & data-date attribute', () => {
        it('renders sort-date-btn and sets data-date on question cards', () => {
            const levelQs = [
                { code: 'A1V', theme: 'Météo', question: 'Question A', choices: [{ text: 'x', pts: 1 }] },
                { code: 'B2V', theme: 'Météo', question: 'Question B', choices: [{ text: 'y', pts: 1 }] },
            ];
            const stats = {
                questions: {
                    A1V: { total: 2, correct: 1, streak: 1, lastSeen: 1730100000000 },
                    B2V: { total: 1, correct: 1, streak: 1, lastSeen: 1730200000000 },
                },
            };
            const levelQuestionEntries = Object.entries(stats.questions);

            const mockView = {
                state: { masteryFilter: 'ALL', themeFilter: null, questionSort: 'rate', questionSortDir: 'asc' },
                getQuestionByCode: (code) => levelQs.find((q) => q.code === code),
                getCourseUrl: () => null,
            };

            const html = buildQuestionsHtml(mockView, { levelQs, levelQuestionEntries, stats });

            expect(html).toContain('id="sort-date-btn"');
            expect(html).toContain('Par date');
            expect(html).toContain('data-code="A1V"');
            expect(html).toContain('data-date="1730100000000"');
            expect(html).toContain('data-code="B2V"');
            expect(html).toContain('data-date="1730200000000"');
        });
    });

    describe('QuizView.sortQuestions(date)', () => {
        beforeEach(() => {
            document.body.innerHTML = `
                <div id="stats-content">
                    <button id="sort-rate-btn" class="sort-btn">Par taux</button>
                    <button id="sort-attempts-btn" class="sort-btn">Par tentatives</button>
                    <button id="sort-streak-btn" class="sort-btn">Par série</button>
                    <button id="sort-date-btn" class="sort-btn">Par date</button>
                    <div id="all-questions-list">
                        <div class="question-stat-item" data-code="Q_OLD" data-pct="50" data-total="2" data-streak="0" data-date="1000">Q Old</div>
                        <div class="question-stat-item" data-code="Q_NEW" data-pct="80" data-total="3" data-streak="2" data-date="5000">Q New</div>
                        <div class="question-stat-item" data-code="Q_NEVER" data-pct="0" data-total="0" data-streak="0" data-date="0">Q Never</div>
                        <div class="question-stat-item" data-code="Q_MID" data-pct="30" data-total="1" data-streak="0" data-date="3000">Q Mid</div>
                    </div>
                </div>
            `;
        });

        it('sorts descending on first click (question posée le plus récemment first), unattempted at bottom', () => {
            QuizView.sortQuestions('date');

            expect(QuizView.state.questionSort).toBe('date');
            expect(QuizView.state.questionSortDir).toBe('desc');

            const dateBtn = document.getElementById('sort-date-btn');
            expect(dateBtn.innerHTML).toContain('ri-arrow-down-line');

            const items = Array.from(document.querySelectorAll('.question-stat-item'));
            const codes = items.map((el) => el.dataset.code);
            expect(codes).toEqual(['Q_NEW', 'Q_MID', 'Q_OLD', 'Q_NEVER']);
        });

        it('sorts ascending on second click (question posée il y a le plus longtemps first), unattempted still at bottom', () => {
            // First click: desc
            QuizView.sortQuestions('date');
            // Second click: asc
            QuizView.sortQuestions('date');

            expect(QuizView.state.questionSort).toBe('date');
            expect(QuizView.state.questionSortDir).toBe('asc');

            const dateBtn = document.getElementById('sort-date-btn');
            expect(dateBtn.innerHTML).toContain('ri-arrow-up-line');

            const items = Array.from(document.querySelectorAll('.question-stat-item'));
            const codes = items.map((el) => el.dataset.code);
            // Oldest attempted first: Q_OLD (1000), Q_MID (3000), Q_NEW (5000), then Q_NEVER (0)
            expect(codes).toEqual(['Q_OLD', 'Q_MID', 'Q_NEW', 'Q_NEVER']);
        });

        it('toggles back to descending on third click', () => {
            QuizView.sortQuestions('date');
            QuizView.sortQuestions('date');
            QuizView.sortQuestions('date');

            expect(QuizView.state.questionSortDir).toBe('desc');
            const items = Array.from(document.querySelectorAll('.question-stat-item'));
            const codes = items.map((el) => el.dataset.code);
            expect(codes).toEqual(['Q_NEW', 'Q_MID', 'Q_OLD', 'Q_NEVER']);
        });

        it('resets other button labels and removes their arrows', () => {
            QuizView.sortQuestions('attempts');
            const attemptsBtn = document.getElementById('sort-attempts-btn');
            expect(attemptsBtn.innerHTML).toContain('ri-arrow-down-line');

            QuizView.sortQuestions('date');
            expect(attemptsBtn.innerHTML).not.toContain('ri-arrow');
            expect(document.getElementById('sort-date-btn').innerHTML).toContain('ri-arrow-down-line');
        });
    });
});
