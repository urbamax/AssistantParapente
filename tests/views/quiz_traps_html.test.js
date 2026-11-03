import { describe, it, expect } from 'vitest';
import { buildResultsTrapsHtml } from '../../js/views/quiz_traps_html.js';

describe('buildResultsTrapsHtml', () => {
    const trap = (count) => ({ code: 'U1V', count, status: 'active', relapse: false });

    it('stays empty when no trap was ticked', () => {
        expect(buildResultsTrapsHtml({ trapped: [], recurrent: 0 }, { canStartWorkshop: true })).toBe('');
    });

    it('says how many traps were met and how many were already known', () => {
        const fresh = buildResultsTrapsHtml({ trapped: [trap(1)], recurrent: 0 }, { canStartWorkshop: true });
        expect(fresh).toContain('1 piège rencontré dans cette série');
        expect(fresh).toContain('Première fois pour chacun.');
        const repeated = buildResultsTrapsHtml(
            { trapped: [trap(3), trap(1), trap(2)], recurrent: 2 },
            { canStartWorkshop: true },
        );
        expect(repeated).toContain('3 pièges rencontrés dans cette série');
        expect(repeated).toContain('2 de ces pièges avaient déjà été choisis.');
        expect(repeated).toContain('QuizstartTrapsWorkshop');
    });

    it('can leave out the workshop button', () => {
        expect(buildResultsTrapsHtml({ trapped: [trap(1)], recurrent: 0 }, { canStartWorkshop: false })).not.toContain(
            'QuizstartTrapsWorkshop',
        );
    });
});
