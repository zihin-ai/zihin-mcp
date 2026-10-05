 ## Onde está

  - **PR:** https://github.com/zihin-ai/zihin-mcp/pull/29, branch `release/2.2.2-skills-sem-banco`, base `main` (`39ae72e`).
  - **Worktree local já pronta:** `/Users/ronanoliveira/Developer/Zihin.ai/zihin-mcp-release`. O `node_modules` dela é um symlink para `../zihin-mcp/node_modules`; não commite
  esse symlink. O checkout principal `/Users/ronanoliveira/Developer/Zihin.ai/zihin-mcp` está em outra branch (`chore/keychain-registry-key`, PR #26 aberto — trata o Keychain
  do `registry-publish.sh`; veja se ela deve entrar antes do passo do registry); não mexa nele.
  - **Leia primeiro:** o `CLAUDE.md` do repo, as seções "CI/CD" (fluxo canary) e "MCP Registry oficial", e `docs/registry-mcp-oficial.md`.
  - **Server em produção (fonte da verdade):** `https://llm.zihin.ai` na versão 2026.10.4 (`curl -s https://llm.zihin.ai/health`). Server card público, sem auth:
  `https://llm.zihin.ai/.well-known/mcp/server-card.json`, com 88 tools, 19 resources e 3 prompts.
  - **Fonte das skills:** `/Users/ronanoliveira/Developer/Zihin.ai/zihin-agent-builder/server-llm/mcp-server/skills` (branch `server-llm`).

  ## O que a release faz (dois commits: `e76da02` e `738fe6f`)

  1. **Skills ressincronizadas** com o server (`scripts/sync-skills.mjs`). Saíram `db_config`, as conexões e o trigger `db_event`, porque o recurso "banco de dados do tenant"
  foi removido do server em 03/10/2026. Entraram: memória, engajamento, chips, `base_version`/`CONFLICT`, `timeout_clock` e identidade no `chat_with_agent`.
  2. **Bump para 2.2.2** em `package.json`, `server.json` (topo e `packages[0]`) e `plugin/.claude-plugin/plugin.json`.
  3. **Contagens:** 88 tools e 19 resources (10 schemas); o editor vê 48. Atualizadas no README, no `plugin.json` e no `marketplace.json`.
  4. **`npm test`:** passou de `node --test test/` para `node --test test/*.test.js`. A forma antiga falhava no Node 22+.
  5. **CHANGELOG:** traz a única mudança de runtime, que já está no `main` desde o #24: o handshake passa a informar a versão real (a 2.2.1 se apresentava como 2.2.0).
  6. **Fluxo de publicação no `CLAUDE.md`:** novo passo 0, com o gate de integração **local** antes do publish (o `publish.yml` só roda na tag, depois do publish, e a tag
  `v2.2.1` nunca foi empurrada), e novo passo 4, com o registry só depois do `latest`. O `scripts/registry-publish.sh` passa a conferir também o `plugin.json`.

  ## Já verificado na sessão de origem (confira, não confie)

  Houve uma revisão adversarial com nenhum achado bloqueante. Os três médios foram corrigidos ou encaminhados.

  - **Skills:** byte-idênticas à fonte do server e ao commit em produção. Toda tool e todo resource citados existem no server card, e nenhum conceito removido aparece.
  - **Testes offline:** 40 de 40 nos Nodes 20.19.4, 22.23.1 e 24.21.0.
  - **Integração contra produção:** 62 de 62 no Node 24.
  - **Tarball:** 14 arquivos, os mesmos da 2.2.1. Instalado, mostra o banner v2.2.2.
  - **Quem atualiza da 2.2.1:** `install-skills --client all --bundled` funciona; os 6 nomes de skill são os mesmos.

  **Encaminhado para fora desta release** (texto do server, que muda no server e entra num sync futuro):
  - `zihin-agent-builder#691`: `set_session_control` com `expires_at` que a tool não aceita; docs privados e nome de server de cliente nas skills;
  - `gemini-cli-zihin#1`: ainda diz 96 tools.

  ## O que fazer nesta sessão

  1. **Revisão própria e independente** do PR #29 contra produção. Releia o diff e rode de novo `npm pack --dry-run` e `npm test` sem key (`ZIHIN_API_KEY=` no comando). Se
  achar algo, corrija na branch e diga o quê.
  2. **CI do PR verde**, depois **merge do PR #29** (merge commit). Peça meu ok antes do merge.
  3. **Gate de integração local**, que roda 1 turno real de LLM: `ZIHIN_API_KEY=… REQUIRE_INTEGRATION=1 npm test`. A chave está no meu ambiente.
  4. **Publicação, a partir do `main` atualizado:**
     - `npm publish --tag next`. É manual e usa passkey: o npm abre o navegador. Não peça `--otp`. Esse passo é **meu**; prepare o comando e espere.
     - Valide o canary: instale `@zihin/mcp-server@next` num diretório temporário, suba com a minha key, confira `tools/list` (88), `resources/list` (19) e o banner v2.2.2, e
  compare o contrato proxy × server.
     - `npm dist-tag add @zihin/mcp-server@2.2.2 latest`, depois push da tag `v2.2.2`. O `publish.yml` deve virar no-op verde; confira o run.
     - `scripts/registry-publish.sh` (MCP Registry oficial: chave Ed25519 e TXT em `zihin.ai`; veja o doc). Confira a 2.2.2 como `isLatest` no registry.
  5. **Pós-publicação:**
     - `npm view @zihin/mcp-server dist-tags`;
     - instalação limpa com `npx -y @zihin/mcp-server@latest`;
     - feche o que couber.

  ## Regras

  - Commits e docs em português brasileiro, **sem** `Co-Authored-By`.
  - Não publique nada nem faça push de tag sem o meu ok explícito naquele passo.
  - Listar variáveis/segredos só por nome, nunca valores. No Railway: `railway variables --json | jq -r 'keys[]'`.
  - Antes de afirmar que algo está ok, mostre o comando e a saída.