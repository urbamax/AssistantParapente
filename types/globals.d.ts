// Globals that TypeScript cannot see: libraries loaded from classic <script> tags, data put on
// `window` at boot, and platform-specific browser properties.
export {};

declare global {
    interface Window {
        FirebaseAuthEngine: any;
        LibraryEngine: any;
        MSStream?: unknown;
    }

    interface Navigator {
        standalone?: boolean;
    }

    const L: any;
    const maplibregl: any;
    const deck: any;
}
