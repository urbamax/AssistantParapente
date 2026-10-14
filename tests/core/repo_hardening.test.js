// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

// Garde-fous du durcissement du dépôt public : licence cohérente, CI sans pouvoir inutile, actions
// épinglées, configuration nginx complète. Un retour en arrière échoue ici avant d'être publié.
const read = (file) => readFileSync(file, 'utf8');
const workflows = readdirSync('.github/workflows').filter((f) => /\.ya?ml$/.test(f));

describe('licence', () => {
    it('package.json ne déclare aucune licence permissive : tous droits réservés', () => {
        const pkg = JSON.parse(read('package.json'));
        expect(pkg.license).toBe('UNLICENSED');
        expect(pkg.private).toBe(true);
    });

    it('LICENSE réserve tous les droits et renvoie au contenu tiers', () => {
        const license = read('LICENSE');
        expect(license).toContain('All rights reserved');
        expect(license).toContain('NOTICE');
        expect(license).not.toMatch(/\b(MIT|ISC|Apache|GPL|BSD)\b/);
    });
});

describe.each(workflows)('workflow %s', (file) => {
    const text = read(`.github/workflows/${file}`);

    it('limite le jeton à la lecture par défaut', () => {
        expect(text).toMatch(/^permissions:\n\s+contents: read/m);
    });

    it('épingle chaque action par empreinte de commit', () => {
        const uses = [...text.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map((m) => m[1]).filter((u) => !u.startsWith('./'));
        expect(uses.length).toBeGreaterThan(0);
        for (const u of uses) expect(u, u).toMatch(/@[0-9a-f]{40}$/);
    });

    it("n'utilise pas pull_request_target (exécuterait du code de tiers avec des droits d'écriture)", () => {
        expect(text).not.toContain('pull_request_target');
    });
});

describe('mises à jour automatiques et signalement', () => {
    const dependabot = read('.github/dependabot.yml');
    it.each(['npm', 'github-actions'])('Dependabot surveille %s', (ecosystem) => {
        expect(dependabot).toContain(`package-ecosystem: ${ecosystem}`);
    });
    it('Dependabot surveille aussi le dossier functions', () => {
        expect(dependabot).toContain('directory: /functions');
    });
    it('regroupe les paquets qui doivent évoluer ensemble (une PR isolée échouerait à l’installation)', () => {
        expect(dependabot).toMatch(/firebase-test-tools:[\s\S]*?'firebase'[\s\S]*?'@firebase\/\*'/);
        expect(dependabot).toMatch(/vitest:[\s\S]*?'vitest'[\s\S]*?'@vitest\/\*'/);
        expect(dependabot).toMatch(/github-actions:\n\s+patterns:\n\s+- '\*'/);
    });
    it('ne laisse pas passer de mise à jour majeure de la Cloud Function sans décision (Node 22, émulateur)', () => {
        for (const name of ['firebase-admin', 'firebase-functions']) {
            expect(dependabot).toMatch(
                new RegExp(`dependency-name: ${name}\\n\\s+update-types: \\['version-update:semver-major'\\]`),
            );
        }
    });
    it('SECURITY.md demande un signalement privé', () => {
        expect(read('SECURITY.md')).toMatch(/do not open a public issue/i);
    });
});

describe('configuration nginx de référence', () => {
    const conf = read('deploy/nginx/assistant-parapente.conf');
    it.each([
        'Strict-Transport-Security',
        'X-Content-Type-Options "nosniff"',
        'X-Frame-Options "SAMEORIGIN"',
        'Referrer-Policy',
        'Permissions-Policy',
    ])('envoie %s sur toutes les réponses', (header) => {
        const line = conf.split('\n').find((l) => l.includes(header)) ?? '';
        expect(line, header).toMatch(/^\s*add_header .* always;/);
    });

    it("autorise l'affichage dans un cadre depuis le site lui-même (le lecteur de cours en dépend)", () => {
        expect(conf).toContain(`frame-ancestors 'self'`);
        expect(conf).not.toContain(`frame-ancestors 'none'`);
    });

    it('ne force pas HTTPS sur les autres sous-domaines', () => {
        const directives = conf.split('\n').filter((l) => !l.trim().startsWith('#'));
        expect(directives.join('\n')).not.toContain('includeSubDomains');
    });

    it('autorise la position et le micro pour le site seulement', () => {
        expect(conf).toContain('geolocation=(self)');
        expect(conf).toContain('microphone=(self)');
        expect(conf).toContain('camera=()');
    });

    it("n'accepte que GET et HEAD, et ne sert ni .git, ni tests, ni deploy", () => {
        expect(conf).toMatch(/\$request_method !~ \^\(GET\|HEAD\)\$\) \{ return 405; \}/);
        expect(conf).toMatch(/location ~ \/\\\.\(\?!well-known\/\) \{ return 404; \}/);
        expect(conf).toMatch(/\^\/\(tests\|[^)]*\bdeploy\b[^)]*\)/);
    });

    it('garde version.json hors cache (encart « Mettre à jour »)', () => {
        expect(conf).toMatch(/\/version\.json\s+"no-store"/);
    });
});
