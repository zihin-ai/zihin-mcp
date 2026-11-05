# Novos canais de distribuicao — pesquisa e quick wins preparados

Pesquisa de 04/10/2026 sobre onde mais vale publicar o MCP do Zihin e o SDK/integracoes
(`zihin-integrations`), alem dos canais ja acompanhados em `docs/distribuicao.md`.

**Atualizacao de 05/10/2026.** Parte dos quick wins ja foi enviada, com autorizacao do mantenedor:

| Canal | Situacao |
|---|---|
| Raycast MCP Registry | raycast/extensions#31926 mergeado e publicado na loja |
| punkpeye/awesome-mcp-servers | PR #15738 aberto |
| TensorBlock/awesome-mcp-servers | PR #3122 aberto |
| mcp.directory | Formulario enviado em 04/10 |
| mcp.so | Issue chatmcp/mcpso#4739 (o formulario do site so aceita submissao paga) |
| PyPI | `zihin` 0.1.0 publicado; repo publico `zihin-ai/zihin-python` |
| OAuth no `/mcp` | Plano registrado em zihin-ai/zihin-auth#5 |

Seguem sem envio: mcpservers.org e MCP Market (pedem e-mail de contato no formulario), LobeHub
(login humano na CLI), Zapier (conta dona) e todos os canais das secoes 2 em diante. O estado
corrente de cada canal fica em `docs/distribuicao.md`; este documento guarda a pesquisa e os
textos de submissao.

Fonte: tres agentes de pesquisa (diretorios de MCP, marketplaces dos clientes de IA, canais de
SDK). Os pontos marcados "conferido" foram reverificados depois; o restante e o que os agentes
relataram ter lido nas paginas oficiais, e os numeros de alcance sao os que cada site declara.

## Resumo para decisao

| Frente | Quick wins | O que trava o resto |
|---|---|---|
| MCP — listas e diretorios | awesome-mcp-servers (punkpeye), TensorBlock, mcp.so, mcpservers.org, mcp.directory, MCP Market, Raycast | Nada de produto; so submeter |
| MCP — clientes de IA | Raycast, Kilo (aceitacao incerta), Cline (falta logo) | **OAuth**: ChatGPT/Codex, Microsoft 365 Copilot, Gemini Enterprise, Slack e GitLab nao aceitam API key |
| SDK e integracoes | Zapier (app pronto, nunca enviado), correcao das docs, metadados do npm | **Repo `zihin-integrations` privado**; sem OpenAPI; sem SDK Python |

Tres itens pedem decisao de produto, nao de distribuicao:

1. **OAuth no `/mcp`.** E o maior desbloqueio de alcance: sem ele ficam fora os cinco hosts acima.
2. **Tornar publico o `zihin-integrations`** (ou espelhar os pacotes num repo publico). Enquanto
   for privado, o npm nao gera provenance, o n8n nao verifica o node e o awesome-paperclip nao
   aceita. Conferido: o repo e privado. Antes de abrir, auditar o historico do git atras de
   segredos.
