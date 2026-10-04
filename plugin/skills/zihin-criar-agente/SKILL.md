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

APIs externas ou MCP servers → leia `zihin://skills/tools-de-agente`.

## Passo 5 — Validar TUDO antes de publicar

1. `validate_agent_schemas` — valida todos os schemas do agente de uma vez e cruza persona/skills/workflow com a superfície efetiva: `surface.cited_outside` lista toda tool que o texto ensina mas a CSP bloqueia (ou que o servidor MCP não oferece). Zere essa lista antes de publicar — senão o agente vai chamar a tool, receber "not a valid tool" e dizer ao usuário que a ferramenta está indisponível.
2. `list_agent_tools` — confere que cada tool resolve (`resolved` vs `error`).
3. `get_agent_full` — revisão final da configuração completa.

## Passo 6 — Publicar

`publish_agent` (valida schemas de novo; name mismatch em api_config é erro bloqueante). Cria snapshot de publicação (reversível via `rollback_snapshot`).

## Passo 7 — Canais (opcional)

- Chat nativo (chat.zihin.ai): `update_agent` com `chat_enabled: true` (gate por agente, default false — sem isso o usuário final não vê o agente no chat).
- Webhook/cron/e-mail: leia `zihin://skills/triggers-e-canais`.
- Chips de resposta rápida (`suggest_replies`, até 4 opções curtas ao fim do turno): saem no chat nativo e na integração `/stream` que declara `capabilities: { blocks: ["quick_replies"] }`. Ligados por padrão; `update_agent` com `quick_replies_enabled: false` desliga (cada uso custa uma chamada extra ao modelo). Webhook/WhatsApp nunca recebem a tool.

## Passo 8 — Memória persistente e engajamento (opcional)

- `update_agent` com `memory_enabled: true` carrega `save_memory`/`recall_memory`/`forget_memory` e liga o auto-recall. Default false; skill NÃO habilita memória (o acoplamento com `skill_config` morreu em mai/2026). Ligar o flag invalida a superfície de tools do agente (a tool aparece no turno seguinte).
- Contrato de escrita (instrua na persona — o runtime valida só a FORMA): grave DEPOIS de responder, um fato por chave; `fact`/`preference`/`instruction` exigem `user_statement` (a frase exata do usuário — inferência é rejeitada); `context` é observação do agente e **expira em 7 dias**; chave `snake_case` 3–50 chars (prefixos `lead_`/`pref_`/`instr_`); prefixo `_` é reservado da plataforma; cartão NUNCA, CPF só como `fact` declarado.
- Dois caminhos de leitura: **auto-recall** (todo turno, só `source=user` + fact/preference/instruction, teto 1500 chars) e **`recall_memory`** (o agente pede; é o ÚNICO caminho para `context`). Máximo 50 memórias vivas por escopo (FIFO).
- Identidade separa as pessoas: sem `user_key` resolvido não há memória (falha fechada). Em `chat_with_agent`, key admin/owner **exige `consumer_key` para habilitar memória**; sem o campo, a conversa roda sem memória. Key `member` já identifica (e não pode falar por outra pessoa); key `editor` tem o campo **ignorado**. Sob admin/owner a identidade é DECLARADA: reusar um `session_id` de outra pessoa é recusado com `CONFLICT`; para uma pessoa nova, omita o `session_id`. Conversa que ainda não tem identidade é ADOTADA pela primeira declaração e fica travada nela a partir daí. Em webhook, garanta `idUsuario`/`_waId`/telefone no `context_mapping`.
- NÃO use memória para estado de máquina: encerrar o engajamento com uma pessoa é `engagement_control_enabled: true` no agente (ele ganha `end_engagement`, que só restringe) ou `set_engagement_control` pelo operador; suspender é `set_session_control`; bloquear no tenant é `set_consumer_denylist`. O padrão `save_memory('_session_control')` está morto.
- Operar: `list_agent_memory` (filtra chaves `_` e expiradas; não expõe proveniência) e `delete_agent_memory` (soft delete, com `scope`). Contrato completo: `docs/technical/MEMORY-CONTRACT.md`; engajamento: `docs/technical/ENGAGEMENT-CONTROL.md`.

## Depois de publicado

- Teste real: `chat_with_agent` (consome tokens; reutilize o `session_id` retornado para manter contexto).
- Iterar: `update_agent`/`update_schema` + `publish_agent` de novo. Histórico/rollback: `list_versions`, `list_snapshots`, `rollback_version`.
- Editar schema de agente em produção (ou com mais de um editor): `get_schema` → guarde a `version` → `update_schema` com `base_version` = essa versão e um `changelog` dizendo o porquê. Se outra pessoa gravou no meio, volta `CONFLICT` com a versão atual e **nada é gravado** — releia, veja a diferença com `compare_versions` e reaplique. `schema_data` substitui o documento inteiro.
- Clonar como base: `clone_agent` (clone nasce em draft; triggers clonados desabilitados).
