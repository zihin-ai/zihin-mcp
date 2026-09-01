---
name: zihin-mcp
description: Skill roteadora do MCP Zihin. Use ao iniciar qualquer trabalho com o MCP da Zihin (gerir agentes de IA, tools, triggers, governança) para entender o mapa de categorias, RBAC, o workflow contract-first e qual skill específica ler em seguida.
---

# Zihin MCP — mapa geral

O MCP Server da Zihin gerencia **agentes de IA multi-tenant**: o tenant vem da API Key (confirme com `whoami` — retorna tenant, role e plano). Toda operação é automaticamente escopada ao tenant da key.

## Mapa de categorias (96 tools)

| Categoria | O que faz | Roles |
|---|---|---|
| consumer (5) | `whoami`, descobrir agentes publicados, conversar (`chat_with_agent`), histórico de sessões | todos |
| consumer-profile (3) | leitura agregada de consumidores finais e suas sessões | owner/admin/editor |
| consumer-ops (4) | denylist, suspender sessão, mensagem manual, cancelar turno | owner/admin |
| builder-read (44) | `list_*`/`get_*`/`validate_*`/`compare_*` + budget/approvals reads + observabilidade | owner/admin/editor |
| builder-write (40) | `create_*`/`update_*`/`delete_*`/`toggle_*`/`publish_*`/`rollback_*`/`test_*` + `set_agent_budget` | owner/admin |

A lista de tools que você vê JÁ reflete seu role — se uma tool de escrita não aparece, sua key é editor/member.

## Workflow contract-first (evita tentativa e erro)

Para QUALQUER payload estruturado (`schema_data`, `trigger_config`, `rules` de CSP, `stages` de política):

1. **Leia o contrato formal**: resource `zihin://schemas/{tipo}` — é o MESMO JSON Schema que o servidor valida (Ajv). O campo `mcp_usage` explica a granularidade: tipos "schema_data" validam o argumento direto; tipos "entidade" (`trigger_config`, `csp_config`, `approval_policy`) validam o registro completo montado pelo servidor — você envia só os campos do input da tool (`tenant_id`/`id` são injetados server-side).
2. **Monte o payload.**
3. **Valide sem gravar**: `validate_schema_data` (mesma validação do create — dry-run gratuito).
4. **Crie.**

## Qual skill ler em seguida

- Criar/publicar um agente do zero → `zihin://skills/criar-agente`
- Dar capacidades ao agente (API, SQL, MCP externo) → `zihin://skills/tools-de-agente`
- Conectar canais/automação (webhook, cron, e-mail) → `zihin://skills/triggers-e-canais`
- Investigar agente com problema/custo/latência → `zihin://skills/diagnostico`
- Teto de gasto, políticas, aprovação HITL, atendimento humano → `zihin://skills/governanca-e-operacao`

## Convenções

- IDs são UUIDs — descubra via tools `list_*` antes de operar; nunca invente IDs.
- Respostas são JSON; `{ success: false, error }` = falha de negócio (leia o `error`, ele orienta a correção).
- **`warnings` no sucesso não é decoração.** Uma resposta pode vir `success: true` **com** `warnings` — é a plataforma dizendo "gravei, mas isto vai te morder depois" (ex.: modelo acima do tier passa no save e barra no `publish_agent`). Trate o aviso no momento em que ele aparece.
- `chat_with_agent` e `test_trigger` executam o agente DE VERDADE (consomem tokens do tenant e podem disparar efeitos externos).
- Erros comuns de plano: `PLAN_LIMIT_REACHED` (máx. de agentes), `MODEL_TIER_RESTRICTED` (modelo acima do tier — aparece no `publish_agent`, não no save, que só avisa), `QUOTA_EXCEEDED` (franquia de tokens).
- Resources úteis: `zihin://agents` (catálogo), `zihin://models` (modelos LLM válidos), `zihin://schema-templates` (exemplos), `zihin://schemas/{tipo}` (contratos formais).
