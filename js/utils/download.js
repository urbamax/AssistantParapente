/**
 * UTILS - Download
 * Hands a text file to the browser's download (temporary link, no server involved).
 */

/**
 * @param {string} filename
 * @param {string} text
 * @param {string} [mime]
 */
export function saveTextFile(filename, text, mime = 'text/plain') {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
