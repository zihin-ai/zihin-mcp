# Distribuicao — onde o Zihin MCP esta publicado

Mapa unico dos canais de distribuicao do `@zihin/mcp-server`: onde estamos, como cada canal recebe
uma atualizacao e como confirmar que ela chegou. Conferir este documento faz parte de toda release
(ver "Checklist por release" no fim).

**Ultima verificacao geral: 04/10/2026, release 2.2.2.**

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
| Diretorio da Anthropic | claude.ai/directory | Submetido (v2.2.2 passou no scan e esta retida para revisor) | — | Portal: o diretorio acompanha o `main` e revalida cada commit (checagem a cada ~6h) |
| Smithery | smithery.ai/servers/zihin/mcp | Publicado, desatualizado | 96 tools, inclui as 9 de conexao removidas; "last deployed 1 month ago" | Painel do Smithery (novo scan + edicao da descricao) |
| Glama | glama.ai/mcp/servers/zihin-ai/zihin-mcp | Publicado, desatualizado | README de 31/08 e 96 tools | Painel do Glama (sync do repo + Deploy + Make Release) |
| GitHub MCP Registry | github.com/mcp | Ausente | — | Curadoria do GitHub; nao e espelho do registry oficial |
| Galeria MCP do VS Code | busca `@mcp` no painel Extensions | Ausente (por inferencia) | — | Depende do catalogo do GitHub |
| cursor.directory | cursor.directory/plugins/zihin | Publicado (instalacao a partir da listagem nao testada) | `npx -y @zihin/mcp-server`, sem versao | A listagem le o `mcp.json` da raiz do repo |
| Extensao Gemini CLI | github.com/zihin-ai/gemini-cli-zihin | Publicado (instalacao nao testada: sem Gemini CLI na maquina) | v0.1.1 | Release do GitHub no repo da extensao |
| Galeria de extensoes Gemini | geminicli.com/extensions | Ausente | — | Crawler diario de repos com o topic `gemini-cli-extension` |
| Docker MCP Catalog | hub.docker.com/mcp | Submetido (docker/mcp-registry#5438, aguardando revisao) | — | PR em docker/mcp-registry; a Docker constroi a imagem a partir do commit fixado |
| Docker Hub / GHCR (imagem propria) | — | Ausente | — | Nao ha publicacao de imagem no CI |
| Documentacao publica | docs.zihin.ai/integrations/mcp-server | Confirmado | 88 tools | PR em zihin-ai/zihin-docs + deploy manual com build local |

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
  - **Raiz do repositorio** (criada em 01/09): o commit `5e54f53` passou e esta "pronto para
    publicar"; o commit seguinte falhou porque o `mcp.json` da raiz usa `npx` sem versao. A raiz
    nao e o plugin: e uma duplicata a retirar (Withdraw submission), decisao do mantenedor.
  - Nada esta publicado no diretorio. Atualizacoes: so checagem agendada (~6h); o webhook de push
    nao esta configurado.
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
- **Proximos passos no portal** (claude.ai/directory/manage):
  1. Acompanhar a submissao da pasta `plugin` ate o revisor liberar a v2.2.2; quando passar,
     **Publish** na pagina do plugin.
  2. Retirar a submissao duplicada da raiz do repositorio.
  3. Opcional: configurar o webhook de push (Configuracoes -> Atualizacoes) e acrescentar `icon`
     (SVG ou PNG 512x512 dentro de `plugin/`) ao `plugin.json`.
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
- **Pendencia** (exige login no Smithery; o navegador usado em 04/10/2026 nao estava logado): disparar novo scan, corrigir a descricao para 88 tools e
  conferir que as tools de conexao sumiram.

### Glama

- **Evidencia**: a pagina responde e esta reivindicada (`glama.json`, PR #23). Ela exibe o README
  antigo ("Contagens verificadas contra producao em 31/08/2026 (96 tools / 20 resources)") e
  "Available Tools: 96".
- **Como recebe atualizacao**: sync do repositorio no painel, mais Deploy e Make Release com o
  Dockerfile (PR #24) para os checks de qualidade.
- **Pendencia** (exige login no Glama com o GitHub do mantenedor; a pagina Admin pedia "Login with
  GitHub to claim" em 04/10/2026): sincronizar o repo, refazer Deploy e Make Release com a
  2.2.2 e conferir os checks e a contagem.

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
