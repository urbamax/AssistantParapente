#!/bin/sh
# À lancer une fois sur le serveur qui sert le site depuis les sources (git pull, sans build) :
#   sh scripts/install_update_hook.sh
# Après chaque « git pull » (ou checkout), le hook écrit version.json avec le commit courant.
# L'application ouverte le relit toutes les 5 minutes et affiche « Mettre à jour » dès qu'il
# change, c'est-à-dire à la moindre modification du dépôt.
set -e
cd "$(dirname "$0")/.."
HOOKS_DIR="$(git rev-parse --git-path hooks)"
for HOOK in post-merge post-checkout post-rewrite; do
    cat > "$HOOKS_DIR/$HOOK" <<'HOOK'
#!/bin/sh
cd "$(git rev-parse --show-toplevel)" && printf '{"version":"%s"}\n' "$(git rev-parse HEAD)" > version.json
HOOK
    chmod +x "$HOOKS_DIR/$HOOK"
done
printf '{"version":"%s"}\n' "$(git rev-parse HEAD)" > version.json
echo "Hook installé : version.json = $(cat version.json)"
