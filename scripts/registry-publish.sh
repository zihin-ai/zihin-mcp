#!/usr/bin/env bash
# Publica o ai.zihin/mcp-server no MCP Registry oficial.
# Uso: scripts/registry-publish.sh          (checa tudo, faz login DNS e publica)
# Doc: docs/registry-mcp-oficial.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# ZIHIN_REGISTRY_KEY relativo vale a partir de onde o script foi chamado, nao
# da raiz do repo — senao o caminho erra em silencio e uma chave nova e gerada.
CALLER_PWD="$PWD"
cd "$ROOT"
KEY="${ZIHIN_REGISTRY_KEY:-$ROOT/.secrets/registry-mcp-key.pem}"
case "$KEY" in /*) ;; *) KEY="$CALLER_PWD/$KEY" ;; esac
DOMAIN="zihin.ai"
# O diretorio da chave (.secrets/ fica fora do git) pode nao existir num clone
# novo ou numa worktree: sem ele, gerar ou restaurar a chave falha na escrita.
KEY_DIR="$(dirname "$KEY")"
[ -d "$KEY_DIR" ] || (umask 077; mkdir -p "$KEY_DIR")

fail() { echo "ERRO: $*" >&2; exit 1; }

# 1. ferramentas
command -v mcp-publisher >/dev/null || fail "mcp-publisher nao instalado. Rode: brew install mcp-publisher"
command -v openssl >/dev/null || fail "openssl nao encontrado"

# 2. chave — se nao existe, tenta restaurar do Keychain do macOS; senao gera nova
if [ ! -f "$KEY" ] && command -v security >/dev/null; then
  if security find-generic-password -s zihin-mcp-registry-ed25519 -w 2>/dev/null | base64 -d > "$KEY" 2>/dev/null      && openssl pkey -in "$KEY" -noout 2>/dev/null; then
    chmod 600 "$KEY"; echo "Chave restaurada do Keychain (zihin-mcp-registry-ed25519)."
  else
    rm -f "$KEY"
  fi
fi
if [ ! -f "$KEY" ]; then
  echo "Chave $KEY nao existe (nem no Keychain) — gerando NOVA (exigira atualizar o TXT no DNS!)..."
  openssl genpkey -algorithm Ed25519 -out "$KEY"
  PUB="$(openssl pkey -in "$KEY" -pubout -outform DER | tail -c 32 | base64)"
  echo
  echo "Cadastre este TXT no DNS de ${DOMAIN} (host @) e rode o script de novo:"
  echo "  v=MCPv1; k=ed25519; p=${PUB}"
  exit 0
fi

# 3. TXT no ar e batendo com a chave local
PUB="$(openssl pkey -in "$KEY" -pubout -outform DER | tail -c 32 | base64)"
TXT="$(dig TXT "$DOMAIN" +short 2>/dev/null | tr -d '"' | grep '^v=MCPv1' || true)"
[ -n "$TXT" ] || fail "TXT v=MCPv1 nao visivel no DNS de ${DOMAIN} (propagacao pendente?)"
echo "$TXT" | grep -qF "p=${PUB}" || fail "TXT no DNS nao bate com a chave local ${KEY}: DNS tem '${TXT}'"

# 4. versoes coerentes: server.json (topo e packages[0]) == package.json == npm publicado
read -r V_PKG V_SRV V_SRV_PKG MCP_NAME V_PLUGIN <<<"$(node -e '
  const p = require("./package.json"), s = require("./server.json"), g = require("./plugin/.claude-plugin/plugin.json");
  console.log(p.version, s.version, s.packages[0].version, p.mcpName, g.version);
')"
[ "$V_PKG" = "$V_SRV" ] && [ "$V_PKG" = "$V_SRV_PKG" ] && [ "$V_PKG" = "$V_PLUGIN" ] \
  || fail "versoes divergem: package.json=$V_PKG server.json=$V_SRV packages[0]=$V_SRV_PKG plugin.json=$V_PLUGIN"
V_NPM="$(npm view @zihin/mcp-server version 2>/dev/null || true)"
[ "$V_NPM" = "$V_PKG" ] || fail "npm tem $V_NPM, esperado $V_PKG — rode npm publish antes"
NPM_MCPNAME="$(npm view @zihin/mcp-server mcpName 2>/dev/null || true)"
[ "$NPM_MCPNAME" = "$MCP_NAME" ] || fail "mcpName no npm ($NPM_MCPNAME) difere do package.json ($MCP_NAME)"

# 5. login + publish
PRIV="$(openssl pkey -in "$KEY" -noout -text | grep -A3 'priv:' | tail -n +2 | tr -d ' :\n')"
echo "Login DNS como ${DOMAIN}..."
mcp-publisher login dns --domain "$DOMAIN" --private-key "$PRIV"
echo "Publicando ${MCP_NAME}@${V_PKG}..."
mcp-publisher publish

# 6. verificacao — nome e versao EXATOS e isLatest=true, com tentativas
# limitadas (a busca por substring aceitava versao anterior ou outro servidor)
echo
echo "Verificando no registry..."
node "$ROOT/scripts/registry-verify.mjs" "$MCP_NAME" "$V_PKG"
