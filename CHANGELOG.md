# Changelog

## 2.2.1 (2026-09-01)

Sem mudanca de runtime — release de metadados para entrar no MCP Registry oficial (que alimenta o GitHub MCP Registry e a galeria MCP do VS Code).

- **`mcpName: "ai.zihin/mcp-server"` no package.json**: o registry valida que o pacote npm publicado referencia o nome MCP; sem o campo, o `mcp-publisher publish` falha na validacao do pacote.
- **`server.json` na raiz**: registro duplo no mesmo nome — o endpoint remoto (`https://llm.zihin.ai/mcp`, streamable-http, header `X-Api-Key`) e o pacote npm (proxy stdio via `ZIHIN_API_KEY`); o cliente escolhe o modo de instalacao.
- **`scripts/registry-publish.sh`**: fluxo de publicacao com checagens (TXT batendo com a chave local, versoes npm/server.json/package.json coerentes) antes do login+publish.
- **`docs/registry-mcp-oficial.md`**: passo a passo da publicacao (chave Ed25519 + TXT em `zihin.ai`, `mcp-publisher login dns` + `publish`), manutencao por release e alternativas de auth. `key.pem`/`mcp-registry-auth` no `.gitignore`.

## 2.2.0 (2026-08-31)

Sem breaking change: quem esta na 2.1.0 sobe direto (Node >= 20 desde a 2.0.0). O ganho e visivel em turno de agente longo, que antes morria no proxy aos 60s.

### Compatibilizacao com o handoff de agosto/2026 do BE (issue #16)

- **Teto de `tools/call` de 300s** (`ZIHIN_MCP_CALL_TIMEOUT_MS` para override), substituindo o default do SDK de 60s. O `/mcp` do server saiu do timeout global de 30s do Express e passou a ter deadline POR CANAL (chat 150s / builder 180s / async 240s); com 60s o proxy virava o cortador mais rapido da cadeia — todo turno de agente com 2+ tool_calls morria no proxy com `REQUEST_TIMEOUT` generico e o `TURN_TIMEOUT` do server, o unico erro que carrega `execution_id` + `session_id`, nunca chegava ao host. Com 300s o server ganha a corrida em todos os canais e o usuario recebe o erro investigavel. Valor invalido na env avisa e cai no default (typo no config do host nao pode deixar o usuario sem MCP).
- **Timeout deixou de disparar reconexao** no caminho de `tools/call`/`resources`/`prompts` (novo classificador exportado `isTimeoutError`). Com o server stateless, cada request e um POST proprio: o timeout mata o request, nao a conexao. Reconectar ali era dano colateral — o `close()` do client aborta os requests em voo de OUTRAS chamadas, inclusive um turno de chat longo que ainda ia responder. O keepalive (sonda de saude) continua tratando timeout como sintoma de queda.
- **Mensagem de timeout diz o que aconteceu com o trabalho**: no dialeto 2026-07-28 o SDK aborta o POST em vez de mandar `notifications/cancelled`, e o abort E o sinal de cancelamento que o server v2.4.0 honra — o turno cai de verdade, nao segue orfao queimando tokens. A mensagem ao host informa isso e aponta a env para subir o teto.
- **Testes do contrato novo de `chat_with_agent`**: `execution_id` presente no SUCESSO (nao so no erro), forma de `cancelled`/`tools_used`/`tool_calls` (que deixaram de vir literalmente vazios no motor v2) e a `description` chegando inteira ao host — truncar a description repete, em outro campo, o bug de `instructions` corrigido na 2.0.1: nenhum erro visivel, "o agente so erra mais".

### Resiliencia (revisao da implementacao)

- **Keepalive nao derruba mais chamada em voo**: com o teto de 300s um `chat_with_agent` fica minutos em voo, sob varios ticks de keepalive. Um unico tick com falha transitoria (502 de LB, blip de rede) chamava `reconnect()`, cujo `close()` ABORTA o request em voo — e no dialeto moderno o abort e cancelamento de verdade: a sonda de saude matava o turno do usuario. Agora o tick e pulado enquanto ha request em voo (um request ativo e prova de vida melhor que a sonda; se a conexao caiu de fato, e ele quem falha primeiro e o `withRetry` reconecta).
- **Faixa aceita para `ZIHIN_MCP_CALL_TIMEOUT_MS`**: valor fora de `[1000, 1800000]` ms e clampado com aviso. O piso pega o typo classico de pensar em SEGUNDOS (`=300` mataria todo `tools/call` em 300 ms culpando o server); o teto evita o overflow do `setTimeout` acima de 2^31 ms, em que o "timeout infinito" vira timeout instantaneo.
- **Timeouts de headers/body do `fetch` do Node** (`UND_ERR_HEADERS_TIMEOUT`/`UND_ERR_BODY_TIMEOUT`) entram na classificacao de conexao — relevantes agora que uma chamada pode legitimamente durar minutos e encostar no teto proprio do undici (~300s).