3. **Descricoes em ingles** (zihin-agent-builder#702). Nenhum canal exige por escrito, mas
   revisores testam as tools pela descricao e o selo do Glama exibido nas listas e uma nota de
   qualidade das definicoes.

## 1. MCP — quick wins com a entrada pronta

Ordem sugerida: do maior alcance com menor esforco para o menor.

### 1.1 punkpeye/awesome-mcp-servers

- **O que e**: a maior lista (95,8 mil stars), sincronizada com o Glama. Conferido: sem "zihin" no
  README.
- **Como**: PR com uma linha no `README.md`, categoria "Conversational AI". PRs recentes foram
  mergeados em cerca de 12 horas, mas ha quase 3 mil abertos.
- **Entrada**:

  ```markdown
  - [zihin-ai/zihin-mcp](https://github.com/zihin-ai/zihin-mcp) [![zihin-mcp MCP server](https://glama.ai/mcp/servers/zihin-ai/zihin-mcp/badges/score.svg)](https://glama.ai/mcp/servers/zihin-ai/zihin-mcp) 🎖️ 📇 ☁️ - Build and operate AI agents on the Zihin.ai platform: manage agents, schemas, triggers, budgets and approvals, run diagnostics and chat with your agents.
  ```

  Os emojis sao a legenda da propria lista (oficial, TypeScript/JavaScript, servico em nuvem).

### 1.2 TensorBlock/awesome-mcp-servers

- **O que e**: lista ativa (876 stars, mais de 8 mil entradas), com merges no mesmo dia.
- **Como**: PR com uma linha em `docs/ai--llm-integration.md`, ou o formulario de issue
  `add-mcp-server.yml` do repo.
- **Entrada**:

  ```markdown
  - [zihin-ai/zihin-mcp](https://github.com/zihin-ai/zihin-mcp): Build and operate AI agents on the Zihin.ai platform with 88 tools for agents, schemas, triggers, budgets, approvals and diagnostics, plus chat with your agents. Stdio via `npx -y @zihin/mcp-server`; requires `ZIHIN_API_KEY`. Remote endpoint: https://llm.zihin.ai/mcp (`X-Api-Key` header). MIT.
  ```

### 1.3 Formularios web (um por site)

Dados comuns para todos:

| Campo | Valor |
|---|---|
| Name | Zihin |
| Repository | https://github.com/zihin-ai/zihin-mcp |
| npm package | @zihin/mcp-server |
| Docs | https://docs.zihin.ai/integrations/mcp-server |
| Official MCP Registry name | ai.zihin/mcp-server |
| Remote URL | https://llm.zihin.ai/mcp |
| Short description | Build and operate AI agents on the Zihin.ai platform: manage agents, triggers, budgets and approvals, run diagnostics and chat with your agents. |
| Authentication | API key in the `X-Api-Key` header (remote) or the `ZIHIN_API_KEY` environment variable (stdio) |

| Site | Formulario | Gratis | Pago (opcional) |
|---|---|---|---|
| mcp.so | https://mcp.so/submit | Sim, prazo nao informado | US$ 39, publicacao imediata |
| mcpservers.org (lista do wong2) | https://mcpservers.org/submit | Revisao em ate 2 semanas | US$ 39, revisao em 24 h |
| mcp.directory | https://mcp.directory/submit | Revisao "em 24 horas" | — |
| MCP Market | https://mcpmarket.com/submit | Fila de 4 a 6 semanas | US$ 29, listagem em 24 h |

Recomendacao: usar so as filas gratuitas. Nao ha evidencia de que o selo pago traga retorno.

### 1.4 Raycast — MCP Registry

- **O que e**: extensao da loja do Raycast com um registro de servers MCP. PRs recentes foram
  mergeados em 0,5 a 3 horas. Conferido: sem "zihin" no arquivo de entradas.
- **Como**: PR em `raycast/extensions`, acrescentando um objeto a `OFFICIAL_ENTRIES` em
  `extensions/model-context-protocol-registry/src/registries/builtin/entries.ts`. Titulo no padrao
  `[Model Context Protocol Registry] Add Zihin MCP server`.
- **Conferir antes**: o checklist geral de PR do Raycast (changelog, tabela do README) nao foi
  lido; olhar o que um PR mergeado recente tocou. O `icon` abaixo e a URL do avatar da org.
- **Entrada**:

  ```ts
  {
    name: "zihin",
    title: "Zihin",
    description:
      "Build and operate AI agents on the Zihin platform: create agents and personas, attach API and MCP tools, configure webhook, schedule and email triggers, set budgets and human-approval policies, and inspect runs. Local stdio proxy to the hosted server at https://llm.zihin.ai/mcp; authenticated with a Zihin API key.",
    icon: "https://github.com/zihin-ai.png",
    homepage: "https://docs.zihin.ai/integrations/mcp-server",
    configuration: {
      command: "npx",
      args: ["-y", "@zihin/mcp-server"],
      env: {
        ZIHIN_API_KEY: "YOUR_ZIHIN_API_KEY",
      },
    },
  },
  ```

### 1.5 LobeHub — corrigir a listagem que ja existe

- **Situacao**: o Zihin ja esta em https://lobehub.com/mcp/zihin-ai-zihin-mcp (conferido: a pagina
  responde), ingerido automaticamente. Segundo a pesquisa, mostra versao 1.0.0 e zero tools.
- **Como**: `npx -y @lobehub/market-cli`, depois `lhm login`, `lhm github connect`,
  `lhm plugin init --stdio "npx -y @zihin/mcp-server"` e `lhm plugin update --dir <pasta>`. Exige
  Node 22 ou superior e login humano; nao da para automatizar.

## 2. MCP — vale tentar, com ressalvas

| Canal | Como | Ressalva |
|---|---|---|
| punkpeye/awesome-remote-mcp-servers | PR de tres linhas; a conta que envia precisa ter dado star no repo | O CI exige que o endpoint responda ao `initialize`. Conferido: o nosso devolve 401 sem key. Ha 17 entradas com API key na lista, mas nao se sabe como o CI trata o 401 |
| Kilo Marketplace | PR criando `mcps/zihin/MCP.yaml` em `Kilo-Org/kilo-marketplace` | Dos 12 PRs externos recentes de MCP, 9 foram fechados sem merge. Ler `REVIEW.md` e `AGENTS.md` do repo antes |
| Cline MCP Marketplace | Issue pelo template "MCP Server Submission" | Exige logo PNG 400x400 (nao temos) e que o Cline consiga instalar pelo README; a fila tem cerca de 2.450 issues abertas. O `llms-install.md` deste PR atende a parte da instalacao |
| mcpm.sh | Issue `Add server: zihin-mcp` | Ultimo merge de server em maio de 2026 |
| Devin Marketplace (cobre Windsurf) | PR em `CognitionAI/devin-marketplace`, com CLA | Os 11 PRs externos vistos seguem abertos |
| Goose | PR em `documentation/static/servers.json` | **Relatos conflitantes**: um agente viu PRs mergeados em 7 dias; outro leu que o diretorio foi fechado em 30/07/2026 em favor do registry oficial. Conferir antes de gastar tempo |
| Kiro Powers | Formulario em kiro.dev/powers/submit | Pede `plugin.json` no formato Agent Plugins na raiz, link de politica de privacidade e contato de suporte no README |

