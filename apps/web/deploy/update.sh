#!/usr/bin/env bash
# Atualiza o Nexo quando há commit novo na branch configurada.
# Cada versão é montada numa pasta própria em /opt/nexo/releases; só depois
# de instalar e compilar com sucesso o link /opt/nexo/current passa a apontar
# para ela e o serviço reinicia. Se o build falhar, o site segue na versão
# anterior. FORCE=1 reconstrói mesmo sem commit novo.
set -euo pipefail

ROOT=/opt/nexo
# shellcheck disable=SC1091
. "$ROOT/shared/deploy.env"

# Uma atualização por vez.
exec 9>"$ROOT/shared/update.lock"
flock -n 9 || { echo "Atualização já em andamento."; exit 0; }

as_nexo() { runuser -u nexo -- "$@"; }

cd "$ROOT/src"
as_nexo git fetch --quiet origin "$BRANCH"
TARGET="$(as_nexo git rev-parse "origin/$BRANCH")"
CURRENT="$(readlink -f "$ROOT/current" 2>/dev/null | xargs -r basename || true)"

if [ "${FORCE:-0}" != "1" ] && [ "$CURRENT" = "$TARGET" ]; then
  exit 0
fi

echo "==> Atualizando para ${TARGET:0:7}"
as_nexo git reset --quiet --hard "$TARGET"

RELEASE="$ROOT/releases/$TARGET"
rm -rf "$RELEASE"
as_nexo mkdir -p "$RELEASE"
as_nexo rsync -a --delete --exclude node_modules --exclude .next --exclude .env "$ROOT/src/apps/web/" "$RELEASE/"
as_nexo ln -sfn "$ROOT/shared/.env" "$RELEASE/.env"

cd "$RELEASE"
if ! as_nexo npm ci --no-audit --no-fund --loglevel=error || ! as_nexo npm run build; then
  echo "Build falhou; o site continua na versão anterior." >&2
  rm -rf "$RELEASE"
  exit 1
fi

ln -sfn "$RELEASE" "$ROOT/current"
chown -h nexo:nexo "$ROOT/current"
systemctl restart nexo.service
echo "==> No ar: ${TARGET:0:7}"

# Guarda só as 3 versões mais recentes.
ls -1dt "$ROOT"/releases/*/ | tail -n +4 | xargs -r rm -rf
