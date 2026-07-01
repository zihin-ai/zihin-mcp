---
name: zihin-triggers-e-canais
description: Playbook de triggers do Zihin — webhook (WhatsApp/Slack/Teams/n8n), schedule (cron) e e-mail. Use quando o usuário pedir para conectar um agente a um canal externo, criar automação agendada ou configurar como o agente recebe/responde mensagens. Inclui os gotchas de sessão e formato de resposta.
---

# Triggers e canais

Contrato formal: `zihin://schemas/trigger_config` (granularidade de ENTIDADE — no `create_trigger` você envia só `agent_id`, `name`, `trigger_type` e `trigger_config`; `tenant_id`/ids são injetados pelo servidor). Tipos: `webhook`, `schedule`, `email`, `db_event`.

`create_trigger` de webhook retorna a **URL chamável + API Key** — entregue ambos ao usuário.

## Webhook — decisões na ordem certa

Pergunte antes de montar: qual sistema chama? em qual campo vem a mensagem? qual formato de resposta o sistema espera? precisa manter contexto por usuário?

1. **Extração**: `query_extraction: { mode: "field", field: "message" }` (ou `full_body`).
2. **Formato de resposta** — `response_adapter.format`:
   - `raw` (default, integrações genéricas) · `ebarn` (array) · `slack` (Block Kit) · `teams` (Adaptive Card) · `twiml` (Twilio/WhatsApp — aplica `strip_markdown` e `max_length=4096` automaticamente).
3. **Sessão** — `session_strategy`:
   - `{ "mode": "derive", "fields": ["idUsuario"] }` = session_id determinístico → 1 conversa contínua por usuário.
   - `{ "mode": "ephemeral" }` = sessão nova a cada disparo.
   - ⚠️ GOTCHA REAL: os `fields` do derive precisam resolver via `context_mapping` — se o campo não existir no contexto, cai SILENCIOSAMENTE em sessão nova a cada mensagem (contexto perdido sem erro).
4. **Controle de acesso** — `sender_access.mode`: `any` (default) | `members` (só `tenant_users`, com `identity_field`/`match_column`) | `whitelist` (lista explícita). Esses são os ÚNICOS valores — não invente (ex.: "public" não existe).
5. **Execução** — `execution.mode`: `sync` (default, responde no mesmo request) | `async` (ack imediato + resultado via `callback` com url/method/auth `secret_ref`/`body_template`).
6. **Opcionais**: `context_mapping` (campos do body → contexto do agente, renderizados no prompt), `message_buffer` (debounce de mensagens rápidas via janela), `split_config` (divide respostas longas em chunks p/ WhatsApp/SMS).

## Schedule (cron)

```json
{ "cron": "0 9 * * *", "timezone": "America/Sao_Paulo", "query_template": "mensagem fixa",
  "output": { "channel": "silent" | "webhook" | "callback" } }
```

- `output.channel`: `silent` (só grava), `webhook` (POST em `webhook_url`), `callback` (config completa com auth).
- `session_strategy`: `new` | `persistent`.
- Overlap policy: se a execução anterior ainda roda, o tick é pulado (não empilha).
- `get_scheduler_status` mostra os cron jobs ativos.

## E-mail

`{ "allowed_senders": [...], "subject_filter": "..." }`.

## Testar e operar

- `test_trigger` — ⚠️ EXECUTA o agente de verdade (consome tokens; usa sessão temporária). Payload de teste p/ webhook: `{ "chatInput": "mensagem" }` (ou o campo configurado).
- `toggle_trigger` liga/desliga sem deletar; `list_trigger_executions`/`get_trigger_execution` = histórico.
- Navegação reversa: `get_session_trigger_context` (de uma sessão, descobre o trigger que a originou).
- Gates de atendimento (denylist do consumer, sessão suspensa) respondem com bypass silencioso ao canal — sem LLM, sem quota (ver `zihin://skills/governanca-e-operacao`).
