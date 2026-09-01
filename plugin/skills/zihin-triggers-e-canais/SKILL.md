---
name: zihin-triggers-e-canais
description: Playbook de triggers do Zihin — webhook (WhatsApp/Slack/Teams/n8n), schedule (cron) e e-mail. Use quando o usuário pedir para conectar um agente a um canal externo, criar automação agendada ou configurar como o agente recebe/responde mensagens. Inclui os gotchas de sessão e formato de resposta.
---

# Triggers e canais

Contrato formal: `zihin://schemas/trigger_config` (granularidade de ENTIDADE — no `create_trigger` você envia só `agent_id`, `name`, `trigger_type` e `trigger_config`; `tenant_id`/ids são injetados pelo servidor). Tipos: `webhook`, `schedule`, `email`, `db_event`.

`create_trigger`/`get_trigger`/`list_triggers` de webhook retornam um bloco **`call`** com a **URL chamável + qual header de auth** enviar (ver §Como chamar). ⚠️ NÃO retornam a API Key — a key é do tenant, gerada à parte; entregue a URL + a key ao usuário.

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

## Como chamar o webhook (runtime)

O path de execução é **interno do BE** e o header de auth **depende do trigger** — por isso ele NÃO se adivinha. Use o bloco `call` que `create_trigger`/`get_trigger`/`list_triggers` retornam:

```
POST {LLM_BASE_URL}/api/triggers/webhook/{trigger_id}
```

- **Não é sob `/api/v1/`** — é `/api/triggers/webhook/{id}`. A rota tem auth PRÓPRIA por trigger (não o middleware global de `/api/v1`).
- **Header de auth** = `call.auth.header`, derivado de `trigger_config.auth.type`:
  - `api_key` → `X-Api-Key: <key do tenant>`
  - `signature` → `X-Webhook-Signature: <HMAC do raw body com o secret>` (⚠️ X-Api-Key NÃO serve aqui)
  - ausente / `none` → sem header (mas `sender_access` ainda se aplica)
- **Body**: o que o `query_extraction` espera — `{ "<field>": "mensagem" }` (default field `message`; payload de teste rápido usa `chatInput`). Campos extras viram `webhookContext` (renderizados no prompt e resolvem `{{template}}` do `output`/callback).
- **Resposta**: `sync` responde no mesmo request (formato via `response_adapter`); `async` devolve ack e entrega o resultado via `execution.callback`.

## Schedule (cron)

```json
{ "cron": "0 9 * * *", "timezone": "America/Sao_Paulo", "query_template": "mensagem fixa",
  "output": { "channel": "silent" | "webhook" | "callback" | "user" } }
```

- `output.channel`: `silent` (só grava), `webhook` (POST simples em `output.webhook_url`), `callback` (`output.callback` completo com auth + `split_config` p/ chunkar resposta longa em WhatsApp/SMS), `user` (entrega na sessão do chat nativo + push proativo — ver §Canal de saída). `agent` existe no enum mas está **reservado / NOT_IMPLEMENTED** (só loga warn).
- `session_strategy`: `new` | `persistent`.
- Overlap policy: se a execução anterior ainda roda, o tick é pulado (não empilha).
- `get_scheduler_status` mostra os cron jobs ativos.

## E-mail

`{ "allowed_senders": [...], "subject_filter": "..." }`.

## Canal de saída (`output`) — a resposta pode sair por canal ≠ da entrada

O bloco `output` decide **para onde vai o resultado depois que o agente roda** — é independente de por onde a mensagem entrou. Assim um cron pode responder no WhatsApp, um evento de banco pode empurrar um card no chat, etc. Enum de `output.channel` no contrato `zihin://schemas/trigger_config`: `silent | webhook | callback | user` (`agent` reservado, não implementado).

**O que cada trigger REALMENTE implementa hoje** (não confie só no enum — o wiring difere por tipo):

| Trigger | Como responde |
|---|---|
| **schedule** | `silent` · `webhook` (`output.webhook_url`) · `callback` (`output.callback` + `split_config`) · `user` |
| **webhook** | resposta **síncrona** via `response_adapter` (sync) ou `execution.callback` (async). O bloco `output` só implementa **`user`** — os demais valores são ignorados aqui. |
| **db_event** | não tem resposta síncrona: default `silent`; o bloco `output` só implementa **`user`**. |

**`channel: "user"`** (SPEC D / #9) — entrega a resposta **na sessão do chat nativo** de um usuário-alvo e dispara push proativo:
```json
"output": {
  "channel": "user",
  "target": { "field": "user_id" | "consumer_key", "value": "<literal ou {{template}}>" },
  "push":   { "title": "...", "body": "..." }
}
```
- `target.field`: `user_id` (um `tenant_user`, exige UUID válido) ou `consumer_key` (registro em `agent_consumers`).
- `target.value`: em **webhook** resolve template do `webhookContext` (ex: `{{idUsuario}}`); em **db_event** usa `{{record.*}}`/`{{old.*}}`.
- ⚠️ **Gotcha do schedule**: o cron não tem contexto de evento (`context` vazio), então `target.value` com `{{template}}` **não resolve e é pulado silenciosamente** — no schedule use um `user_id`/`consumer_key` **literal**. Alvo dinâmico só funciona em webhook/db_event.
- `push` é opcional; sem ele o fallback é o nome do agente / 1ª linha da resposta.
- Entrega é fail-soft (nunca derruba o turno). Denylist F5-B (`do_not_contact`) do consumer é respeitada.

**Responder no WhatsApp a partir de schedule** → `channel: "callback"` apontando pro endpoint de envio (Twilio/Meta/n8n), com `auth.secret_ref` e `split_config` p/ mensagens longas.

## Testar e operar

- `test_trigger` — ⚠️ EXECUTA o agente de verdade (consome tokens; usa sessão temporária). Payload de teste p/ webhook: `{ "chatInput": "mensagem" }` (ou o campo configurado).
- `toggle_trigger` liga/desliga sem deletar; `list_trigger_executions`/`get_trigger_execution` = histórico.
- Navegação reversa: `get_session_trigger_context` (de uma sessão, descobre o trigger que a originou).
- Gates de atendimento (denylist do consumer, sessão suspensa) respondem com bypass silencioso ao canal — sem LLM, sem quota (ver `zihin://skills/governanca-e-operacao`).
