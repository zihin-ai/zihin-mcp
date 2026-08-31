---
name: zihin-criar-agente
description: Playbook completo para criar e publicar um agente Zihin do zero (agente → persona → tools → validação → publish → canais). Use quando o usuário pedir para criar, configurar ou publicar um agente de IA na plataforma Zihin.
---

# Criar e publicar um agente Zihin

Sequência canônica — não pule a validação nem inverta a ordem:

## Passo 1 — Criar o agente

`create_agent` com `name` (interno), `commercial_name` (exibido ao usuário final), `bio`, `type` (`assistant` | `chatbot` | `workflow` | `classifier` | `orchestrator` — orchestrator invoca outros agentes) e `llm_config`:

- `model`: `"provider.modelo"` explícito (ex.: `openai.gpt-4.1-nano`) ou `"auto"` (roteamento inteligente). Consulte modelos válidos no resource `zihin://models` — NUNCA invente IDs de modelo. **O prefixo de provider é obrigatório**: `"gpt-4o"` é rejeitado, `"openai.gpt-4o"` é aceito.
- `fallback_chain`: até 5 modelos ordenados, sem repetição.
- `max_iterations`: teto de iterações do loop por turno (máx. 30 — o runtime clampa aí).
- Contrato completo em `zihin://schemas/llm_config`. Ele é **campo da tool**, não `schema_data` — `validate_schema_data` não aceita esse tipo.
- Guarde o `agent_id` retornado.

**Tier do plano — onde o erro aparece.** Modelo acima do tier **não bloqueia** `create_agent` nem `update_agent`: a chamada passa e volta com `warnings` explicando. O bloqueio é no `publish_agent`, com `MODEL_TIER_RESTRICTED`. Se vier um `warnings` sobre tier, **trate ali** — trocar o modelo ou usar `"auto"` — em vez de seguir e descobrir na publicação. `whoami` informa o plano do tenant.

Outro erro esperável: `PLAN_LIMIT_REACHED` (limite de agentes do plano).

## Passo 2 — Persona (obrigatória antes de publicar)

`create_schema` com `schema_type: "persona_config"`. Formato canônico ÚNICO aceito:

```json
{
  "editor_schema": {
    "persona": {
      "role": "Assistente de atendimento",        // obrigatório, min 3 chars
      "objective": "Responder dúvidas de clientes de forma objetiva.", // obrigatório, min 10 chars
      "tone": "profissional",
      "language": "pt-BR",
      "expertise": ["área 1"],
      "constraints": ["NUNCA fazer X", "SEMPRE fazer Y"],
      "personality_traits": ["Objetivo"]
    }
  }
}
```

O formato legado com `instructions` na raiz NÃO funciona. Contrato formal: `zihin://schemas/persona_config`. Pergunte ao usuário sobre objetivo/comportamento antes de criar — não invente persona.

## Passo 3 — Skills comportamentais (opcional)

`create_schema` com `schema_type: "skill_config"`: `{ "skill": { "name", "instructions", "priority"? } }`. `instructions` tem min 50 / max 5000 chars (markdown com QUANDO agir, O QUE fazer, O QUE NÃO fazer). Nome de skill é ÚNICO por agente (erro `SKILL_NAME_DUPLICATE`). `priority` maior aparece primeiro no prompt.

## Passo 4 — Tools (opcional)

APIs externas, SQL ou MCP servers → leia `zihin://skills/tools-de-agente`.

## Passo 5 — Validar TUDO antes de publicar

1. `validate_agent_schemas` — valida todos os schemas do agente de uma vez.
2. `list_agent_tools` — confere que cada tool resolve (`resolved` vs `error`).
3. `get_agent_full` — revisão final da configuração completa.

## Passo 6 — Publicar

`publish_agent` (valida schemas de novo; name mismatch em api_config é erro bloqueante). Cria snapshot de publicação (reversível via `rollback_snapshot`).

## Passo 7 — Canais (opcional)

- Chat nativo (chat.zihin.ai): `update_agent` com `chat_enabled: true` (gate por agente, default false — sem isso o usuário final não vê o agente no chat).
- Webhook/cron/e-mail: leia `zihin://skills/triggers-e-canais`.

## Depois de publicado

- Teste real: `chat_with_agent` (consome tokens; reutilize o `session_id` retornado para manter contexto).
- Iterar: `update_agent`/`update_schema` + `publish_agent` de novo. Histórico/rollback: `list_versions`, `list_snapshots`, `rollback_version`.
- Clonar como base: `clone_agent` (clone nasce em draft; triggers clonados desabilitados).
