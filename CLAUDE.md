# CLAUDE.md — @zihin/mcp-server

## O que e este projeto

Pacote npm `@zihin/mcp-server` — proxy stdio-to-HTTP que conecta clientes MCP (Claude Desktop, Cursor, Claude Code, Codex, Windsurf) ao Zihin MCP Server em producao.

## Arquitetura

```
Cliente MCP <-stdio-> [Proxy local (src/index.js)] <-HTTP-> https://llm.zihin.ai/mcp
```

- `src/index.js` — proxy principal (~670 linhas), exporta `startProxy()`, os classificadores de erro (`isAuthError`/`isConnectionError`/`isProtocolVersionError`/`isInputRequiredError`/`isTimeoutError`) e `resolveCallTimeoutMs()`
- `src/install-skills.js` — subcomando `install-skills` (skills no formato nativo de cada client)
- `bin/zihin-mcp.js` — CLI entry point
- Usa MCP SDK v2: `Client` + `StreamableHTTPClientTransport` (`@modelcontextprotocol/client`) e `Server` low-level + `StdioServerTransport` (`@modelcontextprotocol/server`)
- Auth via header `X-Api-Key`, RBAC enforced server-side

## Comandos

```bash
# Rodar testes (requer API Key valida)
ZIHIN_API_KEY=zhn_live_xxx npm test

# Rodar o proxy localmente
ZIHIN_API_KEY=zhn_live_xxx node bin/zihin-mcp.js

# Ressincronizar as skills empacotadas com o BE (passo de release)
npm run sync-skills                              # do checkout irmao ../zihin-agent-builder
ZIHIN_API_KEY=zhn_live_xxx npm run sync-skills -- --from-server
```

## Convencoes

- Idioma: portugues brasileiro para docs, commits e comentarios
- Formato de commit: `feat(scope): descricao` com `Co-Authored-By: Claude <modelo> <noreply@anthropic.com>`
- Sem emojis
- JS puro, ESM (`type: module`), Node.js >= 20 (exigido pelo SDK v2)
- Zero devDependencies — testes usam `node:test` nativo
- Dependencias: `@modelcontextprotocol/client` + `@modelcontextprotocol/server` (SDK v2, pacotes divididos)

## Estrutura

```
zihin-mcp/
├── package.json
├── bin/zihin-mcp.js       <- CLI entry point
├── src/index.js           <- Proxy stdio-to-HTTP
├── src/install-skills.js  <- Subcomando install-skills
├── scripts/sync-skills.mjs <- Ressincroniza plugin/skills/ com o BE (release)
├── test/proxy.test.js     <- Integracao real contra producao (requer key)
├── test/error-classification.test.js  <- Unit, sem rede
├── test/install-skills.test.js        <- Unit + e2e local, sem rede
├── plugin/                <- Plugin Claude Code (skills empacotadas)
├── .github/workflows/
│   ├── ci.yml             <- Testes OFFLINE em push/PR (sem key — nao queima turno de agente)
│   └── publish.yml        <- Gate de integracao real (REQUIRE_INTEGRATION=1) em tag v*; publish e no-op se a versao ja esta no npm
├── README.md
├── CHANGELOG.md
├── LICENSE (MIT)
├── .gitignore
└── .npmignore
```

## Variaveis de ambiente

- `ZIHIN_API_KEY` (obrigatoria) — API Key do tenant (prefixos: `zhn_live_`, `zhn_test_`, `zhn_dev_`)
- `ZIHIN_MCP_URL` (opcional) — URL do server (default: `https://llm.zihin.ai/mcp`)
- `ZIHIN_MCP_CALL_TIMEOUT_MS` (opcional) — teto de um `tools/call` em ms (default: 300000, faixa 1000–1800000). Precisa ficar acima do maior deadline do server (async 240s) para o `TURN_TIMEOUT` chegar ao host

## Testes

62 testes — unitarios offline + integracao real contra producao (nada mockado):
- Unit (sem rede): classificadores de erro (formas SDK v1 e v2, regressoes nomeadas), conversores do install-skills, path traversal
- Validacao de API Key (sem key, prefixo invalido, key invalida — exige a mensagem de classificacao de auth)
- Tools: list, call, chat_with_agent (sessao + continuidade), tool inexistente
- Resources: list (pisos + invariante de categoria, nao contagem exata), read
- Prompts: list (presenca dos conhecidos), get com argumentos
- Protocolo MCP: identidade espelhada do upstream (serverInfo.name/title), instructions repassado, capabilities
- Timeout: classificacao (`isTimeoutError`), parse de `ZIHIN_MCP_CALL_TIMEOUT_MS`, teto anunciado no banner acima do deadline do server
- Contrato de `chat_with_agent`: `execution_id` no sucesso, forma de `cancelled`/`tools_used`/`tool_calls`, description sem truncar

ATENCAO: a suite de integracao executa um turno REAL de chat_with_agent (custo de LLM no tenant). Sem ZIHIN_API_KEY os testes de integracao pulam (skip local); com REQUIRE_INTEGRATION=1, key ausente = falha (gate de publish).

## CI/CD

GitHub Secrets:
- `ZIHIN_API_KEY` — key para o gate de integracao (SO no publish.yml; o ci.yml de push/PR roda offline)
- `NPM_TOKEN` — legado; tokens bypass-2FA nao publicam desde 28/07/2026

Publicacao (fluxo canary, decidido em 02/08/2026):
1. `npm publish --tag next` MANUAL (passkey; npm abre o navegador — nao pedir --otp)
2. Validacao do canary (diff de contrato proxy x servidor + client real)
3. `npm dist-tag add @zihin/mcp-server@X.Y.Z latest` + push da tag `vX.Y.Z` (o publish.yml detecta versao ja publicada e vira no-op verde)

## Skills empacotadas

`plugin/skills/` e copia congelada de `server-llm/mcp-server/skills/` (repo `zihin-agent-builder`, branch `server-llm`). Mudanca de skill no BE so chega a quem instalou o pacote com uma nova publicacao no npm — rodar `npm run sync-skills` e conferir o diff faz parte do release.

Nome de skill vira componente de caminho nos writers (`path.join(base, name)`): tanto o `install-skills.js` quanto o `sync-skills.mjs` passam pelo choke point `parseSkill()` (`/^[\w-]+$/`, parse ancorado no frontmatter). Nao reimplementar esse parse em lugar nenhum — conteudo vindo do server e nao confiavel.

## Nao commitar

- `.secrets/` — credenciais CI/CD
- `.env` — variaveis locais

## MCP Registry oficial

`server.json` na raiz e o registro `ai.zihin/mcp-server` no registry.modelcontextprotocol.io
(remoto `llm.zihin.ai/mcp` + pacote npm no mesmo nome; `mcpName` no package.json e obrigatorio
na versao publicada). A cada release: bump da versao no `server.json` (topo E `packages[0]`),
npm publish primeiro, depois `scripts/registry-publish.sh` (checa TXT/versoes e publica). Passo a passo: `docs/registry-mcp-oficial.md`.
