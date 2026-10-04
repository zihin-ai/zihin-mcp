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
- ⚠️ **Campo fora do contrato é aceito em silêncio e fica inerte** — o schema permite propriedades extras, então errar o nome não dá erro, dá uma política que não faz nada. Confira em `zihin://schemas/csp_config`, em `$defs.{tipo}Rules`.
- ⚠️ `update_csp` **substitui** `rules` inteiro, não mescla: reenvie os campos que quer manter.
- Tipos e rules, com os nomes reais:
  - `schedule` — `allowed_hours: {start, end}`, `allowed_days`, `blocked_dates`, `timezone`. **Aplicado**: fora da janela o turno é recusado na admissão, antes de chamar o modelo. Avaliado no timezone declarado (sem ele, UTC).
  - `behavior` — `must_not_tools`, `max_iterations`, `max_tool_calls`, `max_tokens_per_request`, `require_approval_for`, `approval_policy_id`, `tone`, `language`, `must_do`, `must_not`.
  - `data` — `sensitive_fields`, `never_expose`, `restricted_entities`, `restriction_message`.
  - `custom` — shape livre, vira bloco de política no prompt sem interpretação do runtime.
  - `origin` — **NÃO é aplicado em runtime** (nenhum entrypoint propaga IP/origem do cliente; countries/vpn/tor exigem provedor de geo que não integramos). É aceito e armazenado, mas não bloqueia: não use como controle de segurança.
- Superfície de tools: `must_not_tools` é o **único** jeito de tirar uma tool do agente sem desligar o recurso no tenant. Vale no runtime, inclusive no resume de HITL. Ver `zihin://skills/tools-de-agente`.
- ⚠️ **Nome errado em `must_not_tools` não dá erro — dá regra morta.** Tool MCP é bloqueada pelo nome COMPLETO `{server}_{tool}` (ex.: `zigma_processes_create_document`, nunca o nome curto sem o prefixo do server). Em CSP de escopo `agent`, `create_csp`/`update_csp` devolvem `warnings` com `reason: "not_in_surface"` para cada nome que não existe na superfície atual do agente (e sugerem o nome vivo quando o erro é só o prefixo): corrija o nome ou remova a entrada; confira o resultado em `list_agent_tools`. Escopo `tenant`/`team` não é verificado (cada agente tem superfície própria).
- Multi-agente (behavior): `max_agent_depth` (0-5, default 2), `allowed_invoke_agents` (whitelist de UUIDs; vazio = todos), `child_timeout_ms` (5000-300000).

## Aprovação humana — HITL

Duas peças que se conectam:

1. **Política** (quem aprova): `create_approval_policy` com `stages[].approvers` = `{ "type": "user", "id": "<uuid>" }` ou `{ "type": "role", "role": "admin" }`. Contrato: `zihin://schemas/approval_policy`. Gerencie com `list_approval_policies` / `get_approval_policy` / `update_approval_policy` (`is_active: false` desativa).
2. **Gatilho** (o que exige aprovação): na CSP de behavior — `require_approval_for` (array de nomes de tool ou matchers `{ "source": "mcp"|"api"|"db" }`) + `approval_policy_id`. Sem política vinculada, aprova o próprio solicitante.

Vale **só no chat nativo** (chat.zihin.ai): a tool proposta vira card de aprovação na conversa do aprovador; a decisão acontece LÁ, não por esta API. `list_approvals` mostra o kanban de pendências (admin/owner veem todas; editor só as próprias + o que pode aprovar).

## Atendimento humano em sessões (operador assume)

Padrão de handoff, nesta ordem:

1. `set_session_control` com `manual_handoff` (ou `suspended` com `expires_at` para pausa temporária — resume automático no vencimento). Sessão fora de `engaged` = novas mensagens fazem bypass do agente.
2. `send_manual_message` — envia pelo MESMO canal outbound do agente (Twilio/Meta/webhook). Exige `control_mode != engaged`. Gravada com `author=human` — quando o agente retomar, NÃO imita o estilo do operador. **Envio único**: a mesma mensagem na mesma sessão em 60s é deduplicada (`idempotent_replay=true`); passe `idempotency_key` para controlar a janela — a mesma chave vale no REST (`Idempotency-Key`). Se receber `IDEMPOTENCY_IN_FLIGHT` ou `DELIVERY_OUTCOME_UNKNOWN`, confira a conversa antes de reenviar — NÃO troque a chave.
3. Turno em andamento descontrolado (loop, resposta fora do alvo)? `cancel_agent_turn` aborta mid-LLM/mid-tool (em multi-agente, cascateia pros subagentes).
4. Encerrou o atendimento humano: `set_session_control` de volta pra `engaged`.

## Denylist de consumidores

`set_consumer_denylist` — flag `do_not_contact` cross-agent no tenant inteiro: mensagens do consumidor recebem bypass silencioso (sem LLM, sem quota). Investigue antes com `get_consumer_profile` / `list_consumer_sessions`. Reversível (mesma tool).

## API Keys e RBAC

- `create_api_key` com `role` — anti-escalação server-side: ninguém cria key com role acima do próprio. Roles: owner/admin (tudo), editor (leitura + perfis), member (só chat/consumer).
- Integração externa (n8n, webhook) deve receber key com o MENOR role suficiente — para "só conversar", member basta.

## Controle de engajamento (agente × consumidor)

As três primitivas de bloqueio são avaliadas nesta ordem: **denylist do tenant (`set_consumer_denylist`) > engajamento por agente×consumidor (`set_engagement_control` / `end_engagement`) > controle de sessão (`set_session_control`)**. O pipeline roda nas rotas de chat/Builder e dentro do motor (`runAgentSync`), o que inclui `chat_with_agent`, e-mail e schedule — um consumidor bloqueado recebe a mensagem fixa e o agente não roda (`chat_with_agent` devolve `gated: true`).

**Identidade em `chat_with_agent` (#537)**: só key admin/owner pode DECLARAR quem é a pessoa (`consumer_key`); editor tem o campo ignorado e `member` já identifica a si mesma. Reusar o `session_id` de outra pessoa é recusado com `CONFLICT` — abra conversa nova (omita o `session_id`). Conversa que ainda não tem identidade é ADOTADA pela primeira declaração e fica travada nela a partir daí.

Quando um agente deve parar de responder UM consumidor (fora de escopo, opt-out, processo concluído) sem bloquear a pessoa no tenant inteiro, use `set_engagement_control` com `action: canned`, `message` (texto puro, sem links) e opcionalmente `expires_in_days`. A plataforma responde `message` a esse consumidor sem acionar o agente. `action: engage` reabre. O próprio agente pode fazer isso na conversa se tiver `engagement_control_enabled: true` (`update_agent`) — ele ganha a tool `end_engagement`, que só restringe; reabrir é sempre do operador. Para bloquear a pessoa em todos os agentes, use `set_consumer_denylist`. (Pelo Builder Agent, o flag é proposto via proposta de ajuste do agente; `set_engagement_control` é ação do operador e o Builder não a propõe.)
