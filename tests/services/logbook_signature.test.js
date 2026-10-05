import { describe, it, expect, afterEach } from 'vitest';
import LogbookService from '../../js/services/logbook_service.js';

// Après une synchro cloud, le carnet n'est redessiné que si ce qu'il affiche a changé.
describe('LogbookService.dataSignature', () => {
    const saved = { flights: LogbookService.flights, equipment: LogbookService.equipment };
    afterEach(() => Object.assign(LogbookService, saved));

    const set = (flights, equipment = []) => {
        LogbookService.flights = flights;
        LogbookService.equipment = equipment;
        return LogbookService.dataSignature();
    };
    const flight = (extra = {}) => ({ id: 'f1', type: 'vol', site: 'PLAINE', duree: 10, rawIgc: 'B…', ...extra });

    it('does not change when only the upload state changes', () => {
        expect(set([flight({ syncPending: true })])).toBe(set([flight({ syncPending: false })]));
    });

    it('does not depend on the trace content, only on its presence', () => {
        expect(set([flight({ rawIgc: 'B1' })])).toBe(set([flight({ rawIgc: 'B2' })]));
        expect(set([flight({ rawIgc: 'B1' })])).not.toBe(set([flight({ rawIgc: undefined })]));
    });

    it('changes when a flight or the gear changes', () => {
        const base = set([flight()], [{ id: 'e1', nom: 'VOILE' }]);
        expect(set([flight({ duree: 11 })], [{ id: 'e1', nom: 'VOILE' }])).not.toBe(base);
        expect(set([flight()], [{ id: 'e1', nom: 'AUTRE' }])).not.toBe(base);
        expect(set([flight(), flight({ id: 'f2' })], [{ id: 'e1', nom: 'VOILE' }])).not.toBe(base);
    });
});
