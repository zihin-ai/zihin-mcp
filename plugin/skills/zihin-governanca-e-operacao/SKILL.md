---
name: zihin-governanca-e-operacao
description: Playbook de governança e operação do Zihin — teto de gasto (budget), políticas de segurança (CSP), aprovação humana HITL, atendimento humano (suspender/handoff/mensagem manual/cancelar) e denylist de consumidores. Use quando o usuário pedir controle de custo, aprovações, compliance ou intervenção humana em conversas.
---

# Governança e operação

## Teto de gasto por agente (budget)

Budget ≠ quota: budget é **teto de custo em USD por agente** e conta TODAS as chamadas LLM, **BYOK incluído**; quota é a franquia de tokens do plano (BYOK não consome).

- `get_agent_budget` — saldo do ciclo + teto efetivo (`unlimited: true` = sem teto). O teto pode ser excedido em até 1 chamada em voo (hard-stop age antes do turno seguinte).
- `list_agent_budgets` — visão consolidada de todos os agentes (1 chamada, sem N+1).
- `set_agent_budget` — define/eleva/remove (`limit_usd: null` = ilimitado). É o **laço de recuperação**: agente parado por budget volta a rodar no próximo turno após elevar o teto.
- Budget é POR AGENTE, não consolida subagentes: orchestrator com teto + subagentes sem teto = fan-out escapa. Para conter custo de árvore, aplique teto em cada agente.

## CSPs — políticas de segurança contextual

`create_csp` / `update_csp` / `toggle_csp` / `get_effective_csps` (merge efetivo por agente). Contrato: `zihin://schemas/csp_config` (entidade — envie só name/policy_type/scope/rules/...).

- Escopos hierárquicos: `tenant` > `team` > `agent` > `user` (herança de cima pra baixo; `scope_target_id` obrigatório fora de tenant).
- Tipos e rules típicos: `schedule` (allowed_hours/days/timezone), `behavior` (max_tokens_per_request, allowed_models, max_iterations), `data` (allowed_tables, blocked_columns, max_rows), `origin` (allowed_ips/origins), `custom`.
- Multi-agente (behavior): `max_agent_depth` (0-5, default 2), `allowed_invoke_agents` (whitelist de UUIDs; vazio = todos), `child_timeout_ms` (5000-300000).

## Aprovação humana — HITL

Duas peças que se conectam:

1. **Política** (quem aprova): `create_approval_policy` com `stages[].approvers` = `{ "type": "user", "id": "<uuid>" }` ou `{ "type": "role", "role": "admin" }`. Contrato: `zihin://schemas/approval_policy`. Gerencie com `list_approval_policies` / `get_approval_policy` / `update_approval_policy` (`is_active: false` desativa).
2. **Gatilho** (o que exige aprovação): na CSP de behavior — `require_approval_for` (array de nomes de tool ou matchers `{ "source": "mcp"|"api"|"db" }`) + `approval_policy_id`. Sem política vinculada, aprova o próprio solicitante.

Vale **só no chat nativo** (chat.zihin.ai): a tool proposta vira card de aprovação na conversa do aprovador; a decisão acontece LÁ, não por esta API. `list_approvals` mostra o kanban de pendências (admin/owner veem todas; editor só as próprias + o que pode aprovar).

## Atendimento humano em sessões (operador assume)

Padrão de handoff, nesta ordem:

1. `set_session_control` com `manual_handoff` (ou `suspended` com `expires_at` para pausa temporária — resume automático no vencimento). Sessão fora de `engaged` = novas mensagens fazem bypass do agente.
2. `send_manual_message` — envia pelo MESMO canal outbound do agente (Twilio/Meta/webhook). Exige `control_mode != engaged`. Gravada com `author=human` — quando o agente retomar, NÃO imita o estilo do operador.
3. Turno em andamento descontrolado (loop, resposta fora do alvo)? `cancel_agent_turn` aborta mid-LLM/mid-tool (em multi-agente, cascateia pros subagentes).
4. Encerrou o atendimento humano: `set_session_control` de volta pra `engaged`.

## Denylist de consumidores

`set_consumer_denylist` — flag `do_not_contact` cross-agent no tenant inteiro: mensagens do consumidor recebem bypass silencioso (sem LLM, sem quota). Investigue antes com `get_consumer_profile` / `list_consumer_sessions`. Reversível (mesma tool).

## API Keys e RBAC

- `create_api_key` com `role` — anti-escalação server-side: ninguém cria key com role acima do próprio. Roles: owner/admin (tudo), editor (leitura + perfis), member (só chat/consumer).
- Integração externa (n8n, webhook) deve receber key com o MENOR role suficiente — para "só conversar", member basta.
