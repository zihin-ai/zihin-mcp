---
name: zihin-tools-de-agente
description: Playbook para dar capacidades a um agente Zihin — tools de API externa (api_config), consultas SQL (db_config) e MCP servers externos. Use quando o usuário pedir para integrar uma API, banco de dados ou servidor MCP a um agente. Contém as regras que mais causam falha silenciosa.
---

# Tools de agente — API, SQL e MCP externo

Workflow universal: leia o contrato (`zihin://schemas/api_config` ou `db_config`) → monte → `validate_schema_data` (dry-run) → `create_schema`. Depois confira com `list_agent_tools` que a tool aparece como `resolved`.

## api_config — chamar API externa

`create_schema` com `schema_type: "api_config"` e `schema_data = { tool_definition, editor_schema }`.

**Regras críticas (violar = falha silenciosa em runtime):**

1. **`editor_schema.api.endpoints[].name` DEVE ser IGUAL a `tool_definition.name`** — se diferirem, a tool quebra o roteamento interno sem erro claro.
2. Path parameters usam `${variavel}` (com cifrão): path `/items/${item_id}` com `item_id` declarado no `input_schema`.
3. Auth canônico é `{ "prefix": "Bearer"|"Basic", "secret_ref": "<nome-do-secret>" }` — o campo `type` é DEPRECATED. Para Basic, armazene o secret já em base64.
4. `tool_definition.description` mínimo 20 chars e deve dizer O QUE a tool faz e O QUE retorna (o LLM do agente decide por ela).
5. Recomendado: UMA tool por schema (uma operação por api_config) — múltiplos endpoints exigem action routing.

**Secrets**: crie antes com `create_secret` (o valor em claro aparece SÓ na criação — guarde na hora). Liste com `list_secrets` (valores nunca expostos). Referencie via `secret_ref`.

**Campos de transformação** (opcionais por endpoint): `default_body` (valores fixos mergeados), `locked_fields` (campos que o LLM não pode sobrescrever — enforcement server-side), `field_mapping` (renomeia campos), `array_fields`, `body_format: "array"`, `defaults_from_context` (auto-inject de valores do contexto do webhook quando o LLM não fornece — safety net autoritativo).

## db_config — consulta SQL parametrizada

`create_schema` com `schema_type: "db_config"`:

```json
{
  "connection_id": "<uuid de list_connections>",
  "tool_definition": { "name", "description", "input_schema" },
  "query_template": "SELECT ... WHERE campo ILIKE '%' || $1 || '%' LIMIT COALESCE($2, 10)",
  "parameter_mapping": ["campo_do_input_1", "campo_do_input_2"],
  "result_mapping": { "format": "table", "max_rows": 50 }
}
```

- Placeholders `$1, $2...`; `parameter_mapping` mapeia campos do `input_schema` na ORDEM dos `$N`.
- Antes: `list_connections` → se não existir, `create_connection` (providers: `postgresql`, `supabase`) → `test_connection`.
- Explore o banco antes de escrever SQL: `get_connection_schema` (tabelas/colunas) e `get_connection_semantic` (domínios/entidades). Cache desatualizado → `refresh_connection_schema`.

## MCP servers externos (tools de terceiros no agente)

- `create_mcp_server` registra o endpoint no agente (máx. 10 por agente). `auth_method`: `none`, `bearer`, `api_key`, `tunnel` (via Zihin Tunnel).
- `test_mcp_server` faz ping e lista as tools disponíveis (use para diagnosticar auth/endpoint offline).
- Cache de tools tem TTL de 5 min — atualizou tools no servidor externo? `invalidate_mcp_cache` força reload imediato.
- Sintoma clássico: agente responde "Tool not found" mas a telemetria mostra sucesso → servidor MCP marcado inativo/erro; rode `test_mcp_server` + `invalidate_mcp_cache` (mais em `zihin://skills/diagnostico`).

## Tirar uma tool do agente

Desativar o schema remove a tool para sempre; desligar o recurso no tenant afeta todos os agentes. Para tirar uma tool de UM agente mantendo o recurso disponível, use a blocklist da CSP:

- `create_csp` / `update_csp` com `policy_type: "behavior"`, `scope: "agent"` e `rules.must_not_tools: ["nome_da_tool", ...]`.
- Vale para **qualquer** tool — nativa da plataforma (`web_search`, `fetch_url`, `analyze_image`…), de `api_config`/`db_config` ou vinda de MCP externo.
- É filtrada antes do turno nos dois runtimes, inclusive no resume de aprovação (HITL): a tool bloqueada nunca entra na superfície que o modelo enxerga.
- `update_csp` **substitui** `rules` inteiro — reenvie os outros campos da política junto.
- Confirme com `list_agent_tools` e, no turno seguinte, com `get_execution_trace` (a contagem de tools carregadas cai).

Detalhes de escopo e herança em `zihin://skills/governanca-e-operacao`.

## Checklist de encerramento

1. `validate_schema_data` passou sem errors.
2. `create_schema` retornou sem warnings relevantes.
3. `list_agent_tools` mostra a tool como `resolved`.
4. Teste funcional com `chat_with_agent` pedindo algo que exija a tool (consome tokens).
