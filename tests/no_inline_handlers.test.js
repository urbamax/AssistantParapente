import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const INLINE_HANDLER =
    /\son(click|input|change|keydown|keyup|keypress|submit|focus|blur|mouseover|mouseout|error|load)\s*=/i;

function listFiles(dir, exts) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return listFiles(full, exts);
        return exts.some((ext) => entry.name.endsWith(ext)) ? [full] : [];
    });
}

describe('no inline event handlers', () => {
    const files = [
        path.join(root, 'index.html'),
        ...listFiles(path.join(root, 'components'), ['.html']),
        ...listFiles(path.join(root, 'js'), ['.js']),
    ];

    it.each(files.map((f) => [path.relative(root, f), f]))(
        '%s uses data-* actions, not on*= attributes',
        (_name, file) => {
            const offending = fs
                .readFileSync(file, 'utf8')
                .split('\n')
                .map((line, i) => ({ line, n: i + 1 }))
                .filter(
                    ({ line }) =>
                        INLINE_HANDLER.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*'),
                );
            expect(offending.map(({ n }) => n)).toEqual([]);
        },
    );
});
