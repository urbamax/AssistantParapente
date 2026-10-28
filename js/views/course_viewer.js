/**
 * VIEW - Visionneuse de cours (PDF)
 * Affiche un cours par-dessus l'écran en cours, avec un bouton « Retour » : l'écran dessous (par
 * exemple la question du QCM) n'est ni quitté ni rechargé. Utilisée par l'application installée, qui
 * n'a pas de bouton retour du navigateur (voir js/core/course_link.js).
 *
 * Le rendu est fait par pdf.js (vendor/pdfjs-*, Apache-2.0), chargé seulement à la première ouverture.
 * Les pages sont dessinées à la demande, au fil du défilement, pour ne pas saturer la mémoire d'un
 * téléphone avec un livret de plusieurs centaines de pages.
 */
import { escapeHTML } from '../core/security.js';
import { COURSES_DATA } from '../data/courses_data.js';
import { t } from '../utils/i18n.js';

const PDFJS_DIR = 'vendor/pdfjs-6.4.299/';
const ZOOM_MIN = 1; // la page remplit la largeur de l'écran
const ZOOM_MAX = 4;
const ZOOM_BUTTON_STEP = 1.25;
const MAX_PIXEL_RATIO = 2;

let pdfjsPromise = null;
let active = null;

/** Chargé à la demande, par adresse complète : le build ne doit pas l'inclure dans ses fichiers. */
function loadPdfJs() {
    pdfjsPromise ??= import(/* @vite-ignore */ new URL(`${PDFJS_DIR}pdf.min.js`, document.baseURI).href).then(
        (lib) => {
            lib.GlobalWorkerOptions.workerSrc = new URL(`${PDFJS_DIR}pdf.worker.min.js`, document.baseURI).href;
            return lib;
        },
        (error) => {
            pdfjsPromise = null;
            throw error;
        },
    );
    return pdfjsPromise;
}

/**
 * Adresse du PDF (sans ancre), page demandée (#page=N, 1 par défaut) et titre du cours.
 * @param {string} url
 */