### Skills empacotadas

- **Skills do plugin ressincronizadas com o BE** (`npm run sync-skills`): 5 das 6 estavam defasadas em relacao ao que o server publica em `zihin://skills/*` — tier de modelo que avisa no save e barra no `publish_agent`, `must_not_tools` como unico jeito de tirar uma tool de um agente, nomes reais das rules de CSP (campo fora do contrato e aceito em silencio e fica inerte), `origin` que nao e aplicado em runtime, e o bloco `call` do webhook (path `/api/triggers/webhook/{id}`, header de auth por trigger, canal de saida `user`). Quem instalou o pacote lia o playbook antigo.
- **`scripts/sync-skills.mjs --from-server` voltou a funcionar**: ainda importava `@modelcontextprotocol/sdk` (SDK v1), fora das dependencias desde a 2.0.0 — o modo servidor morria com `MODULE_NOT_FOUND`.

### Seguranca

- **Path traversal fechado no `sync-skills.mjs --from-server`** (achado da revisao de seguranca deste PR): reviver o ramo trouxe de volta um sink em que o `name` do frontmatter — bytes vindos do server — virava componente de caminho sem validacao (`path.join(DEST, name)` + `mkdirSync` recursivo + `writeFileSync` com corpo tambem do server). Era o mesmo furo que o `install-skills.js` ja fechava com `/^[\w-]+$/` e que este script contornava com parse ad-hoc: server comprometido gravava arquivo de conteudo controlado em caminho arbitrario da maquina que roda o release — a que tem a API Key e o direito de publicar. Agora usa o `parseSkill()` compartilhado (parse ancorado no frontmatter + choke point), checa contencao dentro de `plugin/skills/`, recusa colisao de nome e so apaga o destino depois de baixar e validar tudo. Severidade baixa por escopo: `scripts/` nao esta em `files` do package.json, entao nenhum usuario do npm era exposto.

### Documentacao

- **Troubleshooting de timeout no README**: como distinguir o teto do proxy (mensagem propria, trabalho cancelado, sobe com `ZIHIN_MCP_CALL_TIMEOUT_MS`) do deadline do server (`TURN_TIMEOUT` com `execution_id` + `session_id` — os dois identificadores que o suporte precisa), e a nota de que o cliente MCP tem timeout proprio, independente destes.
- **Skills empacotadas viraram item documentado de release** (CLAUDE.md): sao copia congelada do BE, entao mudanca la so chega ao usuario com republicacao no npm.

### Verificado sem mudanca de codigo

