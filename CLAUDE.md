# CLAUDE.md — @zihin/mcp-server

## O que e este projeto

Pacote npm `@zihin/mcp-server` — proxy stdio-to-HTTP que conecta clientes MCP (Claude Desktop, Cursor, Claude Code, Codex, Windsurf) ao Zihin MCP Server em producao.

## Arquitetura

```
Cliente MCP <-stdio-> [Proxy local (src/index.js)] <-HTTP-> https://llm.zihin.ai/mcp
```

- `src/index.js` — proxy principal (~560 linhas), exporta `startProxy()` e os classificadores de erro (`isAuthError`/`isConnectionError`/`isProtocolVersionError`)
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

## Testes

47 testes — unitarios offline + integracao real contra producao (nada mockado):
- Unit (sem rede): classificadores de erro (formas SDK v1 e v2, regressoes nomeadas), conversores do install-skills, path traversal
- Validacao de API Key (sem key, prefixo invalido, key invalida — exige a mensagem de classificacao de auth)
- Tools: list, call, chat_with_agent (sessao + continuidade), tool inexistente
- Resources: list (pisos + invariante de categoria, nao contagem exata), read
- Prompts: list (presenca dos conhecidos), get com argumentos
- Protocolo MCP: identidade espelhada do upstream (serverInfo.name/title), instructions repassado, capabilities

ATENCAO: a suite de integracao executa um turno REAL de chat_with_agent (custo de LLM no tenant). Sem ZIHIN_API_KEY os testes de integracao pulam (skip local); com REQUIRE_INTEGRATION=1, key ausente = falha (gate de publish).

## CI/CD

GitHub Secrets:
- `ZIHIN_API_KEY` — key para o gate de integracao (SO no publish.yml; o ci.yml de push/PR roda offline)
- `NPM_TOKEN` — legado; tokens bypass-2FA nao publicam desde 28/07/2026

Publicacao (fluxo canary, decidido em 02/08/2026):
1. `npm publish --tag next` MANUAL (passkey; npm abre o navegador — nao pedir --otp)
2. Validacao do canary (diff de contrato proxy x servidor + client real)
3. `npm dist-tag add @zihin/mcp-server@X.Y.Z latest` + push da tag `vX.Y.Z` (o publish.yml detecta versao ja publicada e vira no-op verde)

## Nao commitar

- `.secrets/` — credenciais CI/CD
- `.env` — variaveis locais
