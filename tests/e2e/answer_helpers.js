import { readFileSync } from 'node:fs';

// Spec 061 (FR-001a) : l'encart « À lire de près » ne s'affiche qu'après une erreur. Ces aides répondent
// exprès juste ou faux, d'après les points du fichier officiel.
function parseCsvLine(line) {
    const out = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quoted) {
            if (ch === '"' && line[i + 1] === '"') ((cur += '"'), i++);
            else if (ch === '"') quoted = false;
            else cur += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') (out.push(cur), (cur = ''));
        else cur += ch;
    }
    out.push(cur);
    return out;
}
const POINTS = new Map(
    readFileSync('js/data/qcm_ffvl.csv', 'utf8')
        .split('\n')
        .map((l) => parseCsvLine(l.replace(/\r$/, '')))
        .filter((f) => /^[A-Z]\d+[A-Z]+$/.test(f[0]))
        .map((f) => {
            const pts = new Map();
            for (let i = 2; i + 1 < f.length; i += 2) if (f[i]) pts.set(f[i].trim(), Number(f[i + 1]));
            return [f[0], pts];
        }),
);

/** Coche les bonnes propositions (correct) ou une seule mauvaise, puis valide. */
export async function answer(page, correct) {
    const code = (await page.locator('#qcm-screen .quiz-meta .bank-item-code').textContent()).trim();
    const pts = POINTS.get(code);
    const texts = await page.locator('#qcm-choices .qcm-option').evaluateAll((els) =>
        els.map((el) => {
            const clone = el.cloneNode(true);
            clone.querySelector('.qcm-option-letter')?.remove();
            return clone.textContent.trim();
        }),
    );
    const scored = texts.map((t, i) => [i, pts.get(t)]);
    const by = (keep) => scored.filter(([, p]) => keep(p)).map(([i]) => i);
    // Faux : une proposition négative, sinon nulle, sinon une seule des bonnes (réponse incomplète).
    const picks = correct
        ? by((p) => p > 0)
        : [...by((p) => p < 0), ...by((p) => p === 0), ...by((p) => p > 0)].slice(0, 1);
    for (const i of picks) await page.locator('#qcm-choices .qcm-option').nth(i).click();
    await page.locator('[data-action="validate-question"]').click();
}
