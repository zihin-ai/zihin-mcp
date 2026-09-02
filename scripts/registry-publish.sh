#!/usr/bin/env bash
# Publica o ai.zihin/mcp-server no MCP Registry oficial.
# Uso: scripts/registry-publish.sh          (checa tudo, faz login DNS e publica)
# Doc: docs/registry-mcp-oficial.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
KEY="${ZIHIN_REGISTRY_KEY:-$ROOT/.secrets/registry-mcp-key.pem}"
DOMAIN="zihin.ai"

fail() { echo "ERRO: $*" >&2; exit 1; }

# 1. ferramentas
command -v mcp-publisher >/dev/null || fail "mcp-publisher nao instalado. Rode: brew install mcp-publisher"
command -v openssl >/dev/null || fail "openssl nao encontrado"

# 2. chave — se nao existe, gera e imprime o TXT para cadastrar no DNS
if [ ! -f "$KEY" ]; then
  echo "Chave $KEY nao existe — gerando..."
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
read -r V_PKG V_SRV V_SRV_PKG MCP_NAME <<<"$(node -e '
  const p = require("./package.json"), s = require("./server.json");
  console.log(p.version, s.version, s.packages[0].version, p.mcpName);
')"
[ "$V_PKG" = "$V_SRV" ] && [ "$V_PKG" = "$V_SRV_PKG" ] \
  || fail "versoes divergem: package.json=$V_PKG server.json=$V_SRV packages[0]=$V_SRV_PKG"
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

# 6. verificacao
echo
echo "Verificando no registry..."
curl -fsS "https://registry.modelcontextprotocol.io/v0.1/servers?search=${MCP_NAME}" \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
      const s=(JSON.parse(d).servers||[]);
      if(!s.length){console.error("nao encontrado no registry ainda");process.exit(1)}
      for(const x of s){const y=x.server||x;console.log("OK:", y.name, y.version||"")}
    })'
