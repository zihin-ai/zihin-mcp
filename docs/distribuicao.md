# Distribuicao — onde o Zihin MCP esta publicado

Mapa unico dos canais de distribuicao do `@zihin/mcp-server`: onde estamos, como cada canal recebe
uma atualizacao e como confirmar que ela chegou. Conferir este documento faz parte de toda release
(ver "Checklist por release" no fim).

**Ultima verificacao geral: 05/10/2026, release 2.2.2.**

## Criterio de "concluido"

Um canal so e marcado como concluido quando as tres coisas valem ao mesmo tempo:

1. a pagina do canal esta acessivel;
2. as informacoes exibidas estao corretas (versao, contagem de tools, descricao);
3. a instalacao a partir daquele canal funciona.

Os estados usados abaixo distinguem o que ja foi feito do que foi comprovado:

| Estado | Significado |
|---|---|
| **Confirmado** | Os tres criterios foram verificados na data indicada |
| **Publicado, desatualizado** | O canal esta no ar, mas exibe dados de uma versao anterior |
| **Submetido** | Enviamos, sem comprovacao de que foi aceito ou esta visivel |
| **Preparado** | O repo tem o que o canal exige, mas nada foi enviado |
| **Ausente** | Verificado e nao estamos la |
| **Nao verificado** | Nao foi possivel conferir nesta rodada (motivo anotado) |

## Fonte da verdade do contrato

O numero de tools, resources e prompts vem do server, nao do pacote:
`https://llm.zihin.ai/.well-known/mcp/server-card.json` (em 04/10/2026: 88 tools, 19 resources,
3 prompts, superficie de owner). Toda vitrine que exibe contagem deve bater com esse arquivo.

## Canais

Responsavel por todos os canais, salvo indicacao: `@oliveiraronan`.

