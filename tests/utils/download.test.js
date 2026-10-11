import { describe, it, expect, vi, afterEach } from 'vitest';
import { saveTextFile } from '../../js/utils/download.js';

describe('saveTextFile', () => {
    afterEach(() => vi.restoreAllMocks());

    it('clicks a temporary link carrying the file name, then cleans up', () => {
        URL.createObjectURL = vi.fn(() => 'blob:fake');
        URL.revokeObjectURL = vi.fn();
        const clicked = [];
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
            clicked.push({ download: this.download, href: this.href });
        });

        saveTextFile('trace.igc', 'HFDTE', 'text/plain');

        expect(clicked).toEqual([{ download: 'trace.igc', href: 'blob:fake' }]);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake');
        expect(document.querySelector('a[download]')).toBeNull();
    });
});
