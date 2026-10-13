#!/usr/bin/env bash
# Reproduit en local les contrôles de la CI (.github/workflows/ci.yml) avant d'envoyer du code.
#   scripts/verify.sh          -> job « lint-and-test » (rapide, ≈ 1 min)
#   scripts/verify.sh --e2e    -> + job « e2e » Playwright Chromium et WebKit (plus long)
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }

step "lint";         npm run --silent lint
step "format";       npm run --silent format:check
step "typecheck";    npm run --silent typecheck
step "tests";        npm test --silent
step "tests python"; python3 -m unittest discover -s tests/scripts
step "build";        npm run --silent build

if [[ "${1:-}" == "--e2e" ]]; then
    step "e2e (Chromium + WebKit)"
    npm run --silent test:e2e
fi

printf '\n\033[32m✔ Tout est vert : tu peux envoyer.\033[0m\n'
