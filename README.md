# @zihin/mcp-server

**Converse com seus agentes de IA da [Zihin.ai](https://www.zihin.ai) e gerencie-os direto do seu IDE ou assistente** — Claude, Cursor, VS Code, Codex, Gemini CLI ou qualquer cliente MCP.

[![npm version](https://img.shields.io/npm/v/@zihin/mcp-server?style=flat-square)](https://www.npmjs.com/package/@zihin/mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@zihin/mcp-server?style=flat-square)](https://www.npmjs.com/package/@zihin/mcp-server)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-ai.zihin%2Fmcp--server-blue?style=flat-square)](https://registry.modelcontextprotocol.io/v0/servers?search=ai.zihin/mcp-server)
[![License: MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)
[![smithery badge](https://smithery.ai/badge/zihin/mcp)](https://smithery.ai/servers/zihin/mcp)
[![zihin-mcp MCP server](https://glama.ai/mcp/servers/zihin-ai/zihin-mcp/badges/score.svg)](https://glama.ai/mcp/servers/zihin-ai/zihin-mcp)

> Se este projeto for útil para você, uma ⭐ ajuda outras pessoas a encontrá-lo.

Proxy MCP stdio-to-HTTP para a plataforma Zihin.ai. Conecta clientes MCP ao Zihin MCP Server via HTTP.

```
Cliente MCP <-stdio-> [@zihin/mcp-server] <-HTTP-> https://llm.zihin.ai/mcp
```

### Em 30 segundos

1. Gere uma API Key no console da Zihin.
2. Registre o servidor no seu cliente — no Claude Code, por exemplo:
   ```bash
   claude mcp add zihin -e ZIHIN_API_KEY=zhn_live_xxx -- npx -y @zihin/mcp-server
   ```
   Claude Desktop, Cursor (1 clique), VS Code (1 clique), Windsurf, Gemini CLI e Codex: ver [Configuracao](#configuracao).
3. Peça ao assistente: *"liste meus agentes Zihin"* ou *"converse com o agente X"*.

Prefere entrar com a sua conta da Zihin, sem API Key? Claude Code, Codex e Cursor conectam direto ao servidor da empresa — ver [Login de pessoa](#login-de-pessoa-sem-api-key).

### O que você pode fazer

- **Conversar com agentes publicados** (`chat_with_agent`, com continuidade de sessão).
- **Criar e configurar agentes**: persona, tools de API externa, MCP servers externos e publicação — com o prompt guiado `setup-agent`.
- **Conectar canais e automações**: triggers de webhook (WhatsApp, Slack, Teams, n8n), agendados e por e-mail.
- **Governar**: teto de gasto por agente, políticas de segurança e aprovação humana antes de ações sensíveis.
- **Diagnosticar**: métricas por agente, traces de execução e saúde do tenant.

Até 106 tools para uma key `owner`/`admin` (ver [Capabilities](#capabilities)); o que cada conexão enxerga depende do role e da forma de entrar. Documentação completa: [docs.zihin.ai](https://docs.zihin.ai) · Site: [www.zihin.ai](https://www.zihin.ai)

## Inicio rapido

macOS / Linux:

```bash
ZIHIN_API_KEY=zhn_live_xxx npx @zihin/mcp-server
```

Windows (PowerShell):

```powershell
$env:ZIHIN_API_KEY="zhn_live_xxx"; npx @zihin/mcp-server
```

> Na pratica, a maioria dos clientes MCP (Claude Desktop, Cursor, etc.) define a variavel automaticamente via bloco `"env"` na configuracao — nao e necessario definir manualmente no shell.

## Configuracao

### Claude Desktop

Adicione ao `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "zihin": {
      "command": "npx",
      "args": ["-y", "@zihin/mcp-server"],
      "env": {
        "ZIHIN_API_KEY": "zhn_live_xxx"
      }
    }
  }
}
```

### Claude Code

Adicione ao `.mcp.json` do projeto:

```json
{
  "mcpServers": {
    "zihin": {
      "command": "npx",
      "args": ["-y", "@zihin/mcp-server"],
      "env": {
        "ZIHIN_API_KEY": "zhn_live_xxx"
      }
    }
  }
}
```

Ou via CLI (a variavel `ZIHIN_API_KEY` deve estar definida no shell):

```bash
claude mcp add zihin -e ZIHIN_API_KEY=zhn_live_xxx -- npx -y @zihin/mcp-server
```

### Cursor

Instalacao em 1 clique (cole na barra de endereco do navegador ou rode `open '<link>'`):

```
cursor://anysphere.cursor-deeplink/mcp/install?name=zihin&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIkB6aWhpbi9tY3Atc2VydmVyIl0sImVudiI6eyJaSUhJTl9BUElfS0VZIjoiemhuX2xpdmVfeHh4In19
```

Troque `zhn_live_xxx` pela sua key nas configuracoes do MCP depois de instalar. Ou adicione ao `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "zihin": {
      "command": "npx",
      "args": ["-y", "@zihin/mcp-server"],
      "env": {
        "ZIHIN_API_KEY": "zhn_live_xxx"
      }
    }
  }
}
```

### VS Code (Copilot)

[![Install in VS Code](https://img.shields.io/badge/VS_Code-Install_Zihin_MCP-0098FF?style=flat-square&logo=githubcopilot&logoColor=white)](https://vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%7B%22name%22%3A%22zihin%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40zihin%2Fmcp-server%22%5D%2C%22env%22%3A%7B%22ZIHIN_API_KEY%22%3A%22zhn_live_xxx%22%7D%7D)

O botao abre o VS Code com a config pronta (troque `zhn_live_xxx` pela sua key). Manual: comando
`MCP: Add Server` ou `.vscode/mcp.json`:

```json
{
  "servers": {
    "zihin": {
      "command": "npx",
      "args": ["-y", "@zihin/mcp-server"],
      "env": { "ZIHIN_API_KEY": "zhn_live_xxx" }
    }
  }
}
```

### Windsurf

Adicione ao `~/.windsurf/mcp.json`:

```json
{
  "mcpServers": {
    "zihin": {
      "command": "npx",
      "args": ["-y", "@zihin/mcp-server"],
      "env": {
        "ZIHIN_API_KEY": "zhn_live_xxx"
      }
    }
  }
}
```

### Gemini CLI

```bash
gemini extensions install https://github.com/zihin-ai/gemini-cli-zihin
```

A extensao pede a API Key na instalacao (fica no keychain) e instala o MCP + contexto. Config manual: ver "Outros clientes MCP".

### Codex (OpenAI)

Adicione ao `~/.codex/config.toml` (ou `.codex/config.toml` no projeto):

```toml
[mcp_servers.zihin]
command = "npx"
args = ["-y", "@zihin/mcp-server"]
env_vars = ["ZIHIN_API_KEY"]
```

A variavel `ZIHIN_API_KEY` deve estar definida no seu shell. Alternativamente, para definir inline:

```toml
[mcp_servers.zihin]
command = "npx"
args = ["-y", "@zihin/mcp-server"]

[mcp_servers.zihin.env]
ZIHIN_API_KEY = "zhn_live_xxx"
```

### Outros clientes MCP

Qualquer cliente que suporte o protocolo MCP via stdio pode usar este pacote. O padrao de configuracao e o mesmo: executar `npx -y @zihin/mcp-server` com a variavel `ZIHIN_API_KEY` definida.

## Login de pessoa (sem API Key)

Em vez de uma API Key, a pessoa pode conectar o assistente com o **login da própria conta da Zihin**. Cada empresa tem a sua URL:

```
https://llm.zihin.ai/mcp/t/{tenant_id}
```

`{tenant_id}` é o UUID da empresa em **minúsculas** e **sem barra final** (outra grafia responde `404`). Não precisa montar à mão: o console mostra a URL pronta em **Conectar um assistente (MCP)**, na página **API Keys** e na página pessoal **/assistentes** (aberta a todos os papéis, inclusive `member`). Esse modo **não usa este pacote**: o assistente fala direto com o servidor pelo transporte HTTP nativo dele. Na primeira chamada o assistente abre o navegador, você entra com a conta da Zihin e confirma a empresa; depois ele renova o acesso sozinho. Uma conexão vale para **uma empresa** — para outra, adicione outro servidor com a URL dela.

**Claude Code** — no console, em **Conectar um assistente (MCP)**, clique em **Gerar comando**. O comando traz um `--client-id` que é só seu naquela empresa (é o que permite revogar só essa conexão):

```bash
claude mcp add --transport http --client-id SEU_CLIENT_ID zihin-sua-empresa https://llm.zihin.ai/mcp/t/{tenant_id}
```

Rode o comando e chame qualquer tool da Zihin (ou `/mcp` no Claude Code) para entrar. Depois de revogar, gere o comando de novo.

**Codex**:

```bash
codex mcp add zihin-sua-empresa --url https://llm.zihin.ai/mcp/t/{tenant_id}
```

**Cursor** — adicione um **servidor MCP remoto** com a URL da empresa, por exemplo em `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "zihin-sua-empresa": {
      "url": "https://llm.zihin.ai/mcp/t/{tenant_id}"
    }
  }
}
```

Outros clientes (Claude Desktop, claude.ai e demais) ainda não foram verificados com o login: neles, use a API Key com este pacote.

O que muda com o login:

- **Papel da pessoa na empresa**, lido a cada requisição (não vem da API Key). Pelo login, `owner`/`admin` veem **86 tools**: ficam de fora as 20 que criam credencial ou acesso que continuaria valendo depois de revogar a conexão (API Keys, secrets, triggers, servidores MCP, CSPs e políticas de aprovação, restaurar versão/snapshot, clonar agente, publicar definição de processo e ligar processo). Essas etapas são feitas no console ou com uma API Key. `editor` (57) e `member` (5) não perdem nada. Detalhes: [docs.zihin.ai — o que a pessoa conectada não faz](https://docs.zihin.ai/integrations/mcp-server#oauth-delegation).
- **Revogar** pelo console (**/assistentes** para as suas conexões; admin/owner veem as da empresa) corta o acesso na hora — ver [Assistentes conectados](https://docs.zihin.ai/integrations/mcp-server#connected-assistants).
- O endpoint genérico `https://llm.zihin.ai/mcp` segue **só com API Key**.

**O plugin Claude Code e este pacote continuam no modo API Key.** O `.mcp.json` do plugin não tem como fixar um `--client-id` por pessoa × empresa, então o login de pessoa no Claude Code é pelo comando gerado no console, não pelo plugin. As skills do plugin funcionam com qualquer das duas conexões.

**API Key no servidor da empresa**: a API Key da empresa também vale em `/mcp/t/{tenant_id}`. Para apontar o pacote para lá, use a URL da **mesma empresa** da key:

```bash
ZIHIN_API_KEY=zhn_live_xxx ZIHIN_MCP_URL=https://llm.zihin.ai/mcp/t/{tenant_id} npx -y @zihin/mcp-server
```

Com a key, o que vale é o role da key (as 106 tools para `owner`/`admin`), como no `/mcp`.

## Variaveis de ambiente

| Variavel | Obrigatoria | Descricao |
|----------|-------------|-----------|
| `ZIHIN_API_KEY` | Sim | API Key do tenant (formato `zhn_live_*`, `zhn_test_*` ou `zhn_dev_*`) |
| `ZIHIN_MCP_URL` | Nao | URL do MCP Server (default: `https://llm.zihin.ai/mcp`). Aceita também o servidor da empresa, `https://llm.zihin.ai/mcp/t/{tenant_id}`, com a API Key da mesma empresa |
| `ZIHIN_MCP_CALL_TIMEOUT_MS` | Nao | Teto de tempo de um `tools/call`, em milissegundos (default: `300000`, 5 min; faixa aceita: `1000`–`1800000`). O server tem deadline proprio por canal (defaults de chat 150s, builder 180s e demais canais 240s, sujeitos ao teto operacional do servidor) — o default deixa o server responder o erro diagnosticavel antes de o proxy cortar. As skills do backend 2026.10.5 informam teto operacional de 180s para os canais externos, incluindo `chat_with_agent`; esse valor depende da configuracao do servidor. Acima de ~300s o `fetch` do Node (undici) pode cortar antes, com timeout proprio de headers/body. |

## Como funciona

O pacote atua como um **proxy transparente** entre o cliente MCP local (via stdio) e o Zihin MCP Server (via HTTP):

- Todas as tools, resources e prompts sao descobertos automaticamente do server
- Auth, RBAC e tenant isolation sao enforced server-side via API Key
- O role (admin/editor/member) e determinado pela API Key

## Skills — deixe seu IDE especialista no Zihin

O servidor expoe 7 skills (playbooks procedurais: criar agente, tools, triggers, diagnostico, governanca, processos) como resources `zihin://skills/*`, para os roles que enxergam resources (ver Capabilities). Nada precisa ser instalado, mas o corpo da skill nao e entregue sozinho: o client (ou o modelo) precisa consulta-lo com `resources/read`.

Para instalar tambem no formato NATIVO do seu client (ativacao automatica por contexto):

```bash
# Claude Code (Agent Skills em .claude/skills/)
ZIHIN_API_KEY=zhn_live_xxx npx @zihin/mcp-server install-skills --client claude

# Cursor (.cursor/rules/*.mdc) | Windsurf (.windsurf/rules/) | Codex (AGENTS.md + .zihin/skills/)
ZIHIN_API_KEY=zhn_live_xxx npx @zihin/mcp-server install-skills --client cursor
ZIHIN_API_KEY=zhn_live_xxx npx @zihin/mcp-server install-skills --client all

# Offline (usa as skills empacotadas no npm)
npx @zihin/mcp-server install-skills --client claude --bundled
```

Opcoes: `--client claude|cursor|windsurf|codex|all` · `--dir <raiz-do-projeto>` · `--global` (so claude, instala em `~/.claude/skills`) · `--bundled` (offline).

As skills sao buscadas do server vivo (sempre atualizadas). Se a busca falhar (rede, server fora do ar, key recusada) ou voltar vazia, o comando instala as copias empacotadas no npm — as mesmas do `--bundled`, congeladas na data da release. Na falha ele imprime um aviso; nos dois casos a saida informa a fonte usada (`fonte: server` ou `fonte: bundled`). Sem `ZIHIN_API_KEY` e sem `--bundled` nao ha fallback: o comando encerra com erro. No Codex, um bloco gerenciado e inserido no `AGENTS.md` (entre `<!-- zihin-skills:start/end -->`, idempotente) com o indice das skills em `.zihin/skills/`.

### Plugin Claude Code (MCP + skills em um comando)

```bash
claude plugin marketplace add zihin-ai/zihin-mcp
claude plugin install zihin@zihin
```

O plugin instala o MCP server (via este pacote) + as 7 skills. Requer `ZIHIN_API_KEY` exportada no ambiente.

## Capabilities

As capabilities disponiveis dependem do role da API Key, controlado server-side:

| Role | Tools | Resources | Prompts |
|------|-------|-----------|---------|
| `owner` / `admin` | Todas (106) | 21 | 3 |
| `editor` | Leitura (57 — writes nao sao listadas) | 21 | 3 |
| `member` | Subset consumer (5) | - | - |

Pelo [login de pessoa](#login-de-pessoa-sem-api-key), `owner`/`admin` veem 86 tools (`editor` e `member`, as mesmas da tabela) e os prompts caem para 2 (o `configure-webhook` fica de fora, porque depende de `create_trigger`). Empresa sem o motor de processos ve so `get_process_engine_status` entre as tools de processo: 93 tools para `owner`/`admin` com API Key, 75 pelo login, e 50 para `editor`.

Contagens conferidas contra o servidor em 03/11/2026 (106 tools / 21 resources — 3 catalogos + 11 schemas + 7 skills / 3 prompts). O numero exato pode variar conforme o server evolui.

### Resources disponiveis

| URI | Descricao |
|-----|-----------|
| `zihin://agents` | Lista de agentes do tenant |
| `zihin://models` | Catalogo de modelos LLM disponiveis |
| `zihin://schema-templates` | Templates de schema para configuracao |
| `zihin://schemas/{tipo}` | Contrato formal (JSON Schema) de cada payload — o mesmo que o server valida (11 tipos) |
| `zihin://skills/{slug}` | Playbooks procedurais (7 skills — ver secao Skills acima) |

### Prompts disponiveis

| Nome | Descricao |
|------|-----------|
| `setup-agent` | Cria um agente completo (agente + persona + tools + publicacao) |
| `add-tool` | Adiciona uma tool a um agente existente |
| `configure-webhook` | Configura trigger webhook para um agente |

## Testes

87 testes: unitarios offline (classificacao de erros, teto de timeout, install-skills, verificador do registry, coerencia dos manifests do plugin) + integracao real contra o server de producao. Sem `ZIHIN_API_KEY`, so os offline rodam; com a key, a suite completa:

```bash
ZIHIN_API_KEY=zhn_live_xxx npm test
```

Cobertura: validacao de API Key, tools (incluindo `chat_with_agent` com session tracking, continuidade e o contrato de saida — `execution_id`, `cancelled`, `tools_used`/`tool_calls`), resources, prompts, protocolo MCP (identidade espelhada + instructions), classificacao de erros (formas SDK v1 e v2) e o teto de `tools/call` conferido contra o deadline do server.

> A suite de integracao faz DUAS chamadas reais a `chat_with_agent` (abertura da sessao e continuidade) — dois turnos de agente, com custo real de LLM no tenant. No CI ela roda apenas no workflow da tag `v*`.

## Troubleshooting

### "ERRO: ZIHIN_API_KEY nao definida"

Defina a variavel de ambiente antes de rodar:

```bash
# macOS / Linux
ZIHIN_API_KEY=zhn_live_xxx npx @zihin/mcp-server

# Windows (PowerShell)
$env:ZIHIN_API_KEY="zhn_live_xxx"; npx @zihin/mcp-server
```

### "Falha ao conectar ao server"

- Verifique sua conexao com a internet
- Verifique se a API Key e valida e esta ativa
- Se usar URL customizada, verifique `ZIHIN_MCP_URL`

### "ERRO FATAL: API Key invalida ou revogada"

A API Key foi revogada ou desativada no painel Zihin. Gere uma nova key e atualize a configuracao do cliente MCP. Reinicie o processo apos a troca.

### "A tool X passou do teto de 300s do proxy e foi abortada"

O proxy espera ate 5 minutos por um `tools/call`. Quando essa mensagem aparece, o limite atingido foi o **do proxy**, nao o do server — o trabalho foi cancelado no servidor (no dialeto 2026-07-28 o abort do request e o sinal de cancelamento), entao nao ha execucao orfa queimando token.

- Turno de agente legitimamente longo: suba o teto com `ZIHIN_MCP_CALL_TIMEOUT_MS` (em milissegundos, faixa `1000`–`1800000`). Acima de ~300s o proprio `fetch` do Node pode cortar antes.
- Quem estourou primeiro foi o **server** (deadline por canal: defaults de chat 150s, builder 180s e demais canais 240s, sujeitos ao teto operacional do servidor): a mensagem que chega e outra, um erro `TURN_TIMEOUT` com `execution_id` e `session_id` — leve esses dois identificadores para o suporte, sao a correlacao com a execucao no servidor.
- Cliente MCP tem timeout proprio, independente deste: se o host desistir antes, ele mostra o erro dele.

### Tools nao aparecem no cliente

- Reinicie o cliente MCP apos alterar a configuracao
- Claude Desktop: verifique logs em `~/Library/Logs/Claude/mcp*.log` (macOS) ou `%APPDATA%\Claude\logs\mcp*.log` (Windows)

## Limitacoes

- **Turno longo tem teto**: `tools/call` espera no maximo 5 min no proxy (configuravel — ver `ZIHIN_MCP_CALL_TIMEOUT_MS`), e o server tem deadline proprio por canal (defaults de chat 150s, builder 180s e demais canais 240s, sujeitos ao teto operacional do servidor). Turno que passa disso e cancelado, nao enfileirado.
- **Streaming**: A tool `chat_with_agent` retorna a resposta completa de uma vez (sincrono). O protocolo MCP define que tools retornam um `CallToolResult` completo — nao ha suporte a streaming progressivo. Para feedback em tempo real durante execucao do agente, use o endpoint REST SSE (`POST /api/v2/agents/:agent_id/stream`).

## Requisitos

- Node.js >= 20
- Compativel com macOS, Linux e Windows

## Licenca

MIT

---

Feito pela [Zihin.ai](https://www.zihin.ai). Se este projeto for útil, uma ⭐ ajuda outras pessoas a encontrá-lo.
