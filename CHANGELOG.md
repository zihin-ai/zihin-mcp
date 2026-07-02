# Changelog

## 1.4.0 (2026-07-01)

### Funcionalidades

- **`install-skills`**: novo subcomando que instala as 6 skills do MCP Zihin no formato nativo do client — `--client claude|cursor|windsurf|codex|all`, `--dir`, `--global` (claude), `--bundled` (offline). Fonte primaria: o server vivo (resources `zihin://skills/*`); fallback: bundle empacotado no npm (`plugin/skills/`, sincronizado via `npm run sync-skills`).
- **Plugin Claude Code**: marketplace neste repo (`claude plugin marketplace add zihin-ai/zihin-mcp` + `claude plugin install zihin@zihin`) — instala MCP server + skills em um comando.
- Proxy compativel com server v2.4.0+ (96 tools com ToolAnnotations, 19 resources incl. contratos `zihin://schemas/*` e skills, instructions role-aware) — pass-through, sem mudanca de codigo no proxy.

### Testes

- `test/install-skills.test.js` (10 testes, sem rede): conversores puros por client + e2e local com `--bundled` em diretorio temporario (incl. idempotencia do bloco AGENTS.md).

## 1.3.0 (2026-03-28)

### Funcionalidades

- **Identificação de tenant no boot**: chama `whoami` após conexão e exibe `✓ Tenant: "Nome" (role: admin, plan: basic)` no stderr — elimina ambiguidade ao operar com múltiplas tenants
- **Smart keepalive**: substituído `ping()` por `listTools()` a cada 30s — detecta tools novas/removidas e valida auth continuamente
- **Detecção de auth error**: erros 401/403 agora são tratados como fatais (`exit(1)`) com mensagem clara, ao invés de reconectar infinitamente com key revogada
- **Limite de reconexão**: máximo de 10 tentativas antes de encerrar (`MAX_RECONNECT_ATTEMPTS`)
- `withRetry` não retenta operações em erros de autenticação

### Compatibilidade

- Compatível com MCP Server v2.3.0 (76 tools, 3 resources, 3 prompts)
- +1 tool: `whoami` (consumer, todos os roles) — identificação de tenant/role/plano
- Sem breaking changes — atualização transparente
- Graceful degradation: se o server não tem `whoami` (< v2.3.0), o proxy funciona normalmente sem identificação

---

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
