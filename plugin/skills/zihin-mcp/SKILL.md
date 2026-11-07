---
name: zihin-mcp
description: Skill roteadora do MCP Zihin. Use ao iniciar qualquer trabalho com o MCP da Zihin (gerir agentes de IA, tools, triggers, governança) para entender o mapa de categorias, RBAC, o workflow contract-first e qual skill específica ler em seguida.
---

# Zihin MCP — mapa geral

O MCP Server da Zihin gerencia **agentes de IA multi-tenant**: o tenant vem da API Key ou, no login de pessoa (OAuth), da URL `/mcp/t/{empresa}` (confirme com `whoami` — retorna tenant, role, plano e `auth_kind`). Toda operação é automaticamente escopada a essa empresa.

## Mapa de categorias (106 tools)

| Categoria | O que faz | Roles |
|---|---|---|
| consumer (5) | `whoami`, descobrir agentes publicados, conversar (`chat_with_agent`), histórico de sessões | todos |
| consumer-profile (3) | leitura agregada de consumidores finais e suas sessões | owner/admin/editor |
| consumer-ops (10) | denylist do tenant, controle de sessão (suspender/handoff), controle de engajamento por consumidor, mensagem manual, cancelar turno, limpar/arquivar/desarquivar conversa (`clear_session`, `archive_session`, `unarchive_session`), cancelar instância de processo e resolver incidente como operador | owner/admin |
| builder-read (49) | `list_*`/`get_*`/`validate_*`/`compare_*` + budget/approvals reads + observabilidade (incl. `list_executions`, busca por trace_id/sessão/status/período) + definições, instâncias, estado do motor de processos e desfecho de comando (`get_process_command`, só admin/owner) | owner/admin/editor |
| builder-write (39) | `create_*`/`update_*`/`delete_*`/`toggle_*`/`publish_*`/`rollback_*`/`test_*` + `set_agent_budget` + publicar/aposentar/liberar definição de processo | owner/admin |

A lista de tools que você vê JÁ reflete seu role — se uma tool de escrita não aparece, sua key é editor/member.

**Login de pessoa (OAuth, `auth_kind: person`)**: você age com o papel da pessoa na empresa, MENOS as tools que criam credencial ou acesso que continuaria valendo depois de revogar a conexão — API Keys, secrets, triggers, servidores MCP, CSPs e políticas de aprovação (criar/alterar), restaurar versão ou snapshot, clonar agente, publicar definição e ligar processo. Elas não aparecem de propósito, mesmo para owner/admin. Quando um playbook mandar usar uma delas, diga à pessoa que essa etapa é feita no console da Zihin; não procure outro caminho para o mesmo efeito.

**Processos** (playbook completo: `zihin://skills/processos`; contrato: `zihin://schemas/process_definition`) têm duas entidades: a DEFINIÇÃO (o modelo, publicado antes) e a INSTÂNCIA (aberta pelo agente na conversa com `open_process`). Para ver o que existe: `list_process_definitions`, `get_process_definition`, `get_process_engine_status`; antes de publicar, `validate_process_definition` (confere estrutura e se agentes/políticas/servidores citados são desta empresa); depois `publish_process_definition` (próxima versão; a receita do worker fica na definição e o agente só escolhe) ou `retire_process_definition` (aposenta todas as versões da key). Instâncias (as execuções) da empresa: `list_process_instances`, `get_process_instance`, `get_process_trail`; `cancel_process_instance` e `resolve_process_incident` (retry/abandon/substitute_output — nunca aprovação) intervêm em nome da empresa (fica na trilha). Publicada não é liberada: `enable_process` (uma key ou `*`) deixa os agentes abrirem, `disable_process` retira. Publicar e liberar exigem key criada por admin/owner ainda ativo (no login de pessoa, publicar e ligar são feitos no console).

## Workflow contract-first (evita tentativa e erro)

Para QUALQUER payload estruturado (`schema_data`, `trigger_config`, `rules` de CSP, `stages` de política):

1. **Leia o contrato formal**: resource `zihin://schemas/{tipo}` — é o MESMO JSON Schema que o servidor valida (Ajv). O campo `mcp_usage` explica a granularidade: tipos "schema_data" validam o argumento direto; tipos "entidade" (`trigger_config`, `csp_config`, `approval_policy`) validam o registro completo montado pelo servidor — você envia só os campos do input da tool (`tenant_id`/`id` são injetados server-side).
2. **Monte o payload.**
3. **Valide sem gravar**: `validate_schema_data` (mesma validação do create — dry-run gratuito).
4. **Crie.**

## Qual skill ler em seguida

- Criar/publicar um agente do zero → `zihin://skills/criar-agente`
- Dar capacidades ao agente (API, MCP externo) → `zihin://skills/tools-de-agente`
- Conectar canais/automação (webhook, cron, e-mail) → `zihin://skills/triggers-e-canais`
- Investigar agente com problema/custo/latência → `zihin://skills/diagnostico`
- Teto de gasto, políticas, aprovação HITL, atendimento humano → `zihin://skills/governanca-e-operacao`
- Processos (definições, liberação, instâncias, intervenção) → `zihin://skills/processos`

## Convenções

- IDs são UUIDs — descubra via tools `list_*` antes de operar; nunca invente IDs.
- Respostas são JSON (e vêm também em `structuredContent`); `{ success: false, error: { code, message } }` = falha de negócio. Ramifique pelo `code` (`NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT`, `INSUFFICIENT_PERMISSIONS`, `PLAN_LIMIT_REACHED`, `ERROR` = genérico) e leia a correção no `message`; detalhes estruturados, quando existem, vêm ao lado (`details`, `errors`, `validation`).
- **`warnings` no sucesso não é decoração.** Uma resposta pode vir `success: true` **com** `warnings` — é a plataforma dizendo "gravei, mas isto vai te morder depois" (ex.: modelo acima do tier passa no save e barra no `publish_agent`). Trate o aviso no momento em que ele aparece.
- `chat_with_agent` e `test_trigger` executam o agente DE VERDADE (consomem tokens do tenant e podem disparar efeitos externos).
- Erros comuns de plano: `PLAN_LIMIT_REACHED` (máx. de agentes), `MODEL_TIER_RESTRICTED` (modelo acima do tier — aparece no `publish_agent`, não no save, que só avisa), `QUOTA_EXCEEDED` (franquia de tokens).
- Resources úteis: `zihin://agents` (catálogo), `zihin://models` (modelos LLM válidos), `zihin://schema-templates` (exemplos), `zihin://schemas/{tipo}` (contratos formais).
