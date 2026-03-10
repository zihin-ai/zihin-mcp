# Changelog

## 1.0.0 (2026-03-09)

Lancamento inicial do `@zihin/mcp-server`.

### Funcionalidades

- Proxy transparente stdio-to-HTTP para clientes MCP
- Descoberta automatica de tools, resources e prompts do server remoto
- Suporte a Claude Desktop, Cursor, Claude Code, Codex e Windsurf
- Validacao de API Key com mensagens de erro claras
- Auth via header `X-Api-Key` com RBAC enforced server-side

### Capabilities (role admin)

- 69 tools (incluindo `chat_with_agent` com session tracking)
- 3 resources (`zihin://agents`, `zihin://models`, `zihin://schema-templates`)
- 3 prompts (`setup-agent`, `add-tool`, `configure-webhook`)

### Testes

- 19 testes de integracao real contra producao
- Cobertura: validacao, tools, resources, prompts, protocolo MCP

### CI/CD

- GitHub Actions: CI em push/PR, publish automatico em tag `v*`