export function describeCourseUrl(url) {
    const full = new URL(url, document.baseURI);
    const page = Number(/(?:^|[#&])page=(\d+)/.exec(full.hash)?.[1]) || 1;
    const path = decodeURIComponent(full.pathname);
    const course = Object.values(COURSES_DATA).find((c) =>
        [c.pdf, c.original_pdf].some((file) => file && path.endsWith(`/${file.normalize('NFC')}`)),
    );
    full.hash = '';
    return { pdfUrl: full.href, page, title: course?.title || t('courseViewer.fallbackTitle') };
}

function buildOverlay(title) {
    const overlay = document.createElement('div');
    overlay.className = 'course-viewer-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', title);
    overlay.innerHTML = `
        <div class="cv-bar">
            <button type="button" class="cv-back" aria-label="${escapeHTML(t('courseViewer.backLabel'))}">
                <i class="ri-arrow-left-line" aria-hidden="true"></i> ${escapeHTML(t('courseViewer.back'))}
            </button>
            <div class="cv-title">${escapeHTML(title)}</div>
            <span class="cv-page" aria-live="polite"></span>
            <button type="button" class="cv-zoom-out" aria-label="${escapeHTML(t('courseViewer.zoomOut'))}">
                <i class="ri-subtract-line" aria-hidden="true"></i>
            </button>
            <button type="button" class="cv-zoom-in" aria-label="${escapeHTML(t('courseViewer.zoomIn'))}">
                <i class="ri-add-line" aria-hidden="true"></i>
            </button>
        </div>
        <div class="cv-scroll" tabindex="0"><div class="cv-pages"></div></div>
        <div class="cv-status" role="status">${escapeHTML(t('courseViewer.loading'))}</div>`;
    return overlay;
}

/**
 * Ouvre le cours dans la visionneuse. Si pdf.js ou le document ne se charge pas, propose d'ouvrir
 * le PDF directement (comportement d'avant).
 * @param {string} url adresse du PDF, avec éventuellement #page=N
 */
export async function openCourseViewer(url) {
    if (active) return;
    const { pdfUrl, page: firstPage, title } = describeCourseUrl(url);

    const overlay = buildOverlay(title);
    const $ = (selector) => /** @type {HTMLElement} */ (overlay.querySelector(selector));
    const scroller = $('.cv-scroll');
    const pagesEl = $('.cv-pages');
    const status = $('.cv-status');
    const pageLabel = $('.cv-page');

    let pdf = null;
    let loadingTask = null;
    let observer = null;
    let zoom = ZOOM_MIN;
    let closed = false;
    const renderTasks = new Map(); // page -> tâche pdf.js en cours de dessin
    const inflight = new Map(); // page -> promesse du rendu en cours (de la demande à la fin)
    let generation = 0; // change à chaque zoom : un rendu d'avant n'est pas posé
    const opener = /** @type {HTMLElement | null} */ (document.activeElement);

    const pageWidth = () => Math.max(200, (scroller.clientWidth - 16) * zoom);

    function close() {
        if (closed) return;
        closed = true;
        observer?.disconnect();
        renderTasks.forEach((task) => task.cancel());
        loadingTask?.destroy();
        document.removeEventListener('keydown', onKeydown, true);
        window.removeEventListener('popstate', close);
        overlay.remove();
        document.body.classList.remove('course-viewer-open');
        active = null;
        opener?.focus?.({ preventScroll: true }); // l'écran dessous ne doit pas bouger
    }

    /** Ferme par le retour de l'historique : l'entrée ajoutée à l'ouverture disparaît, et `popstate` ferme. */
    function requestClose() {
        history.back();
    }

    function onKeydown(event) {
        if (event.key !== 'Escape') return;
        event.stopPropagation();
        requestClose();
    }

    function showError() {
        status.innerHTML = `${escapeHTML(t('courseViewer.loadError'))}
            <a class="cv-direct" href="${escapeHTML(pdfUrl)}#page=${firstPage}" target="_blank" rel="noopener noreferrer">${escapeHTML(t('courseViewer.openDirect'))}</a>`;
        status.hidden = false;
        status.classList.add('cv-status-error');
    }

    async function renderPage(box) {
        const number = Number(box.dataset.page);
        // Un rendu annulé (page sortie puis revenue) doit finir avant d'en lancer un autre.
        while (inflight.has(number)) await inflight.get(number);
        const width = pageWidth();
        if (closed || box.dataset.visible !== '1' || box.dataset.renderedWidth === String(width)) return;
        const run = drawPage(box, number, width, generation);
        inflight.set(number, run);
        try {
            await run;
        } finally {
            inflight.delete(number);
        }
    }

    async function drawPage(box, number, width, forGeneration) {
        try {
            const page = await pdf.getPage(number);
            const base = page.getViewport({ scale: 1 });
            const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
            const viewport = page.getViewport({ scale: (width / base.width) * pixelRatio });
            const canvas = document.createElement('canvas');
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${(width * base.height) / base.width}px`;
            const task = page.render({ canvas, viewport });
            renderTasks.set(number, task);
            try {
                await task.promise;
            } finally {
                renderTasks.delete(number);
            }
            if (closed || forGeneration !== generation || box.dataset.visible !== '1') return;
            box.style.height = canvas.style.height;
            box.replaceChildren(canvas);
            box.dataset.renderedWidth = String(width);
            page.cleanup();
        } catch (error) {
            // Un rendu annulé (page sortie de l'écran ou zoom modifié) est normal ; autre chose : case vide
            if (error?.name !== 'RenderingCancelledException') console.warn('Course page failed:', number, error);
        }
    }

    /** Libère la mémoire des pages loin de l'écran ; elles seront redessinées au retour. */
    function release(box) {
        box.dataset.visible = '0';
        renderTasks.get(Number(box.dataset.page))?.cancel();
        if (box.firstChild) {
            const canvas = /** @type {HTMLCanvasElement} */ (box.firstChild);
            canvas.width = canvas.height = 0;
            box.replaceChildren();
        }
        delete box.dataset.renderedWidth;
    }

    /** Redimensionne toutes les cases (hauteurs proportionnelles) et redessine celles qui sont visibles. */
    async function layoutPages(factor) {
        generation++;
        const width = pageWidth();
        for (const box of /** @type {HTMLElement[]} */ ([...pagesEl.children])) {
            box.style.width = `${width}px`;
            box.style.height = `${parseFloat(box.style.height) * factor}px`;
            release(box);
        }
        await Promise.allSettled([...inflight.values()]);
        // Les pages visibles sont redessinées par l'observateur, dès qu'il les revoit.
        observer?.disconnect();
        if (!closed) for (const box of pagesEl.children) observer?.observe(box);
    }

    /**
     * Change le zoom en gardant sous le doigt (ou au centre de l'écran) le point du cours qui y était.
     * @param {number} next nouveau zoom, ramené entre ZOOM_MIN et ZOOM_MAX
     * @param {{x: number, y: number}} [focal] point fixe, en pixels de la fenêtre
     */
    function setZoom(next, focal) {
        next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
        $('.cv-zoom-out').toggleAttribute('disabled', next <= ZOOM_MIN);
        $('.cv-zoom-in').toggleAttribute('disabled', next >= ZOOM_MAX);
        if (next === zoom) return;
        const view = scroller.getBoundingClientRect();
        const fx = (focal?.x ?? view.left + view.width / 2) - view.left;
        const fy = (focal?.y ?? view.top + view.height / 2) - view.top;
        // La page sous le point fixe, et où dans cette page (en proportion).
        const boxes = /** @type {HTMLElement[]} */ ([...pagesEl.children]);
        const anchor = boxes.find((box) => box.getBoundingClientRect().bottom >= view.top + fy) ?? boxes[0];
        const rect = anchor.getBoundingClientRect();
        const fracX = (view.left + fx - rect.left) / rect.width;
        const fracY = (view.top + fy - rect.top) / rect.height;
        const factor = next / zoom;
        zoom = next;
        layoutPages(factor);
        scroller.scrollLeft = anchor.offsetLeft + fracX * anchor.offsetWidth - fx;
        scroller.scrollTop = anchor.offsetTop + fracY * anchor.offsetHeight - fy;
    }

    /**
     * Zoom au pincement : pendant le geste la page est seulement agrandie à l'écran (fluide) ; le
     * redessin net se fait une fois les doigts levés. Seules les pages du cours zooment : la barre et
     * l'application restent à leur taille (le zoom de la page est verrouillé dans toute l'application,
     * voir js/core/events.js ; ces événements tactiles ne sont pas des gestes de page).
     */
    function enablePinchZoom() {
        const distance = (touches) =>
            Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
        const middle = (touches) => ({
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2,
        });
        let pinch = null;
        const clamp = (value) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));

        scroller.addEventListener(
            'touchstart',
            (event) => {
                if (event.touches.length !== 2) return;
                const view = scroller.getBoundingClientRect();
                const focal = middle(event.touches);
                pinch = { startDistance: distance(event.touches), startZoom: zoom, focal, scale: 1 };
                pagesEl.style.transformOrigin = `${scroller.scrollLeft + focal.x - view.left}px ${scroller.scrollTop + focal.y - view.top}px`;
            },
            { passive: true },
        );
        scroller.addEventListener(
            'touchmove',
            (event) => {
                if (!pinch || event.touches.length !== 2) return;
                event.preventDefault();
                pinch.scale =
                    clamp(pinch.startZoom * (distance(event.touches) / pinch.startDistance)) / pinch.startZoom;
                pagesEl.style.transform = `scale(${pinch.scale})`;
            },
            { passive: false },
        );
        const end = (event) => {
            if (!pinch || event.touches.length >= 2) return;
            const { startZoom, scale, focal } = pinch;
            pinch = null;
            pagesEl.style.transform = '';
            pagesEl.style.transformOrigin = '';
            setZoom(startZoom * scale, focal);
        };
        scroller.addEventListener('touchend', end);
        scroller.addEventListener('touchcancel', end);
    }

    /** La page qui touche le haut de l'écran de lecture. */
    function currentPage() {
        const top = scroller.getBoundingClientRect().top + 24;
        let number = 1;
        for (const box of pagesEl.children) {
            if (box.getBoundingClientRect().top > top) break;
            number = Number(/** @type {HTMLElement} */ (box).dataset.page);
        }
        return number;
    }

    function goToPage(number) {
        const box = /** @type {HTMLElement | null} */ (pagesEl.children[number - 1]);
        if (box) scroller.scrollTop = box.offsetTop;
    }

    function updatePageLabel() {
        pageLabel.textContent = t('courseViewer.pageOf', { page: currentPage(), total: pdf.numPages });
    }

    $('.cv-back').addEventListener('click', requestClose);
    $('.cv-zoom-out').addEventListener('click', () => setZoom(zoom / ZOOM_BUTTON_STEP));
    $('.cv-zoom-in').addEventListener('click', () => setZoom(zoom * ZOOM_BUTTON_STEP));
    $('.cv-zoom-out').setAttribute('disabled', '');
    enablePinchZoom();
    document.addEventListener('keydown', onKeydown, true);
    // Retour du téléphone ou geste de retour : ferme le cours et laisse l'écran en dessous tel quel
    // (le routeur ignore ce retour-là tant que la visionneuse est ouverte, voir router.js).
    history.pushState(history.state, '');
    window.addEventListener('popstate', close);

    active = { close };
    document.body.classList.add('course-viewer-open');
    document.body.appendChild(overlay);
    $('.cv-back').focus({ preventScroll: true });

    try {
        const lib = await loadPdfJs();
        loadingTask = lib.getDocument({ url: pdfUrl, isEvalSupported: false, useWasm: false });
        pdf = await loadingTask.promise;
        if (closed) return;

        const first = await pdf.getPage(1);
        const base = first.getViewport({ scale: 1 });
        const ratio = base.height / base.width; // pages pas encore dessinées : même forme que la première

        const start = Math.min(Math.max(1, firstPage), pdf.numPages);
        const width = pageWidth();
        for (let number = 1; number <= pdf.numPages; number++) {
            const box = document.createElement('div');
            box.className = 'cv-page-box';
            box.dataset.page = String(number);
            box.style.width = `${width}px`;
            box.style.height = `${width * ratio}px`;
            pagesEl.appendChild(box);
        }
        observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    const box = /** @type {HTMLElement} */ (entry.target);
                    if (entry.isIntersecting) {
                        box.dataset.visible = '1';
                        renderPage(box);
                    } else release(box);
                }
            },
            { root: scroller, rootMargin: '100% 0px' },
        );
        for (const box of pagesEl.children) observer.observe(box);

        status.hidden = true;
        goToPage(start);
        updatePageLabel();
        scroller.addEventListener('scroll', updatePageLabel, { passive: true });
    } catch (error) {
        if (closed) return;
        console.error('Course viewer failed:', error);
        showError();
    }
}
