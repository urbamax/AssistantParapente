import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AppRouter, { lazyViewModule, viewProxy } from '../../js/core/router.js';

// Code-splitting : les écrans ne sont téléchargés qu'au premier besoin. Le routeur doit les charger
// sans rien changer pour l'utilisateur : même ordre démontage/montage, même écran d'erreur.
const makeView = (extra = {}) => ({ mount: vi.fn(async () => {}), unmount: vi.fn(async () => {}), ...extra });

let counter = 0;
const newMode = () => `LAZYTEST${++counter}`;
const addScreen = (mode) => {
    const el = document.createElement('div');
    el.id = `${mode.toLowerCase()}-screen`;
    el.className = 'mode-screen';
    document.body.appendChild(el);
    return el;
};

beforeEach(() => {
    document.body.innerHTML = '';
    vi.spyOn(console, 'time').mockImplementation(() => {});
    vi.spyOn(console, 'timeEnd').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('lazyViewModule', () => {
    it('ne télécharge rien avant le premier besoin, puis une seule fois', async () => {
        const view = makeView();
        const importer = vi.fn(async () => ({ default: view }));
        const module = lazyViewModule(importer);
        expect(importer).not.toHaveBeenCalled();
        expect(module.peek()).toBeUndefined();

        const [a, b] = await Promise.all([module.load(), module.load()]);
        await module.load();
        expect(a).toBe(view);
        expect(b).toBe(view);
        expect(importer).toHaveBeenCalledTimes(1);
        expect(module.peek()).toBe(view);
    });

    it('accepte un module sans export par défaut', async () => {
        const module = lazyViewModule(async () => ({ mount() {} }));
        expect(typeof (await module.load()).mount).toBe('function');
    });

    it('ne garde pas un échec : le prochain essai recharge (réseau revenu)', async () => {
        const view = makeView();
        const importer = vi
            .fn()
            .mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module'))
            .mockResolvedValueOnce({ default: view });
        const module = lazyViewModule(importer);
        await expect(module.load()).rejects.toThrow('Failed to fetch');
        expect(module.peek()).toBeUndefined();
        expect(await module.load()).toBe(view);
        expect(importer).toHaveBeenCalledTimes(2);
    });
});

describe('AppRouter avec un écran chargé à la demande', () => {
    it('getView ne renvoie la vue qu’une fois chargée ; loadView la charge', async () => {
        const mode = newMode();
        const view = makeView();
        AppRouter.register(
            mode,
            lazyViewModule(async () => ({ default: view })),
        );
        expect(AppRouter.getView(mode)).toBeUndefined();
        expect(await AppRouter.loadView(mode)).toBe(view);
        expect(AppRouter.getView(mode)).toBe(view);
    });

    it('une vue enregistrée directement reste disponible tout de suite (compatibilité)', async () => {
        const mode = newMode();
        const view = makeView();
        AppRouter.register(mode, view);
        expect(AppRouter.getView(mode)).toBe(view);
        expect(await AppRouter.loadView(mode)).toBe(view);
    });

    it('plusieurs routes qui partagent le même écran ne le chargent qu’une fois', async () => {
        const importer = vi.fn(async () => ({ default: makeView() }));
        const shared = lazyViewModule(importer);
        const [a, b] = [newMode(), newMode()];
        AppRouter.register(a, shared);
        AppRouter.register(b, shared);
        await AppRouter.loadView(a);
        await AppRouter.loadView(b);
        expect(importer).toHaveBeenCalledTimes(1);
        expect(AppRouter.getView(b)).toBe(AppRouter.getView(a));
    });

    it('loadView refuse une route inconnue', async () => {
        await expect(AppRouter.loadView('INCONNUE')).rejects.toThrow('Route not found');
    });

    it('navigate charge puis monte l’écran, avec les paramètres', async () => {
        const mode = newMode();
        addScreen(mode);
        const view = makeView();
        AppRouter.register(
            mode,
            lazyViewModule(async () => ({ default: view })),
        );
        await AppRouter.navigate(mode, { pushState: false, x: 1 });
        expect(view.mount).toHaveBeenCalledTimes(1);
        expect(view.mount).toHaveBeenCalledWith({ pushState: false, x: 1 });
        expect(document.getElementById(`${mode.toLowerCase()}-screen`).classList.contains('active')).toBe(true);
    });

    it('le téléchargement démarre pendant le démontage de l’écran précédent, pas après', async () => {
        const [from, to] = [newMode(), newMode()];
        addScreen(from);
        addScreen(to);
        const events = [];
        let finishUnmount;
        const previous = makeView({
            unmount: vi.fn(
                () =>
                    new Promise((resolve) => {
                        finishUnmount = () => {
                            events.push('démontage terminé');
                            resolve();
                        };
                    }),
            ),
        });
        AppRouter.register(from, previous);
        await AppRouter.navigate(from, { pushState: false });

        const importer = vi.fn(async () => {
            events.push('téléchargement démarré');
            return { default: makeView() };
        });
        AppRouter.register(to, lazyViewModule(importer));
        const navigation = AppRouter.navigate(to, { pushState: false });
        await vi.waitFor(() => expect(previous.unmount).toHaveBeenCalled());
        expect(events).toEqual(['téléchargement démarré']);
        finishUnmount();
        await navigation;
        expect(events).toEqual(['téléchargement démarré', 'démontage terminé']);
    });

    it('un échec de chargement affiche l’écran d’erreur au lieu de planter, et le chargement suivant réessaie', async () => {
        const mode = newMode();
        const screen = addScreen(mode);
        const view = makeView();
        const importer = vi
            .fn()
            .mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module'))
            .mockResolvedValueOnce({ default: view });
        AppRouter.register(mode, lazyViewModule(importer));

        await expect(AppRouter.navigate(mode, { pushState: false })).resolves.toBeUndefined();
        expect(screen.textContent).toContain('Failed to fetch dynamically imported module');
        expect(screen.querySelector('[data-action="reloadApp"]')).not.toBeNull();
        expect(view.mount).not.toHaveBeenCalled();

        await AppRouter.navigate(mode, { pushState: false });
        expect(view.mount).toHaveBeenCalledTimes(1);
    });

    it('une erreur au montage affiche toujours le même écran d’erreur', async () => {
        const mode = newMode();
        const screen = addScreen(mode);
        AppRouter.register(
            mode,
            makeView({
                mount: vi.fn(async () => {
                    throw new Error('boom au montage');
                }),
            }),
        );
        await AppRouter.navigate(mode, { pushState: false });
        expect(screen.textContent).toContain('boom au montage');
        expect(screen.querySelector('[data-action="reloadApp"]')).not.toBeNull();
    });
});

describe('viewProxy', () => {
    it('charge l’écran au premier appel, transmet les arguments et renvoie le résultat', async () => {
        const view = makeView({ greet: vi.fn((a, b) => `${a}-${b}`) });
        const importer = vi.fn(async () => ({ default: view }));
        const proxy = viewProxy(lazyViewModule(importer));
        expect(importer).not.toHaveBeenCalled();
        expect(await proxy.greet('x', 2)).toBe('x-2');
        expect(await proxy.greet('y', 3)).toBe('y-3');
        expect(importer).toHaveBeenCalledTimes(1);
        expect(view.greet).toHaveBeenCalledWith('x', 2);
    });

    it('une vue déjà chargée est appelée tout de suite, de façon synchrone, comme un appel direct', async () => {
        const order = [];
        const view = makeView({
            act: vi.fn(() => {
                order.push('méthode exécutée');
                return 'résultat';
            }),
        });
        const module = lazyViewModule(async () => ({ default: view }));
        const proxy = viewProxy(module);
        await module.load();

        order.push('avant l’appel');
        const result = proxy.act();
        order.push('après l’appel');

        // Pas de promesse, pas d'attente : la méthode a déjà tourné quand l'appel rend la main.
        expect(order).toEqual(['avant l’appel', 'méthode exécutée', 'après l’appel']);
        expect(result).toBe('résultat');
    });

    it('une vue déjà chargée voit encore la liste de fichiers vivante d’un champ, avant qu’on le vide', async () => {
        // Régression : main.js appelle la vue puis vide le champ (value = ''), ce qui vide aussi input.files.
        const input = document.createElement('input');
        input.type = 'file';
        const live = { items: ['trace.igc'] }; // liste vivante simulée
        const seen = [];
        const module = lazyViewModule(async () => ({
            default: makeView({ importFiles: (list) => seen.push(...list.items) }),
        }));
        const proxy = viewProxy(module);
        await module.load();

        proxy.importFiles(live);
        live.items = []; // ce que fait « input.value = '' » juste après l'appel
        expect(seen).toEqual(['trace.igc']);
        void input;
    });

    it('le premier appel, avant le chargement, renvoie une promesse et s’exécute une fois la vue chargée', async () => {
        const view = makeView({ act: vi.fn(() => 'ok') });
        const proxy = viewProxy(lazyViewModule(async () => ({ default: view })));
        const pending = proxy.act();
        expect(pending).toBeInstanceOf(Promise);
        expect(view.act).not.toHaveBeenCalled();
        expect(await pending).toBe('ok');
        expect(view.act).toHaveBeenCalledTimes(1);
    });

    it('une méthode absente de la vue renvoie null (comme l’ancien « vue[action] ? … : null »)', async () => {
        const proxy = viewProxy(lazyViewModule(async () => ({ default: makeView() })));
        expect(await proxy.nexistePas('a')).toBeNull();
    });

    it('ne ressemble pas à une promesse (then absent) et ignore les symboles', async () => {
        const proxy = viewProxy(lazyViewModule(async () => ({ default: makeView() })));
        expect(proxy.then).toBeUndefined();
        expect(proxy[Symbol.toPrimitive]).toBeUndefined();
        await expect(Promise.resolve(proxy)).resolves.toBe(proxy);
    });

    it('propage une erreur de la méthode appelée', async () => {
        const proxy = viewProxy(
            lazyViewModule(async () => ({
                default: makeView({
                    fail() {
                        throw new Error('échec de la vue');
                    },
                }),
            })),
        );
        await expect(proxy.fail()).rejects.toThrow('échec de la vue');
    });
});
