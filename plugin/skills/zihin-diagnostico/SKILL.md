---
name: zihin-diagnostico
description: Árvore de decisão para diagnosticar agentes Zihin — respostas erradas, tools falhando, custo/latência alto, agente parado, multi-agente quebrado. Use quando o usuário relatar qualquer problema de comportamento, erro ou custo em um agente em produção.
---

# Diagnóstico de agentes

Comece SEMPRE pelo sintoma, não pela ferramenta. Ordem de investigação:

## 1. Visão geral do agente

`get_agent_metrics` (period `1d`/`7d`/`30d`) — calls, errors, success_rate, tokens, custo, latência p50/p95 (agregado em SQL, sem cap de linhas), uso de tools e sessões recentes. Se `tools.sample_truncated: true`, os agregados de tools refletem a amostra das últimas 2000 chamadas, não o período inteiro.

Interpretação rápida:
- errors altos + success_rate baixo → veja o passo 2 (tools) e 5 (infra).
- custo alto → cheque modelo em uso (`get_agent`), fallback_chain e volume de sessões; considere teto (`zihin://skills/governanca-e-operacao`).
- p95 alto → tools lentas (passo 2) ou modelo pesado.

## 2. Tools resolvendo?

`list_agent_tools` — cada tool aparece com status `resolved` ou `error`.

**Assinatura clássica**: usuário final recebe "Tool not found", mas a telemetria mostra a execução como sucesso → o MCP server externo está inativo/erro e as tools sumiram do runtime. Correção: `test_mcp_server` (ping + auth) → corrigir endpoint/credencial se preciso → `invalidate_mcp_cache` (cache tem TTL 5 min; invalidar força reload).

Para api_config/db_config com erro: `validate_agent_schemas` aponta o schema quebrado; lembre da regra `endpoint.name == tool_definition.name`.

## 3. Execução específica

`get_execution_diagnostics` — trace da execução: modelo usado, iterações, tool calls com input/output, erros por passo.

## 4. Multi-agente (orchestrator)

- Com `root_execution_id`: `get_execution_trace` — árvore supervisor→subagentes com custo por nó.
- ⚠️ Em sessão MULTI-TURNO o trace por execução pode não fechar a árvore — use `get_session_agent_tree` (linhagem por sessão-pai, cobre todos os turnos).
- Galho falhou mas supervisor reportou sucesso? Confira na árvore os subagentes com erro (ex.: `invoke_agent` chamado com nome de tool em vez de UUID de agente → "Invalid uuid").

## 5. Erro é do agente ou da infra?

`get_tenant_health` — erros SEM agent_id (rate limit do provider, auth de chave LLM, infra), agrupados por código canônico. Se os erros do tenant sobem mas `get_agent_metrics` mostra errors=0, o problema é infra/provider — não mexa no agente.

## 6. Agente parado / não inicia turno

- **Budget**: `get_agent_budget` — se `remaining_usd <= 0`, o turno nem inicia (hard-stop). Recuperação: `set_agent_budget` com teto maior (efeito no próximo turno).
- **Quota do plano**: erro `QUOTA_EXCEEDED` — franquia mensal de tokens esgotada (distinto de budget; BYOK não consome quota).
- **Sessão bloqueada**: `list_agent_sessions` com filtro `control_mode` — sessão `suspended`/`manual_handoff` faz bypass do agente para novas mensagens.
- **Consumer bloqueado**: `get_consumer_profile` — flag `do_not_contact` (denylist) faz bypass cross-agent silencioso.

## 7. Voltar atrás

Piorou depois de uma mudança? `list_agent_history` (timeline) → `compare_versions` (diff) → `rollback_version` (recurso específico) ou `rollback_snapshot` (agente inteiro pro estado de uma publicação).

## Reproduzir com segurança

`chat_with_agent` reproduz o comportamento real (consome tokens — avise o usuário). Para triggers, `test_trigger` com payload de exemplo (também executa de verdade, em sessão temporária).
