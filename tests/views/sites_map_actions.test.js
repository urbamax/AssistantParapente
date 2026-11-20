import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SitesMapBase } from '../../js/views/sites_map.js';
import SitesService from '../../js/services/sites_service.js';

describe('SitesMapBase UI actions & URL hardening', () => {
    /** @type {SitesMapBase} */
    let view;

    beforeEach(() => {
        document.body.innerHTML = `
            <div id="sites-parent">
                <div id="sites-map-view">
                    <div id="sites-map-canvas"></div>
                </div>
                <button id="map-toggle-fullscreen" type="button"></button>
            </div>
            <div id="more-maps-bottom-sheet">
                <h3 id="more-maps-title"></h3>
                <p id="more-maps-subtitle"></p>
                <div id="more-maps-grid"></div>
            </div>
        `;
        SitesService.state.activeMapLayers = ['leaflet', 'windy', 'meteoparapente', 'paraglidingearth', 'paraglidable'];
        view = new SitesMapBase();
        vi.restoreAllMocks();
    });

    it('focusSiteMap opens external tabs for meteoblue, windfinder, spotair (URL-encoded) and paraglidingmap', () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

        view.focusSiteMap('meteoblue', -21.1, -55.5, 'Saint-Leu');
        expect(openSpy).toHaveBeenLastCalledWith(
            'https://www.meteoblue.com/fr/meteo/semaine/21.1S55.5W',
            '_blank',
            'noopener,noreferrer',
        );

        view.focusSiteMap('windfinder', 45.8, 6.2, 'Annecy');
        expect(openSpy).toHaveBeenLastCalledWith(
            'https://fr.windfinder.com/#11/45.8/6.2',
            '_blank',
            'noopener,noreferrer',
        );

        view.focusSiteMap('spotair', 45.8, 6.2, 'Annecy', '123" onload="alert(1)');
        expect(openSpy).toHaveBeenLastCalledWith(
            'https://www.spotair.mobi/spot/ffvl/123%22%20onload%3D%22alert(1)',
            '_blank',
            'noopener,noreferrer',
        );

        view.focusSiteMap('paraglidingmap', 45.8, 6.2, 'Annecy');
        expect(openSpy).toHaveBeenLastCalledWith(
            'https://www.paraglidingmap.com/app/?lat=45.8&lng=6.2&zoom=11',
            '_blank',
            'noopener,noreferrer',
        );
    });

    it('toggleFullscreen moves #sites-map-view to document.body and restores it to its original parent', () => {
        const mapView = document.getElementById('sites-map-view');
        const parent = document.getElementById('sites-parent');

        view.toggleFullscreen();
        expect(mapView.classList.contains('map-view-fullscreen')).toBe(true);
        expect(mapView.parentElement).toBe(document.body);
        expect(document.body.style.overflow).toBe('hidden');

        view.toggleFullscreen();
        expect(mapView.classList.contains('map-view-fullscreen')).toBe(false);
        expect(mapView.parentElement).toBe(parent);
        expect(document.body.style.overflow).toBe('');
    });

    it('showSpotItToast escapes siteName HTML and toggles visibility', () => {
        vi.useFakeTimers();
        view.showSpotItToast('<img src=x onerror=alert(1)>');
        const toast = document.getElementById('spot-it-toast');
        expect(toast).not.toBeNull();
        expect(toast.classList.contains('visible')).toBe(true);
        expect(toast.innerHTML).not.toContain('<img');
        expect(toast.innerHTML).toContain('&lt;img');

        vi.advanceTimersByTime(2600);
        expect(toast.classList.contains('visible')).toBe(false);
        vi.useRealTimers();
    });

    it('openMoreMapsDropdown escapes spotted extraId in href and closeMoreMapsDropdown hides the sheet', () => {
        view.state._spottedSite = {
            lat: 45.8,
            lon: 6.2,
            siteName: 'Planfait',
            extraId: '74001"><script>alert(1)</script>',
        };
        view.openMoreMapsDropdown();

        const sheet = document.getElementById('more-maps-bottom-sheet');
        expect(sheet.classList.contains('active')).toBe(true);
        expect(document.getElementById('more-maps-title').textContent).toBe('PLANFAIT');

        const gridHtml = document.getElementById('more-maps-grid').innerHTML;
        expect(gridHtml).not.toContain('<script>');
        expect(gridHtml).toContain('spotair.mobi/spot/ffvl/74001%22%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E');

        view.closeMoreMapsDropdown();
        expect(sheet.classList.contains('active')).toBe(false);
    });

    it('openSpotairModal URL-encodes spotairId and launchGps("apple") uses HTTPS', () => {
        document.body.innerHTML += `
            <dialog id="spotair-modal">
                <h3 id="spotair-modal-title"></h3>
                <div id="spotair-modal-iframe"></div>
            </dialog>
            <div id="gps-bottom-sheet"></div>
        `;
        view.openSpotairModal('99" onload="alert(1)', 'unknown-site');
        const iframe = /** @type {HTMLIFrameElement} */ (document.getElementById('spotair-modal-iframe'));
        expect(iframe.src).toBe('https://www.spotair.mobi/page/wind/ffvl/99%22%20onload%3D%22alert(1)');

        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
        view.openGpsMenu(45.8, 6.2);
        view.launchGps('apple');
        expect(openSpy).toHaveBeenLastCalledWith(
            'https://maps.apple.com/?daddr=45.8,6.2&dirflg=d',
            '_blank',
            'noopener,noreferrer',
        );
    });
});