- **GET/DELETE respondendo 405** (server stateless): o `StreamableHTTPClientTransport` do SDK v2 trata os dois como fim de stream normal (GET) e como terminacao aceita (DELETE), sem `onerror`/`onclose` — o proxy nao entra em loop de reconexao. Nada a corrigir.
- **Superficie e identidade**: as `instructions` do server ja sao repassadas desde a 2.0.1 (pendencia 7 da issue #16 fechada antes da promocao da 2.1.0 a `latest`).

## 2.1.0 (2026-08-02)

### Compatibilização MCP 2026-07-28 — Fase 2 (issue #6): dialeto moderno ligado

- **Flip do dialeto no lado HTTP**: `versionNegotiation: { mode: 'auto' }` no client. O `connect()` agora faz o probe `server/discover`; contra o server de produção (v2.4.0, spec 2026-07-28) a conexão negocia a era moderna — os requests do proxy saem de `era=legacy` na métrica do server. O fallback é automático e conservador: qualquer resposta que não seja evidência moderna definitiva (server antigo, rollback) cai no handshake `initialize` byte-idêntico ao da 2.0.x. O lado stdio permanece no dialeto clássico — o proxy é o tradutor.
- **`resultType` defensivo**: `inputRequired: { autoFulfill: false }`. O proxy não tem UI nem registra handlers de elicitation/sampling/roots; sem o modo manual, um `input_required` (vocabulário novo da era moderna) entraria no driver de auto-fulfilment do SDK contra handlers inexistentes. Agora vira erro imediato, convertido em mensagem clara ao host no `tools/call` (novo classificador exportado `isInputRequiredError`). Rede de segurança: o proxy não declara as capabilities que autorizariam o server a pedir input.
- **`reconnectionOptions` removido do transport**: resumability de SSE só existe para o GET stream, que o server stateless não oferece — era código morto. A reconexão real continua sendo a do proxy (`reconnect()`, backoff exponencial próprio).

## 2.0.1 (2026-08-02)

### Correções

- **Identidade espelhada do upstream no handshake stdio** (achado da validação de canary da 2.0.0 — diff de contrato proxy × servidor, 10/13): o proxy respondia `initialize` com identidade própria (`zihin-mcp-proxy`, sem `title`) e **sem `instructions`** — o texto de 2.110 chars que ensina o modelo a operar as 96 tools (fluxos, RBAC, ponteiro para as skills `zihin://skills/*`). Sem ele, quem instala o pacote opera às cegas: nenhum erro visível, "o agente só erra mais". Agora `serverInfo.name`/`title` e `instructions` são repassados do server real (`client.getServerVersion()`/`getInstructions()`, já obtidos no boot). A `version` continua a do proxy — identifica o hop que responde o stdio em bug reports. Gap pré-existente: a 1.4.0 também nunca repassou (o "pass-through" do CHANGELOG da 1.4.0 nunca valeu para o handshake).

## 2.0.0 (2026-08-02)

### Compatibilização MCP 2026-07-28 — Fases 0 e 1 (issue #6)

- **SDK v2** (`@modelcontextprotocol/client` + `@modelcontextprotocol/server` `^2.0.0`, pacotes divididos), substituindo o monolítico `@modelcontextprotocol/sdk` v1 que para no protocolo 2025-11-25. O proxy segue falando o dialeto clássico nas duas pontas (`versionNegotiation` default `legacy` — handshake byte-idêntico); ligar o dialeto 2026-07-28 no lado HTTP vira um flip de configuração (`mode: 'auto'`) na Fase 2. **BREAKING: Node.js >= 20** (exigência do SDK v2; Node 18 é EOL desde abr/2025).
- **Classificação de erro por código** em vez de heurística de string, já lendo as formas do v1 (`error.code` = status HTTP) e do v2 (`error.data.status`; `error.code` string). Removidos: `includes('api key')` (bug latente — erro de tool remota mencionando API Key derrubava o proxy) e as heurísticas `'session'`/`'404'` da era session-based. `-32022` (UnsupportedProtocolVersion) é fatal com instrução de upgrade.
- **Keepalive com diff por conteúdo**: com o server stateless (produção desde 01/08) não há GET stream para `list_changed`; o keepalive de 30s é o único detector de mudança e agora compara assinatura, não `length`.
- **`list_changed` via `ClientOptions.listChanged`**: funciona nas duas eras (notificação legacy hoje, `subscriptions/listen` auto-aberto no dialeto moderno).
- Testes: falha de boot do proxy vira diagnóstico legível (exit code + stderr) em vez de timeout opaco de 20s; contagens exatas viram pisos; 13 testes unitários novos de classificação de erro; `protocolVersion` dos testes parametrizado em `STDIO_PROTOCOL_VERSION`.

### Revisão quádrupla (segurança/performance/resiliência/cobertura)

- **`tools/call` nunca é reemitido** após erro de conexão/timeout: reemitir `chat_with_agent` não é idempotente e timeout é o caso em que a 1ª execução mais provavelmente ainda roda no server (turno duplicado). O proxy reconecta em background e devolve o erro ao host. `list`/`read`/`get` (idempotentes) mantêm retry transparente.
- Status HTTP transitórios de LB/CDN/deploy (404/408/502/503/504) são recuperáveis por código, nas formas v1 e v2.
- Keepalive com `cacheMode: 'bypass'`: nunca servido do cache (auth/queda sempre validados) e sem stamp churn no índice de validators do SDK (evita recompilação AJV no 1º `callTool` após cada tick).
- Mensagens de erro fatal via `fs.writeSync(2)` — `process.exit()` não drena stderr assíncrono; o host via só "Server disconnected".
- **Segurança (`install-skills`)**: `name` de skill não pode ser componente de caminho livre — um server comprometido com `name: ../../x` gravava arquivo controlado em diretório arbitrário. Choke point em `parseSkill` (`/^[\w-]+$/`).

### CI/CD

- Testes de integração (que executam um turno real de `chat_with_agent`, com custo de LLM) saem do CI de push/PR — só testes offline lá. A integração real fica como gate do publish (`REQUIRE_INTEGRATION=1`: secret ausente falha em vez de pular).

## 1.4.0 (2026-07-01)

### Funcionalidades

- **`install-skills`**: novo subcomando que instala as 6 skills do MCP Zihin no formato nativo do client — `--client claude|cursor|windsurf|codex|all`, `--dir`, `--global` (claude), `--bundled` (offline). Fonte primaria: o server vivo (resources `zihin://skills/*`); fallback: bundle empacotado no npm (`plugin/skills/`, sincronizado via `npm run sync-skills`).
- **Plugin Claude Code**: marketplace neste repo (`claude plugin marketplace add zihin-ai/zihin-mcp` + `claude plugin install zihin@zihin`) — instala MCP server + skills em um comando.
- Proxy compativel com server v2.4.0+ (96 tools com ToolAnnotations, 19 resources incl. contratos `zihin://schemas/*` e skills, instructions role-aware) — pass-through, sem mudanca de codigo no proxy.

### Testes

- `test/install-skills.test.js` (10 testes, sem rede): conversores puros por client + e2e local com `--bundled` em diretorio temporario (incl. idempotencia do bloco AGENTS.md).

## 1.3.0 (2026-03-28)

### Funcionalidades

- **Identificação de tenant no boot**: chama `whoami` após conexão e exibe `✓ Tenant: "Nome" (role: admin, plan: basic)` no stderr — elimina ambiguidade ao operar com múltiplas tenants
- **Smart keepalive**: substituído `ping()` por `listTools()` a cada 30s — detecta tools novas/removidas e valida auth continuamente
- **Detecção de auth error**: erros 401/403 agora são tratados como fatais (`exit(1)`) com mensagem clara, ao invés de reconectar infinitamente com key revogada
- **Limite de reconexão**: máximo de 10 tentativas antes de encerrar (`MAX_RECONNECT_ATTEMPTS`)
- `withRetry` não retenta operações em erros de autenticação

### Compatibilidade

- Compatível com MCP Server v2.3.0 (76 tools, 3 resources, 3 prompts)
- +1 tool: `whoami` (consumer, todos os roles) — identificação de tenant/role/plano
- Sem breaking changes — atualização transparente
- Graceful degradation: se o server não tem `whoami` (< v2.3.0), o proxy funciona normalmente sem identificação

---

## 1.2.0 (2026-03-21)

### Correções

- Auto-reconnect com backoff exponencial (1s → 30s) após queda de conexão por idle, deploy ou instabilidade de rede
- Keepalive via `ping()` a cada 30s para detectar conexão morta proativamente
- Retry transparente em `callTool`, `readResource` e `getPrompt` em erros de conexão
- Error handlers (`onerror`/`onclose`) no transport HTTP disparam reconnect automático

### Compatibilidade

- Compatível com MCP Server v2.2.0 (75 tools, 3 resources, 3 prompts)
- 3 novas tools: `list_agent_memory`, `delete_agent_memory`, `get_scheduler_status`
- Sem breaking changes — atualização transparente

---

## 1.1.0 (2026-03-13)

### Funcionalidades

- Discovery dinâmico: proxy escuta notificações `tools/list_changed`, `resources/list_changed`, `prompts/list_changed` do server remoto e atualiza listas automaticamente (sem restart)

### Compatibilidade

- Compatível com MCP Server v2.1.0 (72 tools, 3 resources, 3 prompts)
- Sem breaking changes — atualização transparente

---

## 1.0.0 (2026-03-09)

Lancamento inicial do `@zihin/mcp-server`.

### Funcionalidades

- Proxy transparente stdio-to-HTTP para clientes MCP
- Descoberta automatica de tools, resources e prompts do server remoto
- Suporte a Claude Desktop, Cursor, Claude Code, Codex e Windsurf
- Validacao de API Key com mensagens de erro claras
- Auth via header `X-Api-Key` com RBAC enforced server-side

### Capabilities (role admin)

- 69 tools (incluindo `chat_with_agent` com session tracking)
- 3 resources (`zihin://agents`, `zihin://models`, `zihin://schema-templates`)
- 3 prompts (`setup-agent`, `add-tool`, `configure-webhook`)

### Testes

- 19 testes de integracao real contra producao
- Cobertura: validacao, tools, resources, prompts, protocolo MCP

### CI/CD

- GitHub Actions: CI em push/PR, publish automatico em tag `v*`
