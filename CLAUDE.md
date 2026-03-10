# CLAUDE.md — @zihin/mcp-server

## O que e este projeto

Pacote npm `@zihin/mcp-server` — proxy stdio-to-HTTP que conecta clientes MCP (Claude Desktop, Cursor, Claude Code, Codex, Windsurf) ao Zihin MCP Server em producao.

## Arquitetura

```
Cliente MCP <-stdio-> [Proxy local (src/index.js)] <-HTTP-> https://llm.zihin.ai/mcp
```

- `src/index.js` — proxy principal (~140 LOC), exporta `startProxy()`
- `bin/zihin-mcp.js` — CLI entry point
- Usa MCP SDK: `Server` (low-level) + `Client` + `StreamableHTTPClientTransport`
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
- Formato de commit: `feat(scope): descricao` com `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
- Sem emojis
- JS puro, ESM (`type: module`), Node.js >= 18
- Zero devDependencies — testes usam `node:test` nativo
- Unica dependencia: `@modelcontextprotocol/sdk`

## Estrutura

```
zihin-mcp/
├── package.json
├── bin/zihin-mcp.js       <- CLI entry point
├── src/index.js           <- Proxy stdio-to-HTTP
├── test/proxy.test.js     <- 19 testes de integracao
├── .github/workflows/
│   ├── ci.yml             <- Testes em push/PR
│   └── publish.yml        <- Testes + npm publish em tag v*
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

19 testes de integracao real contra producao (nada mockado):
- Validacao de API Key (sem key, prefixo invalido, key invalida)
- Tools: list, call, chat_with_agent (sessao + continuidade), tool inexistente
- Resources: list, read (3 URIs: models, agents, schema-templates)
- Prompts: list, get com argumentos
- Protocolo MCP: serverInfo, capabilities

## CI/CD

GitHub Secrets necessarios:
- `NPM_TOKEN` — token npm para publicar `@zihin/mcp-server`
- `ZIHIN_API_KEY` — key para rodar testes de integracao no CI

## Nao commitar

- `.secrets/` — credenciais CI/CD
- `.env` — variaveis locais
