import { describe, it, expect, afterEach, vi } from 'vitest';
import Map3DComponent from '../../js/components/map_3d.js';

// Le relief gratuit est grossier (la falaise du Blanc-Nez « déborde » sur la plage à 27 m) : la
// trace, le point du pilote et son étiquette ne doivent jamais être cachés par lui.
describe('3D trace layers are drawn above the terrain', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('disables the depth test of the path, the pilot marker and its label', () => {
        const Layer = class {
            constructor(props) {
                this.props = props;
            }
        };
        vi.stubGlobal('deck', { PathLayer: Layer, ScatterplotLayer: Layer, TextLayer: Layer });
        const trace = [
            { lat: 50.9213, lon: 1.7018, alt: 0, time: '15:03:56' },
            { lat: 50.9214, lon: 1.7017, alt: 0, time: '15:03:57' },
        ];
        const vario = Map3DComponent._computeVarioSeries(trace);
        const layers = Map3DComponent._buildDeckLayers(
            trace,
            Map3DComponent._buildPathSegments(trace, vario),
            vario,
            1,
        );
        expect(layers.map((l) => l.props.id)).toEqual(['flight-path', 'pilot-marker', 'pilot-label']);
        for (const layer of layers) {
            expect(layer.props.parameters, layer.props.id).toMatchObject({ depthCompare: 'always' });
        }
    });
});
