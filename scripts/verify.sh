#!/usr/bin/env bash
# Reproduit la CI GitHub (.github/workflows/ci.yml) en local, le plus fidèlement possible.
#   scripts/verify.sh          -> job « lint-and-test »
#   scripts/verify.sh --e2e    -> + job « e2e » (installe les navigateurs Playwright, puis Chromium + WebKit)
#
# Ce que ça reproduit comme la CI : un clone propre du commit courant (pas ton dossier de travail),
# fusionné avec le dernier origin/main (la CI teste le résultat de la fusion), Node 22, `npm ci`,
# CI=true (1 worker, 2 relances, forbidOnly) et un volume sensible à la casse comme Linux.
# Ce que ça ne peut pas reproduire : le noyau Linux lui-même (polices et WebKit de macOS, Python).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WITH_E2E=0
[[ "${1:-}" == "--e2e" ]] && WITH_E2E=1

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
die()  { printf '\n\033[31m✖ %s\033[0m\n' "$1" >&2; exit 1; }

cd "$ROOT"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] \
    || die "Des modifications ne sont pas commitées : la CI ne verrait pas ton dossier de travail. Commite d'abord."
SHA="$(git rev-parse HEAD)"

step "Récupération de origin/main"
git fetch -q origin main || printf 'hors ligne : dernier origin/main connu utilisé\n'
git rev-parse -q --verify origin/main >/dev/null || die "origin/main introuvable."

# --- volume sensible à la casse (comme Linux) : un import avec la mauvaise casse y échoue ---
CACHE="$HOME/.cache/ap-verify"
IMAGE="$CACHE/ci.sparseimage"
MNT="$CACHE/mnt"
mkdir -p "$CACHE" "$MNT"
if [[ ! -f "$IMAGE" ]]; then
    step "Création du volume sensible à la casse (une seule fois)"
    hdiutil create -size 6g -type SPARSE -fs "Case-sensitive APFS" -volname ap-verify "${IMAGE%.sparseimage}" >/dev/null
fi
mount | grep -q " on $MNT " || hdiutil attach "$IMAGE" -mountpoint "$MNT" -nobrowse -quiet
trap 'cd /; hdiutil detach "$MNT" -quiet -force >/dev/null 2>&1 || true' EXIT

WORK="$MNT/work"
rm -rf "$WORK"
step "Clone propre de $(git rev-parse --short HEAD) + fusion avec origin/main"
git clone -q "$ROOT" "$WORK"
git -C "$WORK" checkout -q "$SHA"
git -C "$WORK" fetch -q "$ROOT" "refs/remotes/origin/main:refs/remotes/origin/main"
if ! git -C "$WORK" merge-base --is-ancestor origin/main HEAD; then
    git -C "$WORK" -c user.name=ci -c user.email=ci@local merge -q --no-edit origin/main \
        || die "Conflit avec origin/main : résous-le d'abord (la CI ne pourrait pas fusionner non plus)."
fi

run_ci() {
    set -euo pipefail
    cd "$1"
    export CI=true
    [[ "$(node -p 'process.versions.node.split(".")[0]')" == "22" ]] || { echo "Node 22 requis"; exit 1; }
    step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
    step "node $(node -v) · npm ci";  npm ci --no-audit --no-fund --loglevel=error
    step "lint";                      npm run --silent lint
    step "format";                    npm run --silent format:check
    step "typecheck";                 npm run --silent typecheck
    step "tests";                     npm test --silent
    step "tests python ($(python3 -V))"; python3 -m unittest discover -s tests/scripts
    step "build";                     npm run --silent build
    if [[ "$2" == "1" ]]; then
        # Comme la CI (« npx playwright install »). Les navigateurs ne sont pas dans node_modules : ils sont
        # rangés par version de Playwright dans ~/Library/Caches/ms-playwright, donc une mise à jour de
        # Playwright (Dependabot) en exige de nouveaux. Instantané quand ils sont déjà à la bonne version ;
        # sinon un téléchargement (quelques centaines de Mo) depuis le CDN officiel de Playwright.
        step "navigateurs Playwright (Chromium + WebKit)"
        npx playwright install chromium webkit
        step "e2e (Chromium + WebKit, CI=true : 1 worker, 2 relances)"
        npm run --silent test:e2e
    fi
}
export -f run_ci step

npm exec --yes --package=node@22 -- bash -c 'run_ci "$@"' _ "$WORK" "$WITH_E2E"

printf '\n\033[32m✔ Identique à la CI : tout est vert, tu peux envoyer.\033[0m\n'
