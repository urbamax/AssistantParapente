// Globals that TypeScript cannot see: libraries loaded from CDN <script> tags, data put on
// `window` at boot.
export {};

declare global {
    interface Window {
        FirebaseAuthEngine: any;
        LibraryEngine: any;
    }

    const L: any;
    const maplibregl: any;
    const deck: any;
}
