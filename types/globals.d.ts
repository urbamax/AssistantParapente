// Globals that TypeScript cannot see: libraries loaded from CDN <script> tags, data put on
// `window` at boot.
export {};

declare global {
    interface Window {
        FirebaseAuthEngine: any;
        LibraryEngine: any;
        QCM_OFFICIAL: any;
        SITES_DATA: any[];
    }

    const SITES_DATA: any[];
    const QCM_OFFICIAL: any;
    const L: any;
    const maplibregl: any;
    const deck: any;
}
