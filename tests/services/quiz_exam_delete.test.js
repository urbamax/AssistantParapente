import { describe, it, expect, beforeEach, vi } from 'vitest';
import QuizService from '../../js/services/quiz_service.js';
import StorageService from '../../js/services/storage.js';
import AccessService, { ROLES } from '../../js/services/access_service.js';
import { FirebaseAuthEngine } from '../../js/services/firebase_service.js';
import QuizView from '../../js/views/quiz.js';
import GlobalState from '../../js/core/app_state.js';

describe('Quiz Exam Deletion & Owner Access', () => {
    beforeEach(() => {
        localStorage.clear();
        AccessService.clear();
        window.confirm = vi.fn();
        vi.restoreAllMocks();
    });

    it('AccessService.isOwner() returns true only when owner role is present', () => {
        expect(AccessService.isOwner()).toBe(false);
        AccessService.setRoles('user123', ['beta']);
        expect(AccessService.isOwner()).toBe(false);
        AccessService.setRoles('user123', ['owner']);
        expect(AccessService.isOwner()).toBe(true);
    });

    it('QuizService.deleteExam removes the target exam and records tombstone in deletedExamIds', () => {
        const initial = {
            exams: [
                { id: 'exam_fake', date: '2026-10-11T14:06:00.000Z', score: 0, total: 30, invalidated: true },
                { id: 'exam_valid', date: '2026-05-20T12:09:00.000Z', score: 29, total: 30 },
            ],
            deletedExamIds: [],
        };
        StorageService.set(StorageService.KEYS.EXAM_HISTORY, initial);

        const updated = QuizService.deleteExam('exam_fake');

        expect(updated.exams).toHaveLength(1);
        expect(updated.exams[0].id).toBe('exam_valid');
        expect(updated.deletedExamIds).toContain('exam_fake');
        expect(updated.deletedExamIds).toContain('2026-10-11T14:06:00.000Z');

        // Check storage persistence
        const inStorage = StorageService.get(StorageService.KEYS.EXAM_HISTORY);
        expect(inStorage.exams).toHaveLength(1);
        expect(inStorage.exams[0].id).toBe('exam_valid');
        expect(inStorage.deletedExamIds).toContain('exam_fake');
    });

    it('FirebaseAuthEngine.mergeExamHistory discards any exam whose id or date is in deletedExamIds', () => {
        const local = {
            exams: [
                { id: 'exam_zombie', date: '2026-10-11T14:06:00.000Z', score: 0, total: 30 },
                { id: 'exam_good', date: '2026-05-20T12:09:00.000Z', score: 29, total: 30 },
            ],
            deletedExamIds: [],
        };
        const cloud = {
            exams: [
                { id: 'exam_good', date: '2026-05-20T12:09:00.000Z', score: 29, total: 30 },
            ],
            deletedExamIds: ['exam_zombie'],
        };

        const merged = FirebaseAuthEngine.mergeExamHistory(local, cloud);

        expect(merged.exams).toHaveLength(1);
        expect(merged.exams[0].id).toBe('exam_good');
        expect(merged.deletedExamIds).toContain('exam_zombie');
    });

    it('QuizView.renderExamHistory shows delete button only when user is owner', () => {
        vi.spyOn(GlobalState, 'get').mockReturnValue('ALL');
        vi.spyOn(QuizService, 'getExamHistory').mockReturnValue([
            { id: 'exam_1', date: '2026-10-30T14:00:00.000Z', level: 'BI', score: 25, total: 30, results: [] },
        ]);

        // 1. Not owner
        AccessService.clear();
        let html = QuizView.renderExamHistory();
        expect(html).not.toContain('QuizdeleteExam');
        expect(html).not.toContain('ri-delete-bin-line');

        // 2. Owner
        AccessService.setRoles('admin_uid', [ROLES.OWNER]);
        html = QuizView.renderExamHistory();
        expect(html).toContain('QuizdeleteExam');
        expect(html).toContain("data-args=\"['exam_1']\"");
        expect(html).toContain('ri-delete-bin-line');
    });

    it('QuizView.deleteExam confirms, deletes exam and calls renderStats when owner', () => {
        AccessService.setRoles('admin_uid', [ROLES.OWNER]);
        window.confirm = vi.fn().mockReturnValue(true);
        const deleteExamSpy = vi.spyOn(QuizService, 'deleteExam').mockReturnValue({ exams: [] });
        const renderStatsSpy = vi.spyOn(QuizView, 'renderStats').mockImplementation(() => {});

        QuizView.deleteExam(['exam_target']);

        expect(window.confirm).toHaveBeenCalled();
        expect(deleteExamSpy).toHaveBeenCalledWith('exam_target');
        expect(renderStatsSpy).toHaveBeenCalled();
    });

    it('QuizView.deleteExam does nothing if owner cancels confirmation', () => {
        AccessService.setRoles('admin_uid', [ROLES.OWNER]);
        window.confirm = vi.fn().mockReturnValue(false);
        const deleteExamSpy = vi.spyOn(QuizService, 'deleteExam');
        const renderStatsSpy = vi.spyOn(QuizView, 'renderStats');

        QuizView.deleteExam('exam_target');

        expect(deleteExamSpy).not.toHaveBeenCalled();
        expect(renderStatsSpy).not.toHaveBeenCalled();
    });

    it('QuizView.deleteExam is refused if user is not owner', () => {
        AccessService.clear();
        const deleteExamSpy = vi.spyOn(QuizService, 'deleteExam');

        QuizView.deleteExam('exam_target');

        expect(deleteExamSpy).not.toHaveBeenCalled();
    });
});
