# Changelog

## 1.2.0 (2026-03-21)

### Correções

- Auto-reconnect com backoff exponencial (1s → 30s) após queda de conexão por idle, deploy ou instabilidade de rede
- Keepalive via `ping()` a cada 30s para detectar conexão morta proativamente
- Retry transparente em `callTool`, `readResource` e `getPrompt` em erros de conexão
- Error handlers (`onerror`/`onclose`) no transport HTTP disparam reconnect automático

### Compatibilidade

- Compatível com MCP Server v2.2.0 (75 tools, 3 resources, 3 prompts)
- 3 novas tools: `list_agent_memory`, `delete_agent_memory`, `get_scheduler_status`
- Sem breaking changes — atualização transparente

---

## 1.1.0 (2026-03-13)

### Funcionalidades

- Discovery dinâmico: proxy escuta notificações `tools/list_changed`, `resources/list_changed`, `prompts/list_changed` do server remoto e atualiza listas automaticamente (sem restart)

### Compatibilidade

- Compatível com MCP Server v2.1.0 (72 tools, 3 resources, 3 prompts)
- Sem breaking changes — atualização transparente

---

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
