# Análise — zihin-mcp (client/proxy) × MCP spec 2026-07-28

> Análise de 31/07/2026, parte da auditoria do ecossistema Zihin contra a spec MCP 2026-07-28
> (changelog: https://modelcontextprotocol.io/specification/2026-07-28/changelog).
> Issue de compatibilização: ver issues do repo.

O repo é um **proxy stdio ↔ Streamable HTTP**: um `Client` MCP que fala com `https://llm.zihin.ai/mcp` e um `Server` local via stdio para Claude Desktop/Cursor/etc. (`src/index.js:1-16`). O proxy vive nos dois dialetos ao mesmo tempo — isso define a estratégia de transição.

## A) Estado atual

**SDK e protocolo**
- `package.json:40` — `@modelcontextprotocol/sdk: ^1.12.1`; lockfile resolve **1.27.1** (`package-lock.json:33-35`). SDK v1, monolítico, `LATEST_PROTOCOL_VERSION = '2025-11-25'` (suporta 2024-10-07 → 2025-11-25). Negociação por `initialize` clássico.
- O código do proxy **não toca no handshake** — `remoteClient.connect(httpTransport)` (`src/index.js:109`) delega tudo ao SDK. A migração se concentra no upgrade de SDK, não em código próprio.

**Transportes**
- Client: `StreamableHTTPClientTransport` (`src/index.js:16, 84-97`). Sem HTTP+SSE legado, sem fallback.
- Server local: `StdioServerTransport` (`src/index.js:364`). Segundo client no instalador de skills, mesma pilha (`src/install-skills.js:109-114`).

**Sessão / handshake / reconexão**
- `Mcp-Session-Id`: usado implicitamente pelo SDK. O proxy só o conhece indiretamente: `isConnectionError()` casa as strings `'session'` e `'404'` para detectar sessão expirada (`src/index.js:414-415`).
- Resumability: `reconnectionOptions` no transport (`src/index.js:90-95`) configura retomada SSE via `Last-Event-ID`.
- Reconexão própria: `onclose`/`onerror` → `reconnect()` com backoff exponencial 1s→30s, máx. 10 tentativas (`src/index.js:99-107, 226-260`); keepalive de 30s via `listTools()` (`src/index.js:193-215`); `withRetry()` reconecta e **reemite a operação** em erro de conexão (`src/index.js:264-276`).
- Erros: detecção 100% por string de mensagem (`isAuthError` `src/index.js:388-398`, `isConnectionError` `403-422`). Nenhum código JSON-RPC numérico tratado.

**Notificações e discovery**
- Boot: `listTools`/`listResources`/`listPrompts` em `Promise.allSettled` + probe de versão do server via tool `whoami` (`src/index.js:112-125, 167-189`).
- Handlers para `list_changed` que redisparam o list correspondente (`src/index.js:128-159`) — dependem do **GET stream** que o SDK v1 abre automaticamente.
- Listas cacheadas em memória sem TTL (`src/index.js:71-73`); o keepalive só compara **length** para detectar mudança (`src/index.js:200`) — não detecta troca de tool com contagem igual.

**Roots / Sampling / Logging / Elicitation / Subscribe / Tasks**: nada implementado. **Auth**: API key estática em `X-Api-Key` via `requestInit` (`src/index.js:87-89`) — item de auth da spec (iss/CIMD) não se aplica.

**Testes**: `test/proxy.test.js:165-176, 394-416` fazem `initialize` manual com `protocolVersion: '2025-03-26'`; `proxy.test.js:202` assume `inputSchema.type === 'object'`.

## B) Impactos

1. **Stateless** — QUEBRA TOTAL contra server 2026-only: SDK v1 exige initialize; um server 2026-07-28 puro não responde → `connect()` falha. `isConnectionError` com `'session'`/`'404'` fica sem sentido; a dança de reconexão encolhe (stateless = reemitir a próxima requisição).
2. **server/discover** — oportunidade dupla: probe de versão/dialeto no boot (substitui o hack do `whoami`) e possível colapso do triplo discovery.
3. **subscriptions/listen** — QUEBRA o discovery dinâmico: os handlers de `list_changed` dependem do GET stream, que deixa de existir. O proxy precisará manter um POST longo `subscriptions/listen` e reemitir localmente como `list_changed` para o client stdio antigo; o keepalive-polling vira fallback.
4. **ping removido** — já resolvido (keepalive usa `listTools()` desde a v1.3.0). Impacto zero.
5. **Tasks** — oportunidade direta: `chat_with_agent` tem turnos de 90s que hoje morrem com a conexão; task handle sobrevive à queda e o polling casa com o `withRetry` existente. Também elimina o risco de reemissão duplicada de turno de agente.
6. **MRTR / resultType** — baixo impacto imediato (não implementa sampling/elicitation). Campo `resultType` extra é benigno para clients antigos (repasse verbatim, `src/index.js:317`); `input_required` precisa ser detectado e virar erro claro (proxy não tem UI para inputRequests).
7. **Fim da resumability SSE** — `reconnectionOptions` vira código morto; o modelo novo é exatamente o que `withRetry` já faz. Atenção: reemitir `tools/call chat_with_agent` não é idempotente — Tasks resolve limpo.
8. **Headers Mcp-Method/Mcp-Name** — responsabilidade do SDK v2; `X-Api-Key` via `requestInit` continua válido.
9. **CacheableResult + ordem determinística** — honrar `ttlMs`/`cacheScope` nas listas cacheadas e trocar o diff por length por comparação profunda.
10. **Códigos -32020..-32099** — tratamento por string → por `error.code`: `-32022` (UnsupportedProtocolVersion) fatal; resource-not-found migra para `-32602`.
11. **Schemas 2020-12 livres** — risco de tradução: o proxy repassa `inputSchema` cru para clients stdio antigos que podem rejeitar raiz não-objeto; o teste `proxy.test.js:202` quebra.
12. **SDK v2** — vetor de toda a migração; imports em `src/index.js:13-27` e `src/install-skills.js:25-26` mudam para os pacotes divididos.

## C) Plano de evolução

Premissa: o server em `llm.zihin.ai/mcp` também é Zihin — o proxy só precisa falar 2026-07-28 quando o server falar. O lado stdio serve Claude Desktop/Cursor **antigos** por tempo indeterminado → o proxy será um **tradutor de dialetos** (HTTP novo ↔ stdio velho).

**Obrigatórias (ordem):**

| # | Mudança | Esforço |
|---|---|---|
| 1 | Tratamento de erro por código numérico (`src/index.js:388-422`); `-32022` fatal; remover heurísticas `'session'`/`'404'`. Fazível já, no SDK v1 | P |
| 2 | Migrar para SDK v2 (pacotes divididos) — reescrever imports, adaptar construção de Client/Server/transports | M |
| 3 | `subscriptions/listen` no lado HTTP com tradução para `list_changed` no stdio local; keepalive-polling como fallback | M |
| 4 | Simplificar reconexão / remover `reconnectionOptions` | P |
| 5 | `resultType` defensivo (ausente = complete; `input_required` = erro explícito) | P |
| 6 | Consertar testes (initialize hardcoded 2025-03-26; inputSchema type object) | P |

**Oportunidades (depois):**

| # | Mudança | Esforço |
|---|---|---|
| 7 | `server/discover` como probe de boot — decide dialeto novo-vs-velho em runtime | P |
| 8 | Cache honrando `ttlMs`/`cacheScope` + diff por conteúdo (corrige o quase-bug do diff por length) | P |
| 9 | Extensão Tasks para `chat_with_agent` | M |
| 10 | Pass-through de `traceparent` em `_meta` | P |

**Sequência de compat:** (fase 0) itens 1+8 no SDK v1, sem risco; (fase 1) SDK v2 falando 2025-xx com o server atual; (fase 2) quando o server Zihin publicar 2026-07-28, ligar o dialeto novo via probe `server/discover`, com fallback automático para initialize; (fase 3) itens 3/4/5 ativos só no dialeto novo. O lado stdio permanece no handshake clássico até os hosts migrarem — o proxy absorve a diferença.

---

## Adendo — 02/08/2026: o servidor já migrou

A análise acima é um retrato de 31/07 e parte de uma premissa que **deixou de valer**: a de que o proxy só precisaria falar 2026-07-28 quando o server falasse. Verificação por probe direto em 02/08:

```
serverInfo     : zihin-builder 2.4.0
Mcp-Session-Id : (nenhum)      <- stateless
tools/resources: 96 / 20
```

A ausência de `Mcp-Session-Id` é a assinatura do desenho stateless do PR zihin-agent-builder#320 (SDK v2, spec 2026-07-28), e `2.4.0` bate com o smoke daquele PR. A branch de deploy do serviço é `server-llm` (158 commits à frente da `main`), onde #320, #321, #323 e #324 já estão mergeados.

**Nada está quebrado**: aquele PR escolheu `legacy: 'stateless'` no `createMcpHandler`, então o mesmo `/mcp` atende as duas eras e o proxy em SDK v1 segue funcionando. A migração aqui é preventiva, não corretiva.

### O que isso muda nas seções B e C

| Item | Como estava | Como está |
|---|---|---|
| **B.3** `subscriptions/listen` | "QUEBRA o discovery dinâmico" quando o server migrar | **Já quebrou.** Sem sessão não há GET SSE server→client: os handlers de `list_changed` (`src/index.js:128-159`) são código morto hoje. O único detector de mudança em produção é o keepalive de 30s |
| **C.8** cache/diff por conteúdo | "Oportunidade, esforço P" | Promovido: o diff por `length` (`src/index.js:200`) é o **único** mecanismo de detecção que resta |
| **C.7** `server/discover` como probe | Item de trabalho | Vira configuração: o client v2 faz isso com `versionNegotiation: { mode: 'auto' }` (provado no `McpV2Connection.js` do zihin-agent-builder) |
| **C.1** erro por código | "Substituir a classificação por string" | Espelhar o `_classifyProbeError` (`McpClientService.js:767`): a forma do erro **muda** entre SDKs — v1 põe o status HTTP em `err.code`, v2 põe em `err.data.status` e usa `err.code` como string. Regex permanece como *fallback*, não é removida |

### Razão nova para priorizar o SDK v2

O `mcp-server/http.js` do #320 emite `mcp.server.requests{era}` justamente para decidir quando desligar o modo legacy. Enquanto o `@zihin/mcp-server` for SDK v1, **todo usuário do proxy conta como cliente legacy** — a Zihin não consegue concluir que dá para desligar o legacy enquanto o próprio proxy for a maior fonte desse tráfego.

Além disso, o #324 anuncia como próximos passos de lá o cache `ttlMs` (via `InMemoryResponseCacheStore` do client v2) e Tasks SEP-2663. Ambos são consumidos pelo **client**: se o server passar a emitir cache hints e Tasks e o proxy continuar em v1, ele ignora os dois em silêncio.

---

## Adendo — 31/08/2026: o que o handoff de agosto do BE mudou (v2.2.0)

Fechamento da sessão dedicada da issue #16. As seções A–C acima continuam válidas como análise, mas **as referências de linha a `src/index.js` estão defasadas** (o arquivo passou de ~430 para ~670 linhas entre a v1.4.0 e a v2.2.0) — leia-as como ponteiros conceituais, não como endereços.

### Status do plano da seção C

| # | Item | Status |
|---|---|---|
| 1 | Erro por código numérico | ✅ v2.0.0 |
| 2 | SDK v2 (pacotes divididos) | ✅ v2.0.0 |
| 3 | `subscriptions/listen` no lado HTTP | ✅ v2.0.0 — resolvido de graça pelo `listChanged` do ClientOptions |
| 4 | Remover `reconnectionOptions` | ✅ v2.1.0 |
| 5 | `resultType` defensivo | ✅ v2.1.0 |
| 6 | Consertar testes | ✅ v2.0.0 |
| 7 | `server/discover` como probe | ✅ v2.1.0 — virou `versionNegotiation: { mode: 'auto' }` |
| 8 | Cache `ttlMs` + diff por conteúdo | ✅ v2.0.0 |
| 9 | Extensão Tasks para `chat_with_agent` | ⏸ bloqueado — depende de o `/mcp` expor a extensão |
| 10 | Pass-through de `traceparent` | ⏸ bloqueado — o SDK v2 já exporta `TRACEPARENT_META_KEY`; falta o server consumir |

### O ângulo que esta análise não tinha: o tempo

A análise inteira tratou de **dialeto** (handshake, era, forma do erro) e não de **duração**. O handoff de agosto expôs a lacuna: o `/mcp` saiu do timeout global de 30s do Express e ganhou deadline por canal (chat 150s / builder 180s / async 240s), enquanto o proxy nunca sobrescreveu o `DEFAULT_REQUEST_TIMEOUT_MSEC = 60000` do SDK. Resultado em produção: **o proxy era o cortador mais rápido da cadeia** — todo turno com 2+ tool_calls morria aqui com `REQUEST_TIMEOUT` genérico, e o `TURN_TIMEOUT` do server (o único erro que carrega `execution_id` + `session_id`) nunca chegava ao host.

Três consequências de desenho que valem para qualquer mudança futura neste proxy:

1. **Quem corta primeiro decide a mensagem que o usuário lê.** O teto do proxy tem que ficar acima do maior deadline do server (hoje 300s > 240s), senão a camada errada assina o erro.
2. **Timeout ≠ queda de conexão.** Com o server stateless cada request é um POST próprio: o timeout mata o request, não a conexão. Reconectar por timeout é dano colateral, porque o `close()` aborta requests em voo de *outras* chamadas.
3. **Cancelamento virou real.** No dialeto moderno o SDK aborta o POST em vez de mandar `notifications/cancelled`, e o server v2.4.0 honra o disconnect. Isso é bom (não há mais execução órfã queimando token) e perigoso: qualquer `close()` acidental — o do keepalive, por exemplo — passou a **matar o turno do usuário**. Daí a guarda de requests em voo na sonda de saúde.

### Itens do handoff que não exigiram código

- **405 em GET/DELETE** (server stateless): o `StreamableHTTPClientTransport` do SDK v2 trata 405 no GET como fim de stream e no DELETE como terminação aceita, sem `onerror`/`onclose`. E o `terminateSession()` nem dispara o DELETE sem `Mcp-Session-Id`, que o server stateless não manda.
- **Contrato novo de `chat_with_agent`** (`execution_id` no sucesso, `cancelled`, `tools_used`/`tool_calls` não mais vazios, `description` documentando os dois comportamentos): o proxy é pass-through, então virou teste de integração em vez de código.
- **`create_mcp_server`/`update_mcp_server` delegando ao service e `test_mcp_server` como probe real**: mudanças de comportamento server-side que o proxy repassa verbatim.
