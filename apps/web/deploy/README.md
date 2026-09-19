# Servidor do Nexo (Proxmox de casa)

O Nexo roda num container LXC do Proxmox, acessível na rede de casa:

| | |
|---|---|
| Site | http://192.168.68.74:3000 |
| Proxmox | https://192.168.68.53:8006 (Shell do nó `pve`) |
| Container | 104 `nexo`, Debian 13, 2 núcleos, 3 GB RAM |
| IP | 192.168.68.74, reservado no roteador para o MAC `BC:24:11:52:B7:20` |
| Branch publicada | `next-migration` |

## Regra principal: o servidor só atualiza quando o usuário pede

Não existe atualização automática (o timer `nexo-update.timer` fica desligado
por escolha do usuário). O fluxo é:

1. Fazer os ajustes, commitar e dar push na `next-migration`.
2. Esperar o usuário pedir **"atualiza o servidor"**.
3. Confirmar que não há nada pendente (`git status` limpo e push feito) e pedir
   para o usuário rodar no Shell do Proxmox:

   ```bash
   pct exec 104 -- /usr/local/bin/nexo-update
   ```

   O caminho completo é obrigatório: o `pct exec` não procura em `/usr/local/bin`.
   Leva de 2 a 3 minutos e termina com `==> No ar: <commit>`. Se não imprimir
   nada, o servidor já estava na versão mais recente.

Nunca publicar sem o pedido do usuário.

## Como funciona

- O código fica clonado em `/opt/nexo/src` (usuário `nexo`).
- Cada versão é montada em `/opt/nexo/releases/<sha>`: rsync de `apps/web`,
  `npm ci` e `npm run build`. Só se o build passar o link `/opt/nexo/current`
  passa a apontar para ela e o serviço reinicia. Se o build falhar, o site
  continua na versão anterior. São guardadas as 3 últimas versões.
- O `.env` (DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL) fica em
  `/opt/nexo/shared/.env` e é ligado a cada versão por symlink. **Ele não está
  no Git e nunca deve ser commitado.** O `BETTER_AUTH_URL` precisa ser
  `http://192.168.68.74:3000`; se o IP mudar, o login para de funcionar.
- Serviços do systemd: `nexo.service` (o site, `next start` na porta 3000) e
  `nexo-update.service` (roda o `update.sh`). O `update.sh` também sincroniza as
  units e a si mesmo com o repositório a cada atualização.

## Arquivos desta pasta

| Arquivo | Para quê |
|---|---|
| `setup.sh` | Instalação ou reinstalação completa no container (Node 24, usuário, clone, serviços, primeiro build). `AUTO_UPDATE=1` religa o timer. |
| `update.sh` | Atualização sob demanda, instalada como `/usr/local/bin/nexo-update`. `FORCE=1` reconstrói mesmo sem commit novo. |
| `nexo.service` | O site. |
| `nexo-update.service` | Execução única do atualizador. |
| `nexo-update.timer` | Checagem a cada 2 minutos. **Desligada**, só existe para quem quiser religar. |

## Comandos úteis (Shell do Proxmox)

```bash
pct exec 104 -- readlink /opt/nexo/current              # versão no ar
pct exec 104 -- systemctl status nexo --no-pager        # o site está rodando?
pct exec 104 -- journalctl -u nexo -n 50 --no-pager     # log do site
pct exec 104 -- journalctl -u nexo-update -n 50 --no-pager  # log das atualizações
pct exec 104 -- env FORCE=1 /usr/local/bin/nexo-update  # reconstruir a versão atual
```

## Reinstalar do zero

Com o `.env` já em `/opt/nexo/shared/.env` dentro do container:

```bash
pct exec 104 -- bash -c "curl -fsSL https://raw.githubusercontent.com/glaucohd/nexo/<commit>/apps/web/deploy/setup.sh | bash"
```

Use o hash de um commit no lugar de `<commit>`: com o nome da branch, o GitHub
pode entregar uma cópia antiga do script (cache de alguns minutos).

## Problemas já vistos

- `Failed to exec "nexo-update"`: faltou o caminho completo `/usr/local/bin/nexo-update`.
- `detected dubious ownership in repository`: git rodando como root em
  `/opt/nexo/src`. Rodar como o usuário `nexo` (`runuser -u nexo -- git …`).
- O modelo do container precisa ser `amd64` (o servidor é x86_64), não `arm64`.