| Canal | URL / identificador | Estado em 04/10/2026 | Versao exibida | Como recebe atualizacao |
|---|---|---|---|---|
| npm | `@zihin/mcp-server` | Confirmado | 2.2.2 (`latest` e `next`) | `npm publish --tag next` manual + `npm dist-tag add ... latest` |
| MCP Registry oficial | `ai.zihin/mcp-server` em registry.modelcontextprotocol.io | Confirmado | 2.2.2, `active`, `isLatest` | `scripts/registry-publish.sh` apos o `latest` no npm |
| GitHub Releases | github.com/zihin-ai/zihin-mcp/releases | Confirmado | v2.2.2 (Latest) | `gh release create` manual por tag |
| Marketplace proprio do Claude Code | `zihin-ai/zihin-mcp` -> `zihin@zihin` | Confirmado | 2.2.2 | Merge no `main` com `version` do `plugin.json` incrementada |
| Diretorio da Anthropic | claude.ai/directory | Submetido (v2.2.2 em revisao por um revisor da Anthropic) | — | Portal: acompanha o `main`; webhook de push configurado, checagem agendada a cada ~6h |
| Smithery | smithery.ai/servers/zihin/mcp | Publicado, desatualizado | 96 tools, inclui as 9 de conexao removidas; "last deployed 1 month ago" | Painel do Smithery (novo scan + edicao da descricao) |
| Glama | glama.ai/mcp/servers/zihin-ai/zihin-mcp | Publicado, parcialmente atualizado | README de 04/10 (88 tools) e release 2.2.2; a lista "Available Tools" ainda mostrava 96 logo apos o release | Sync do repo no painel; Auto-Release constroi a cada GitHub Release |
| GitHub MCP Registry | github.com/mcp | Ausente | — | Curadoria do GitHub; nao e espelho do registry oficial |
| Galeria MCP do VS Code | busca `@mcp` no painel Extensions | Ausente (por inferencia) | — | Depende do catalogo do GitHub |
| cursor.directory | cursor.directory/plugins/zihin | Publicado (instalacao a partir da listagem nao testada) | `npx -y @zihin/mcp-server`, sem versao | A listagem le o `mcp.json` da raiz do repo |
| Extensao Gemini CLI | github.com/zihin-ai/gemini-cli-zihin | Publicado (instalacao nao testada: sem Gemini CLI na maquina) | v0.1.1 | Release do GitHub no repo da extensao |
| Galeria de extensoes Gemini | geminicli.com/extensions | Ausente | — | Crawler diario de repos com o topic `gemini-cli-extension` |
| Docker MCP Catalog | hub.docker.com/mcp | Submetido (docker/mcp-registry#5438, aguardando revisao) | — | PR em docker/mcp-registry; a Docker constroi a imagem a partir do commit fixado |
| Docker Hub / GHCR (imagem propria) | — | Ausente | — | Nao ha publicacao de imagem no CI |
| Documentacao publica | docs.zihin.ai/integrations/mcp-server | Confirmado | 88 tools | PR em zihin-ai/zihin-docs + deploy manual com build local |
| Raycast MCP Registry | extensao "Model Context Protocol Registry" da loja do Raycast | Publicado (PR mergeado em 05/10; instalacao pelo Raycast nao testada) | `npx -y @zihin/mcp-server`, sem versao | PR em `raycast/extensions` |
| awesome-mcp-servers (punkpeye) | github.com/punkpeye/awesome-mcp-servers | Submetido (PR #15738 aberto) | — | PR de uma linha no README |
| awesome-mcp-servers (TensorBlock) | github.com/TensorBlock/awesome-mcp-servers | Submetido (PR #3122 aberto) | — | PR de uma linha em `docs/ai--llm-integration.md` |
| mcp.directory | mcp.directory | Submetido (formulario em 04/10; revisao prometida em 24 h) | — | Formulario; o site le os metadados do GitHub |
| mcp.so | mcp.so | Submetido (issue chatmcp/mcpso#4739) | — | Issue; o formulario do site so aceita submissao paga |
| PyPI (cliente Python) | pypi.org/project/zihin | Confirmado | 0.1.0 | GitHub Release em `zihin-ai/zihin-python` dispara o `publish.yml` (Trusted Publishing) |

## Evidencia e pendencia por canal

### npm

- **Evidencia**: `npm view @zihin/mcp-server dist-tags` -> `latest: 2.2.2`, `next: 2.2.2`. Instalacao
  limpa: `npx -y @zihin/mcp-server@2.2.2 install-skills --client all --bundled` instalou as 6 skills
  nos quatro formatos, sem nenhuma ocorrencia de `db_config` ou `list_connections`.
- **Pendencia**: nenhuma para a 2.2.2.

### MCP Registry oficial

- **Evidencia**: `GET /v0/servers?search=ai.zihin` devolve a 2.2.2 com `status: active`,
  `isLatest: true`, `publishedAt: 2026-10-04T22:39Z`; a 2.2.1 passou a `isLatest: false`.
- **Verificacao**: `node scripts/registry-verify.mjs ai.zihin/mcp-server X.Y.Z`.
- **Pendencia**: nenhuma. Procedimento em `docs/registry-mcp-oficial.md`.

### GitHub Releases

- **Evidencia**: Release `v2.2.2` criada em 04/10/2026 a partir da tag existente (`d04aab2`) e
  marcada como Latest, com as notas do CHANGELOG e as instrucoes de atualizacao.
- **Pendencia**: nenhuma para a 2.2.2. As tags v2.0.1, v2.1.0 e v2.2.0 seguem sem Release.

### Marketplace proprio do Claude Code

- **Evidencia** (Claude Code 2.1.289): `claude plugin validate --strict ./plugin` e
  `claude plugin validate .` passam. Instalacao limpa numa config isolada
  (`claude plugin marketplace add zihin-ai/zihin-mcp` + `claude plugin install zihin@zihin`)
  instalou a 2.2.2 com as 6 skills. Atualizacao de uma instalacao existente:
  `claude plugin update zihin@zihin` levou de 2.2.1 para 2.2.2.
- **Como o usuario recebe**: auto-update vem desligado para marketplaces de terceiros. Quem ja
  instalou precisa rodar `claude plugin update zihin@zihin` e reiniciar o Claude Code. Se a
  `version` do `plugin.json` nao mudar, o comando responde "already at the latest version" e o
  usuario fica com a copia antiga.
- **Pendencia**: nenhuma. O comando de atualizacao esta nas notas da Release 2.2.2 e na pagina
  do MCP Server das docs publicas.

### Diretorio da Anthropic

O processo atual tem dois destinos diferentes, e uma submissao nao cobre o outro:

- **Diretorio** (claude.ai/directory): submissao pelo portal claude.ai/directory/manage, a partir
  de uma conta paga. Alcanca claude.ai, Cowork e Claude Code.
- **Marketplace `claude-plugins-official`**: nao aceita submissao pelo portal; depende de contato
  de parceria com a Anthropic. O PR #21 falava em "submissao ao `claude-plugins-official`", o que
  nao corresponde ao processo vigente.

- **Evidencia** (portal conferido em 04/10/2026): existem DUAS submissoes do mesmo repositorio.
  - **Pasta `plugin`** (a correta, criada em 25/09): a v2.2.1 estava bloqueada por "Unpinned npx
    launcher". Depois do pin (PR #32), "Check for new commits" trouxe a v2.2.2 (`d9b3ce1`): scan
    aprovado e versao retida pela politica do diretorio, aguardando revisor da Anthropic. Avisos
    restantes, nenhum bloqueante: sem `icon` no `plugin.json` e server MCP local (nao roda no
    claude.ai web). O resumo da submissao continua exibindo o bloqueio da v2.2.1 ate a v2.2.2 ser
    liberada.
  - **Raiz do repositorio** (criada em 01/09): era uma duplicata apontando para a raiz, que nao e
    o plugin. Retirada em 04/10/2026 por decisao do mantenedor.
  - **Estado em 05/10/2026**: a submissao saiu de "Needs changes" para "Em revisao". Verificacao
    de seguranca concluida; a v2.2.2 esta com um revisor ("Held for: Content policy review",
    motivo "Runs a pinned npx or uvx package"). Nada publicado ainda.
  - **Webhook de push** criado em 04/10 no repo (evento `push`, JSON); o ping inicial foi aceito.
    O portal ainda mostrava "no push to the tracked branch yet" em 05/10, porque o unico push
    posterior foi forcado; confirmar no proximo push normal.
- **Situacao frente ao validador do portal** (checklist de pre-submissao da Anthropic), depois do
  PR #32:

  | Regra | Situacao do `plugin/` | Resultado esperado |
  |---|---|---|
  | README de pelo menos 40 palavras na pasta do plugin | `plugin/README.md` | Ok |
  | Pacote de launcher com versao exata | `npx -y @zihin/mcp-server@X.Y.Z` em `plugin/.mcp.json` | Ok |
  | `license` no `plugin.json` ou `LICENSE` na pasta | `license: MIT` | Ok |
  | `description`, `author`, `version` | Presentes | Ok |
  | Pacote de registry, mesmo com versao exata | `npx` de pacote npm | Retido para revisor (sempre) |
  | Credencial pedida via `userConfig`, nao lida do ambiente | `.mcp.json` le `${ZIHIN_API_KEY}` do ambiente | Retido para revisor |

  "Retido para revisor" nao e rejeicao: a versao so vai ao ar depois que uma pessoa da Anthropic
  a libera.
- **Custo do pin**: o plugin so recebe proxy novo quando o plugin e atualizado. O pin entra na
  lista de bumps de toda release; `scripts/registry-publish.sh` e `test/plugin-manifest.test.js`
  falham se ele ficar para tras.
- **Decisao em aberto**: trocar `${ZIHIN_API_KEY}` do ambiente por `userConfig` com
  `sensitive: true`. Tira a retencao por credencial, mas quem ja usa o plugin com a variavel
  exportada passa a ser perguntado pela key.
- **Proximos passos no portal**
  (https://claude.ai/directory/manage/plugins/e7b8ae79-0d0d-43b5-8dbb-5081d2349969):
  1. Aguardar a decisao do revisor sobre a v2.2.2; quando passar, **Publish** nessa pagina.
  2. Se nada mudar em um ou dois dias uteis, escrever para directory@anthropic.com citando a
     v2.2.2.
  3. Opcional: acrescentar `icon` (SVG ou PNG 512x512 dentro de `plugin/`) ao `plugin.json`.
- **Segunda submissao recomendada**: o endpoint remoto `https://llm.zihin.ai/mcp` como
  **MCP connector**. A Anthropic recomenda as duas para quem opera o proprio server remoto. Os
  requisitos de autenticacao do connector nao foram conferidos nesta rodada.

### Smithery

- **Evidencia**: `GET https://registry.smithery.ai/servers/zihin/mcp` responde. O cadastro e do
  endpoint remoto, servido pelo gateway deles (`https://mcp--zihin.run.tools`). O scan guardado
  lista **96 tools**, incluindo as 9 de conexao removidas do server em 03/10/2026
  (`list_connections` etc.), o resource `zihin://schemas/db_config` e a descricao com "96 tools".
- **Como recebe atualizacao**: o cadastro nao acompanha o npm nem o registry oficial. As tools
  exibidas sao um scan guardado; a descricao e texto editado no painel.
- **Tentativa em 04/10/2026**: a conta logada (workspace "Personal" do mantenedor) abre as abas
  de dono (Releases, Settings), mas salvar a descricao devolve "You do not have permission to
  perform this action". O cadastro `zihin/mcp` pertence a outra conta ou time do Smithery.
- **Achados no fluxo de Publish**:
  - A aba Releases diz "No releases yet". O dialogo de publicacao ja vem com
    `https://llm.zihin.ai/mcp`.
  - O padrao do dialogo manda a key como **query string** (`?apiKey=`), que o `/mcp` nao le. O
    correto e parametro `apiKey` em **header**, com "Output as header" = `X-Api-Key`.
  - O ultimo passo pede uma API key real para o scan; precisa ser colada pelo mantenedor.
- **Pendencia**: entrar com a conta dona do cadastro, publicar com o header `X-Api-Key`, colar a
  key no passo de scan e trocar "96 tools" por "88 tools" na descricao (Settings -> General).

### Glama

- **Evidencia** (painel Admin, 04/10/2026): "Sync Server" trouxe o commit atual do `main` e a
  pagina publica passou a exibir o README novo (88 tools / 19 resources). Com o Auto-Release
  ligado, o Glama construiu e publicou a release **2.2.2** a partir da GitHub Release (teste de
  build aprovado). Logo depois do release a secao "Available Tools" da pagina publica ainda
  listava 96 tools, com as de conexao.
- **Como recebe atualizacao**: Auto-Release a cada GitHub Release; o commit conhecido so avanca
  com "Sync Server" (ou o link "sync" ao lado de "Current head commit" na aba Dockerfile).
- **Atencao**: o campo "Placeholder parameters" da aba Dockerfile guarda uma `ZIHIN_API_KEY` com
  formato de key real (`zhn_live_...`), usada para subir o server nos checks. Ela nao aparece na
  pagina publica, mas fica armazenada num servico de terceiros: usar uma key dedicada, de menor
  privilegio, e rotacionar a atual.
- **Pendencia**: reconferir a contagem de "Available Tools" na pagina publica; trocar a key do
  painel por uma dedicada.

### GitHub MCP Registry e galeria do VS Code

- **Evidencia**: `https://github.com/mcp/ai.zihin/mcp-server` responde 404 (o mesmo padrao de URL
  responde 200 para `com.stripe/mcp`). A API do catalogo,
  `https://api.mcp.github.com/v0.1/servers?search=zihin`, devolve zero resultados; a mesma busca
  por `stripe` devolve um. Sao 33 dias desde a primeira publicacao no registry oficial.
- **Causa**: o GitHub descreve o catalogo como "a curated list of MCP servers from partners and the
  community". Publicar no registry oficial nao garante entrada. A documentacao publica do GitHub
  nao descreve processo de submissao.
- **VS Code**: a busca `@mcp` nao foi testada dentro do VS Code nesta rodada. A ausencia e
  inferida do catalogo do GitHub, que e a fonte da galeria.
- **O que funciona hoje no VS Code**: o botao de instalacao do README e a configuracao manual em
  `.vscode/mcp.json`. Nenhum dos dois depende da galeria.
- **Pendencia**: issue #27. Caminho conhecido: indicar o server a partnerships@github.com.
  Depois de listado, buscar `@mcp zihin` no VS Code, instalar por la e registrar o resultado.

### cursor.directory

- **Evidencia** (04/10/2026): a busca por "zihin" devolve a listagem **Zihin**
  (cursor.directory/plugins/zihin, "zihin-mcp plugin for Cursor"), com o botao "Add to Cursor" e a
  config lida do `mcp.json` da raiz: `npx -y @zihin/mcp-server` com `ZIHIN_API_KEY` do ambiente.
  Ou seja, o reenvio depois do PR #25 foi feito e aceito.
- **Pendencia**: clicar em "Add to Cursor" numa maquina com o Cursor e confirmar que o server sobe.

### Extensao e galeria do Gemini CLI

- **Evidencia**: repo publico, topic `gemini-cli-extension` presente, `gemini-extension.json` na
  raiz, release v0.1.0. O manifest e o README ainda dizem 96 tools (issue
  zihin-ai/gemini-cli-zihin#1). A pagina geminicli.com/extensions foi baixada e nao contem
  nenhuma ocorrencia de "zihin", embora os tres requisitos de indexacao estejam atendidos.
- **Como recebe atualizacao**: o CLI compara a tag da ultima release do GitHub. A `version` do
  manifest precisa bater com a tag. O usuario roda `gemini extensions update zihin` e reinicia a
  sessao.
- **Feito em 04/10/2026**: zihin-ai/gemini-cli-zihin#2 mergeado (README com 88 tools, descricao do
  manifest sem numero fixo, secao Update) e release `v0.1.1` publicada, com a `version` do manifest
  igual a tag.
- **Pendencia**: testar `gemini extensions install` e `gemini extensions update zihin` numa
  maquina com o Gemini CLI. A ausencia na galeria segue sem causa identificada; reconferir alguns
  dias depois da v0.1.1.

### Docker MCP Catalog

- **Evidencia**: o Dockerfile esta na raiz (PR #24). Nao existe nenhuma entrada "zihin" em
  docker/mcp-registry e nenhuma imagem publicada: o CI nao tem job de build/push. Ter o Dockerfile
  nao disponibiliza imagem a ninguem.
- **Regras atuais do catalogo** (CONTRIBUTING de docker/mcp-registry):
  - Tres caminhos: imagem **construida pela Docker** (recomendado; exige repo GitHub com Dockerfile
    na raiz; a Docker assina, gera SBOM e hospeda em `mcp/<nome>`), **imagem propria** ja publicada,
    ou **server remoto** (streamable-http, sem Dockerfile).
  - Arquivos: `server.yaml` (`name`, `type`, `meta`, `about`, `source` com URL e commit) e
    `tools.json`. Segredos em `config.secrets` (`name`, `env`, `example`).
  - Licenca MIT ou Apache 2.0 (a nossa e MIT). Todo PR e revisado pela equipe da Docker;
    credenciais de teste sao enviadas por um formulario deles. Disponivel em ate 24h apos o merge.
- **Caminho decidido em 04/10/2026**: imagem construida pela Docker, que reaproveita o Dockerfile
  existente e nao cria um pipeline de imagem para manter.
- **Rascunho do `server.yaml`** para esse caminho (gerar o definitivo com `task create` no fork,
  que tambem monta o `tools.json`):

  ```yaml
  name: zihin
  image: mcp/zihin
  type: server
  meta:
    category: ai
    tags:
      - zihin
      - ai-agents
  about:
    title: Zihin
    description: Chat with your Zihin.ai agents, manage them and load platform skills.
    icon: https://avatars.githubusercontent.com/zihin-ai
  source:
    project: https://github.com/zihin-ai/zihin-mcp
    commit: d04aab2cbc54812d0dd3c5c3d2403f3ef5a7cabe   # tag v2.2.2
  config:
    secrets:
      - name: zihin.api_key
        env: ZIHIN_API_KEY
        example: zhn_live_xxx
  ```

- **Submetido em 04/10/2026**: docker/mcp-registry#5438, a partir do fork `zihin-ai/mcp-registry`
  (branch `add-zihin`), com `servers/zihin/server.yaml` (commit `d9b3ce1` fixado) e `tools.json`
  com as 88 tools da resposta real de `tools/list`. `task validate` passou e `task build --tools`
  construiu a imagem localmente.
- **Pendencia**: enviar uma key de teste pelo formulario da Docker (link no corpo do PR) e publicar
  um contato de seguranca no repo (item do checklist deles que ficou desmarcado). Depois do merge,
  cada release exige um PR de atualizacao do commit fixado.

### Documentacao publica

- **Evidencia**: zihin-ai/zihin-docs#26 mergeado e publicado em 04/10/2026. No ar: 88 tools na
  pagina do MCP Server e no `llms.txt`, secao Updating presente, e
  `/agents/triggers/database-event` redireciona (308) para `/agents/tools`.
- **Deploy**: `vercel --prod` sozinho FALHA (o build remoto nao tem `.git`, e o site usa a data do
  ultimo commit). O que funciona: `vercel build --prod` seguido de
  `vercel deploy --prebuilt --prod`, no checkout de zihin-docs.
- **Pendencia**: nenhuma.

### Canais novos (04 e 05/10/2026)

A pesquisa completa, com os canais ainda nao atacados e os bloqueios, esta em
`docs/novos-canais.md`.

- **Raycast**: raycast/extensions#31926 mergeado em 05/10/2026 e publicado na loja do Raycast.
  A entrada usa `npx -y @zihin/mcp-server` com `ZIHIN_API_KEY`. Falta instalar pelo Raycast e
  confirmar.
- **punkpeye/awesome-mcp-servers**: PR #15738 aberto. O bot do repo pede que o server tenha nota
  de qualidade no Glama, o que depende da release 2.2.2 ja feita la.
- **TensorBlock/awesome-mcp-servers**: PR #3122 aberto.
- **mcp.directory**: formulario enviado em 04/10; conferir se a listagem apareceu.
- **mcp.so**: issue chatmcp/mcpso#4739. A fila de issues e longa.
- **Nao enviados**: mcpservers.org e MCP Market pedem um e-mail de contato no formulario e ficaram
  com o mantenedor; LobeHub exige login humano na CLI; Zapier exige a conta dona.
- Forks criados na org para esses PRs: `zihin-ai/awesome-mcp-servers`,
  `zihin-ai/tensorblock-awesome-mcp-servers`, `zihin-ai/raycast-extensions` e
  `zihin-ai/mcp-registry` (Docker). Podem ser apagados depois que os PRs fecharem.

### PyPI — cliente Python `zihin`

- **Evidencia** (05/10/2026): `zihin` 0.1.0 publicado em pypi.org/project/zihin a partir do repo
  publico `zihin-ai/zihin-python`. Instalado do PyPI num ambiente limpo: `list_agents` e um
  `invoke_agent` real funcionaram contra producao. A continuidade de sessao nao foi testada contra
  producao.
- **Escopo**: `list_agents`, `invoke_agent`, `stream_agent` e `ZihinError`. Contexto estruturado,
  anexos, triggers e tasks existem so no `@zihin/agent-client`.
- **Como recebe atualizacao**: bump de versao em `pyproject.toml` e `src/zihin/__init__.py`,
  depois uma GitHub Release com a tag `vX.Y.Z`; o workflow confere tag contra versao e publica por
  Trusted Publishing, sem token.
- **Pendencia**: adicionar um segundo Owner ao projeto no PyPI.

### OAuth no `/mcp` e idioma das descricoes

Dois itens de produto que limitam a distribuicao e sao conduzidos fora deste repo:

- **OAuth**: plano registrado em zihin-ai/zihin-auth#5 (comentario de 04/10/2026). O repo lider e
  o `zihin-auth`; aqui so mudam `server.json`, README e um teste de regressao.
- **Descricoes em ingles**: zihin-ai/zihin-agent-builder#702.

## Como o usuario que ja instalou recebe uma atualizacao

Sao atualizacoes diferentes, e nenhuma puxa a outra:

| O que o usuario tem | Como atualiza | Como confirma |
|---|---|---|
| Proxy via `npx -y @zihin/mcp-server` (Claude Desktop, Cursor, VS Code, Windsurf, Codex) | Reiniciar o server MCP ou o client. Se o `npx` reaproveitar uma copia em cache, usar `@zihin/mcp-server@latest` nos `args` | Versao no banner de boot e em `serverInfo.version` (a partir da 2.2.2 e a versao real do pacote) |
| Plugin Claude Code | `claude plugin update zihin@zihin` + reiniciar | `claude plugin list` |
| Skills copiadas pelo `install-skills` | Rodar o mesmo comando de novo (sobrescreve) | Saida do comando (`fonte: server` ou `fonte: bundled`) |
| Extensao Gemini | `gemini extensions update zihin` + reiniciar a sessao | `gemini extensions list` |

Tools, resources e prompts vem do server a cada conexao: nao dependem da versao do proxy.

## Checklist por release

Depois do fluxo de publicacao (npm `next` -> validacao -> `latest` -> tag -> registry oficial):

1. `npm view @zihin/mcp-server dist-tags` e `node scripts/registry-verify.mjs ai.zihin/mcp-server X.Y.Z`.
2. Criar a GitHub Release da tag `vX.Y.Z` com as notas do CHANGELOG.
3. Plugin Claude: pin de `plugin/.mcp.json` na versao nova (o `npm test` falha se ficar para
   tras); `claude plugin validate --strict ./plugin`; instalar numa config isolada
   (`CLAUDE_CONFIG_DIR=<pasta temporaria>`) e conferir a versao com `claude plugin list`.
4. Se a contagem de tools/resources mudou no `server-card.json`: corrigir README, `plugin.json`,
   `marketplace.json`, a extensao Gemini, a descricao no Smithery e as docs publicas.
5. Smithery: novo scan. Glama: sync + Deploy + Make Release.
6. Extensao Gemini: se mudou, release nova com tag igual a `version` do manifest.
7. Docs publicas: PR em zihin-docs e deploy (`vercel build --prod` + `vercel deploy --prebuilt --prod`).
8. Docker MCP Catalog (depois de aceito): PR em docker/mcp-registry atualizando o commit fixado.
9. Atualizar a tabela "Canais" e a data de verificacao neste documento.
