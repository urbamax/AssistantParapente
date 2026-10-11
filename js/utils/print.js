/**
 * UTILS - Print
 * Prints an HTML document through the browser ("Save as PDF" is offered by the print dialog).
 * A hidden iframe is used instead of a popup, which blockers would refuse.
 */

/**
 * @param {string} html complete HTML document
 * @returns {Promise<void>} resolves once the print dialog has been requested
 */
export function printHtml(html) {
    return new Promise((resolve, reject) => {
        const frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden;';
        frame.onload = () => {
            try {
                frame.contentWindow.focus();
                frame.contentWindow.print();
                resolve();
            } catch (error) {
                reject(error);
            } finally {
                setTimeout(() => frame.remove(), 60_000);
            }
        };
        frame.srcdoc = html;
        document.body.appendChild(frame);
    });
}
