import { describe, it, expect } from 'vitest';
import { describeCourseUrl } from '../../js/views/course_viewer.js';
import { COURSES_DATA } from '../../js/data/courses_data.js';

describe('visionneuse de cours : lecture de l’adresse', () => {
    const [id, course] = Object.entries(COURSES_DATA).find(([, c]) => c.pdf);

    it('retrouve le titre du cours, la page demandée et l’adresse sans ancre', () => {
        const { pdfUrl, page, title } = describeCourseUrl(`${course.pdf}#page=12`);
        expect(page).toBe(12);
        expect(title).toBe(course.title);
        expect(pdfUrl).toMatch(new RegExp(`${course.pdf.replace('.', '\\.')}$`));
        expect(id).toBeTruthy();
    });

    it('ouvre à la première page sans ancre, avec un titre par défaut pour un PDF inconnu', () => {
        const { page, title } = describeCourseUrl('courses/inconnu.pdf');
        expect(page).toBe(1);
        expect(title).toBe('Cours');
    });
});
