import { describe, it, expect, beforeEach, vi } from 'vitest';
import { describeCourseUrl, openCourseViewer } from '../../js/views/course_viewer.js';
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

describe('visionneuse de cours : cycle de vie & repli erreur', () => {
    beforeEach(() => {
        document.body.innerHTML = '<button id="opener-btn" type="button">Ouvrir</button>';
        document.body.className = '';
        vi.restoreAllMocks();
    });

    it('monte le dialogue accessible, affiche le lien direct si pdf.js échoue, et restaure le focus à la fermeture', async () => {
        const opener = document.getElementById('opener-btn');
        opener.focus();
        const backSpy = vi.spyOn(history, 'back').mockImplementation(() => {
            window.dispatchEvent(new PopStateEvent('popstate'));
        });

        await openCourseViewer('courses/inconnu.pdf#page=3');

        const overlay = document.querySelector('.course-viewer-overlay');
        expect(overlay).not.toBeNull();
        expect(overlay.getAttribute('role')).toBe('dialog');
        expect(overlay.getAttribute('aria-modal')).toBe('true');
        expect(document.body.classList.contains('course-viewer-open')).toBe(true);

        // En environnement de test sans pdf.js navigateur, le fallback d'erreur propose le lien direct
        const directLink = overlay.querySelector('.cv-direct');
        expect(directLink).not.toBeNull();
        expect(directLink.getAttribute('href')).toContain('#page=3');

        // Un second appel pendant que la visionneuse est ouverte est ignoré
        await openCourseViewer('courses/autre.pdf');
        expect(document.querySelectorAll('.course-viewer-overlay')).toHaveLength(1);

        // Fermeture via la touche Escape -> history.back() -> popstate -> nettoyage DOM + focus restauré
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        expect(backSpy).toHaveBeenCalledTimes(1);
        expect(document.querySelector('.course-viewer-overlay')).toBeNull();
        expect(document.body.classList.contains('course-viewer-open')).toBe(false);
        expect(document.activeElement).toBe(opener);
    });
});
