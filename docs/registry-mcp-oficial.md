# Publicacao no MCP Registry oficial

Como publicar o `ai.zihin/mcp-server` no [MCP Registry](https://registry.modelcontextprotocol.io)
(`server.json` na raiz deste repo). Um publish cobre tres canais de uma vez: o registry oficial, o
**GitHub MCP Registry** (github.com/mcp, consumido pelo Copilot) e a **galeria MCP do VS Code** —
ambos sincronizam do registry automaticamente, sem submissao separada.

> O registry esta em "preview": breaking changes ou reset de dados podem ocorrer antes do GA.
> Schema em uso: `2025-12-11`.

## O que o registro declara

O `server.json` publica os dois artefatos num registro so — o cliente escolhe o modo de instalacao:

- **`remotes`**: o endpoint `https://llm.zihin.ai/mcp` (streamable-http), auth por header `X-Api-Key`.
- **`packages`**: o `@zihin/mcp-server` no npm (proxy stdio), auth por env `ZIHIN_API_KEY`.

O registry valida que o pacote npm referencia o nome MCP — por isso o `package.json` tem
`"mcpName": "ai.zihin/mcp-server"` (precisa estar na versao PUBLICADA no npm, nao so no git).

## Atalho: o script

`scripts/registry-publish.sh` faz o fluxo inteiro com as checagens de pre-requisito: gera a chave
e imprime o TXT se a chave (`.secrets/registry-mcp-key.pem`) nao existir; senao valida TXT no ar (e batendo com a chave local),
versoes coerentes (package.json == server.json == npm) e `mcpName` publicado, e so entao roda
`mcp-publisher login dns` + `publish` + verificacao. Os passos manuais equivalentes:

## Passo a passo (primeira publicacao)

### 1. Publicar a 2.2.1 no npm

A 2.2.0 nao tem `mcpName`; o `mcp-publisher publish` contra ela falha com
"Registry validation failed for package". Publicacao manual com passkey (OIDC segue quebrado):

```bash
npm publish --access public
```

### 2. Instalar o mcp-publisher

```bash
brew install mcp-publisher
```

### 3. Gerar a chave e o TXT record (uma vez)

O namespace `ai.zihin` e provado por posse do dominio `zihin.ai` via DNS:

```bash
openssl genpkey -algorithm Ed25519 -out .secrets/registry-mcp-key.pem
PUBLIC_KEY="$(openssl pkey -in .secrets/registry-mcp-key.pem -pubout -outform DER | tail -c 32 | base64)"
echo "zihin.ai. IN TXT \"v=MCPv1; k=ed25519; p=${PUBLIC_KEY}\""
```

Criar o TXT record impresso acima no provedor de DNS de `zihin.ai` (propagacao leva minutos).

**Seguranca:** a chave vive em `.secrets/registry-mcp-key.pem` (fora do git; ver `.secrets/nota.md`) — guardar copia no cofre da equipe.
Quem tiver a chave privada + o TXT no ar publica em nome de `ai.zihin/*`.

### 4. Login e publish

Na raiz do repo (onde esta o `server.json`):

```bash
PRIVATE_KEY="$(openssl pkey -in .secrets/registry-mcp-key.pem -noout -text | grep -A3 "priv:" | tail -n +2 | tr -d ' :\n')"
mcp-publisher login dns --domain zihin.ai --private-key "${PRIVATE_KEY}"
mcp-publisher publish
```

### 5. Verificar

```bash
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=ai.zihin/mcp-server"
```

Depois (dias, nao horas): conferir a vitrine do GitHub (github.com/mcp) e a galeria do VS Code
(painel Extensions, busca `@mcp`). A vitrine curada do GitHub e editorial — se nao aparecer,
da para nomear o server a partnerships@github.com.

## Manutencao por release

A cada release do pacote: atualizar a versao no `server.json` (campo `version` do topo E de
`packages[0]`), publicar no npm primeiro, e rodar `mcp-publisher login dns` + `publish` de novo.
Candidato a automacao no `publish.yml` via GitHub Actions (ha guia oficial:
modelcontextprotocol.io/registry/github-actions) — exige a chave privada como secret do repo.

## Alternativas de auth (se o DNS nao rolar)

- **HTTP**: mesmo par de chaves, arquivo `v=MCPv1; k=ed25519; p=...` servido em
  `https://zihin.ai/.well-known/mcp-registry-auth`, e `mcp-publisher login http --domain zihin.ai ...`.
- **GitHub org**: `mcp-publisher login github` — mas o nome vira `io.github.zihin-ai/mcp-server`
  (e o `mcpName` teria que mudar junto). Evitar: o namespace de dominio e melhor para a marca.

## Referencias

- https://modelcontextprotocol.io/registry/quickstart
- https://modelcontextprotocol.io/registry/remote-servers
- https://modelcontextprotocol.io/registry/authentication
- https://modelcontextprotocol.io/registry/github-actions
