#!/usr/bin/env bash
# Instala o Nexo num container Debian (LXC do Proxmox). Rode como root:
#   bash setup.sh
# Antes, coloque o arquivo de ambiente em /opt/nexo/shared/.env
# (DATABASE_URL, BETTER_AUTH_SECRET). O BETTER_AUTH_URL é ajustado aqui.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/glaucohd/nexo.git}"
BRANCH="${BRANCH:-next-migration}"
PORT="${PORT:-3000}"
ROOT=/opt/nexo

if [ ! -f "$ROOT/shared/.env" ]; then
  mkdir -p "$ROOT/shared"
  echo "Falta $ROOT/shared/.env. Copie o .env do projeto para lá e rode de novo." >&2
  exit 1
fi

echo "==> Pacotes do sistema"
apt-get update -qq
apt-get install -y -qq ca-certificates curl git rsync util-linux >/dev/null

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  echo "==> Node.js 24 LTS"
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "    node $(node -v), npm $(npm -v)"

echo "==> Usuário e pastas"
id nexo >/dev/null 2>&1 || useradd --system --home-dir "$ROOT" --shell /usr/sbin/nologin nexo
mkdir -p "$ROOT/releases" "$ROOT/shared"
printf 'BRANCH=%s\nPORT=%s\n' "$BRANCH" "$PORT" > "$ROOT/shared/deploy.env"

# O login só aceita requisições vindas da URL configurada: usa o IP do container.
IP="$(hostname -I | awk '{print $1}')"
URL="http://$IP:$PORT"
if grep -q '^BETTER_AUTH_URL=' "$ROOT/shared/.env"; then
  sed -i "s|^BETTER_AUTH_URL=.*|BETTER_AUTH_URL=$URL|" "$ROOT/shared/.env"
else
  printf '\nBETTER_AUTH_URL=%s\n' "$URL" >> "$ROOT/shared/.env"
fi
chmod 600 "$ROOT/shared/.env"

echo "==> Código"
if [ ! -d "$ROOT/src/.git" ]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$ROOT/src"
else
  # Reinstalação: traz o código mais novo para os serviços abaixo também serem.
  git -C "$ROOT/src" fetch --quiet origin "$BRANCH"
  git -C "$ROOT/src" reset --quiet --hard "origin/$BRANCH"
fi
chown -R nexo:nexo "$ROOT"

echo "==> Serviços"
install -m 755 "$ROOT/src/apps/web/deploy/update.sh" /usr/local/bin/nexo-update
install -m 644 "$ROOT/src/apps/web/deploy/nexo.service" /etc/systemd/system/nexo.service
install -m 644 "$ROOT/src/apps/web/deploy/nexo-update.service" /etc/systemd/system/nexo-update.service
install -m 644 "$ROOT/src/apps/web/deploy/nexo-update.timer" /etc/systemd/system/nexo-update.timer
systemctl daemon-reload

echo "==> Primeiro build (alguns minutos)"
FORCE=1 /usr/local/bin/nexo-update

systemctl enable --now nexo.service nexo-update.timer
systemctl restart nexo-update.timer
echo
echo "Pronto: abra $URL"
