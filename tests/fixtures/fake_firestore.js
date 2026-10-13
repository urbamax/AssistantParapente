import { vi } from 'vitest';

/** Firestore en mémoire : juste ce que syncDataWithCloud utilise. */
export function createFakeFirestore(initialDocs = {}) {
    const docs = new Map(Object.entries(initialDocs));
    const ref = (_db, ...segments) => ({ path: segments.join('/') });
    return {
        docs,
        module: {
            doc: ref,
            collection: ref,
            getDoc: async (r) => ({ exists: () => docs.has(r.path), data: () => docs.get(r.path) }),
            setDoc: vi.fn(async (r, data) => {
                docs.set(r.path, JSON.parse(JSON.stringify(data)));
            }),
            deleteDoc: vi.fn(async (r) => {
                docs.delete(r.path);
            }),
            getDocs: async (col) => {
                const prefix = `${col.path}/`;
                const matches = [...docs.entries()].filter(
                    ([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'),
                );
                return { forEach: (cb) => matches.forEach(([, data]) => cb({ data: () => data })) };
            },
        },
    };
}
