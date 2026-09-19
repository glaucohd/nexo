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

# Mantém serviços e este próprio script iguais aos do repositório. O script
# é trocado por renomeação (novo arquivo), sem afetar a execução em curso.
DEPLOY="$ROOT/src/apps/web/deploy"
changed=0
for unit in nexo.service nexo-update.service nexo-update.timer; do
  if ! cmp -s "$DEPLOY/$unit" "/etc/systemd/system/$unit"; then
    install -m 644 "$DEPLOY/$unit" "/etc/systemd/system/$unit"
    changed=1
  fi
done
if ! cmp -s "$DEPLOY/update.sh" /usr/local/bin/nexo-update; then
  install -m 755 "$DEPLOY/update.sh" /usr/local/bin/nexo-update.new
  mv /usr/local/bin/nexo-update.new /usr/local/bin/nexo-update
fi
if [ "$changed" = 1 ]; then
  systemctl daemon-reload
  systemctl restart nexo-update.timer
fi

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
