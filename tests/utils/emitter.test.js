import { describe, it, expect, vi } from 'vitest';
import { createEmitter } from '../../js/utils/emitter.js';

describe('createEmitter', () => {
    it('appelle chaque abonné avec la donnée, de façon synchrone et dans l’ordre', () => {
        const emitter = createEmitter();
        const calls = [];
        emitter.on('x', (v) => calls.push(['a', v]));
        emitter.on('x', (v) => calls.push(['b', v]));
        emitter.emit('x', 42);
        expect(calls).toEqual([
            ['a', 42],
            ['b', 42],
        ]);
    });

    it('n’appelle que les abonnés de l’événement émis', () => {
        const emitter = createEmitter();
        const other = vi.fn();
        emitter.on('autre', other);
        emitter.emit('x');
        expect(other).not.toHaveBeenCalled();
    });

    it('émettre sans abonné ne fait rien et ne plante pas', () => {
        expect(() => createEmitter().emit('personne')).not.toThrow();
    });

    it('on() renvoie une fonction de désabonnement', () => {
        const emitter = createEmitter();
        const handler = vi.fn();
        const off = emitter.on('x', handler);
        emitter.emit('x');
        off();
        emitter.emit('x');
        expect(handler).toHaveBeenCalledTimes(1);
        expect(emitter.listenerCount('x')).toBe(0);
    });

    it('un même abonné inscrit deux fois n’est appelé qu’une fois (pas de doublon au remontage)', () => {
        const emitter = createEmitter();
        const handler = vi.fn();
        emitter.on('x', handler);
        emitter.on('x', handler);
        emitter.emit('x');
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('un abonné peut se désabonner pendant l’émission sans faire sauter les suivants', () => {
        const emitter = createEmitter();
        const second = vi.fn();
        const off = emitter.on('x', () => off());
        emitter.on('x', second);
        emitter.emit('x');
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('clear() retire un événement ou tous', () => {
        const emitter = createEmitter();
        emitter.on('a', () => {});
        emitter.on('b', () => {});
        emitter.clear('a');
        expect(emitter.listenerCount('a')).toBe(0);
        expect(emitter.listenerCount('b')).toBe(1);
        emitter.clear();
        expect(emitter.listenerCount('b')).toBe(0);
    });
});