Entrada para o awesome-remote-mcp-servers (categoria "Workplace & Productivity"; descricao de ate
120 caracteres):

```markdown
- [Zihin](https://docs.zihin.ai/integrations/mcp-server) `https://llm.zihin.ai/mcp`
  [![Zihin MCP connector](https://glama.ai/mcp/connectors/ai.zihin/mcp-server/badges/score.svg)](https://glama.ai/mcp/connectors/ai.zihin/mcp-server)
  🔑 - Build and operate AI agents on Zihin.ai: agents, triggers, budgets, approvals and diagnostics, plus chat with them.
```

Arquivo para o Kilo (`mcps/zihin/MCP.yaml`):

```yaml
id: zihin
name: Zihin
description: Build and operate AI agents on the Zihin platform - create agents and personas, attach API and MCP
  tools, configure webhook/schedule/email triggers, set budgets and human-approval policies, and inspect runs.
author: Zihin
url: https://github.com/zihin-ai/zihin-mcp
category: development
prerequisites:
  - Zihin account and API key (zhn_live_..., zhn_test_... or zhn_dev_...)
content:
  - name: NPX
    prerequisites:
      - Node.js 20+
    content: |
      {
        "command": "npx",
        "args": ["-y", "@zihin/mcp-server"],
        "env": {
          "ZIHIN_API_KEY": "{{ZIHIN_API_KEY}}"
        }
      }
  - name: Remote Server
    content: |
      {
        "type": "streamable-http",
        "url": "https://llm.zihin.ai/mcp",
        "headers": {
          "X-Api-Key": "{{ZIHIN_API_KEY}}"
        }
      }
parameters:
  - name: Zihin API Key
    key: ZIHIN_API_KEY
    placeholder: zhn_live_xxxxxxxxxxxxxxxx
```

## 3. MCP — ja cobertos sem acao, ou sem caminho

- **Cobertos pelo registry oficial**: Zed (esta descontinuando extensoes de MCP em favor do
  registry), JetBrains (o plugin de terceiros le o registry oficial, o do GitHub e o da Docker),
  registries de time do Windsurf.
- **cursor.store**: ja lista "zihin-mcp by zihin-ai", por ingestao automatica.
- **Sem submissao hoje**: PulseMCP (submissoes pausadas desde 03/09/2026), modelcontextprotocol/servers
  (aponta para o registry), wong2/awesome-mcp-servers (nao aceita PR; usar mcpservers.org),
  appcypher e mcp-get (arquivados), Continue hub (fora do ar), Roo Code (arquivado).
- **Listas curadas pelo fornecedor, sem via publica**: Replit, Notion, Lovable, v0, Mistral,
  Perplexity, Portkey, Klavis. Em Replit, Notion, Lovable e LM Studio o usuario ja consegue
  adicionar o Zihin como conector customizado com header.

## 4. MCP — o que exige trabalho de produto

| Host | Bloqueio |
|---|---|
| OpenAI (diretorio de plugins do ChatGPT e do Codex) | OAuth obrigatorio; anotacoes em todas as tools; desafio de dominio; quatro URLs de politica; casos de teste e video |
| Microsoft 365 Copilot | API key "Not supported" para plugins MCP |
| Copilot Studio / Power Platform | Aceita API key, mas pede verificacao no Partner Center e pacote OpenAPI |
| Gemini Enterprise, Slack Marketplace, GitLab AI Catalog | So OAuth ou sem autenticacao |
| AWS Marketplace | Cadastro de vendedor; o gateway pede OAuth client-credentials |

Lacunas que se repetem e valem um item de backlog cada:

1. OAuth 2.1 no endpoint remoto.
2. Texto em ingles (tools, `instructions`, descricao do plugin, README).
3. URLs publicas de politica de privacidade, termos e suporte. Nao existem no repo nem no
   `server.json`.
4. Logos: PNG 400x400 (Cline), SVG (Devin), icone quadrado (OpenAI).
5. Manifest portavel no formato Agent Plugins (`plugin.json` na raiz), consumido por Kiro e pelo
   diretorio da OpenAI.

## 5. SDK e integracoes (`zihin-integrations`)

Inventario (conferido no npm em 04/10/2026):

| Pacote | Versao | Onde esta listado hoje |
|---|---|---|
| `@zihin/agent-client` | 0.6.1 | So npm. Descricao em portugues |
| `n8n-nodes-zihin` | 0.10.1 | Community node nao verificado |
| `@zihin/piece-zihin` | 0.4.1 | Community piece no npm; fora do catalogo oficial do Activepieces |
| `zihin-paperclip-adapter` | 0.5.0 | npm; fora do awesome-paperclip |
| `zapier-app-zihin` | 0.1.1 (privado) | **Nunca enviado.** Conferido: zapier.com/apps/zihin devolve 404 |

### Quick wins

1. **Zapier.** O app ja esta construido. Falta `zapier login`, `zapier register "Zihin"`,
   `zapier push` e "Submit for Review" no painel; a revisao leva ate uma semana e o app entra em
   beta por 90 dias. Requisitos que pedem atencao:
   - um admin da integracao com e-mail no dominio do produto (@zihin.ai);
   - uma conta de teste no Zihin para `integration-testing@zapier.com`, com um agente funcionando;
   - texto em ingles; descricao comecando por "Zihin is…".

   Textos propostos:
   - Descricao: "Zihin is an AI agent platform that lets you build, govern and run hosted agents
     with tools, memory and human approvals."
   - Acao: "Invoke Agent — Sends a message to a hosted Zihin agent and returns its answer."
2. **Docs publicas.** `docs.zihin.ai/integrations/overview` anuncia versoes antigas e "marketplace
   listing in progress" para o Activepieces, que hoje nao tem caminho. Correcao preparada em PR
   separado no zihin-docs.
3. **Metadados do npm** (entram na proxima release de cada pacote):
   - `@zihin/agent-client`, descricao: "Official Node.js client for invoking Zihin.ai hosted AI
     agents — buffered and streaming (SSE) calls, async triggers with callbacks, sessions and
     retries."
   - `n8n-nodes-zihin`, descricao: "n8n community node for Zihin.ai — invoke hosted AI agents
     (tools, memory, governance) from your workflows."
4. **Listas "awesome" de agentes e SDKs** (`e2b-dev/awesome-ai-agents`, `e2b-dev/awesome-ai-sdks`,
   `kyrolabs/awesome-agents`). As regras de contribuicao nao foram lidas; conferir o formato antes.
   Texto: "Zihin — hosted AI agent platform with governance (RBAC, budgets, human approvals),
   multi-provider routing, triggers (webhook/schedule/email) and SDKs for Node.js, n8n,
   Activepieces and MCP."
5. **Colecao publica no Postman** com as quatro chamadas principais (listar agentes, stream,
   disparar trigger, consultar execucao).

### Bloqueados ate uma decisao

| Canal | Bloqueio |
|---|---|
| n8n verified community node | Exige repo publico e provenance do npm (obrigatoria desde 01/05/2026). Alem disso o pacote ainda leva o "Zihin Chat Model" e palavras-chave de outros provedores, o que pode ser lido como camada de proxy, vetada pelas regras |
| awesome-paperclip | Exige repo publico. A linha esta pronta: `- [zihin-paperclip-adapter](https://github.com/zihin-ai/zihin-integrations/tree/main/packages/paperclip-adapter-zihin) - External adapter that runs hosted Zihin.ai agents as Paperclip employees, streaming output to the run log.` |
| Activepieces (catalogo oficial) | O repo deles pausou PRs externos; um PR frio e fechado automaticamente. So via contato direto |
| Make | Os modulos precisam de resposta JSON, nao SSE; falta confirmar com o backend se `/api/v1/tasks` atende |
| LangChain, LlamaIndex, CrewAI, Dify, Langflow | Todos pedem um SDK Python, que nao existe |
| APIs.guru, GPT Actions | Pedem um OpenAPI, que nao existe |

### Risco a tratar

Resolvido em 05/10/2026: o nome `zihin` foi registrado no PyPI com a publicacao da 0.1.0, um
cliente minimo (`list_agents`, `invoke_agent`, `stream_agent`). Com um pacote Python no ar, os
canais que dependiam dele (LangChain, Dify, CrewAI) deixam de estar bloqueados por falta de SDK,
embora cada um ainda peca um pacote de integracao proprio.

## 6. O que falta

1. Formularios de mcpservers.org e MCP Market, com um e-mail de contato.
2. LobeHub: rodar a CLI para corrigir a listagem.
3. Zapier: `zapier push` e submissao, com a conta dona.
4. Acompanhar os PRs abertos (punkpeye, TensorBlock, Docker) e a issue do mcp.so.
5. Decidir: tornar publico o `zihin-integrations`; iniciar o OAuth no `/mcp` (zihin-auth#5).
