# @zihin/mcp-server

Proxy MCP stdio-to-HTTP para a plataforma [Zihin.ai](https://zihin.ai). Conecta clientes MCP ao Zihin MCP Server via HTTP.

```
Cliente MCP <-stdio-> [@zihin/mcp-server] <-HTTP-> https://llm.zihin.ai/mcp
```

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

Adicione ao `.cursor/mcp.json`:

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

## Variaveis de ambiente

| Variavel | Obrigatoria | Descricao |
|----------|-------------|-----------|
| `ZIHIN_API_KEY` | Sim | API Key do tenant (formato `zhn_live_*`, `zhn_test_*` ou `zhn_dev_*`) |
| `ZIHIN_MCP_URL` | Nao | URL do MCP Server (default: `https://llm.zihin.ai/mcp`) |

## Como funciona

O pacote atua como um **proxy transparente** entre o cliente MCP local (via stdio) e o Zihin MCP Server (via HTTP):

- Todas as tools, resources e prompts sao descobertos automaticamente do server
- Auth, RBAC e tenant isolation sao enforced server-side via API Key
- O role (admin/editor/member) e determinado pela API Key

## Capabilities

As capabilities disponiveis dependem do role da API Key, controlado server-side:

| Role | Tools | Resources | Prompts |
|------|-------|-----------|---------|
| `admin` | Todas | 3 | 3 |
| `editor` | Todas (write guardado) | 3 | 3 |
| `member` | Subset (consumer) | - | - |

O numero exato de tools pode variar conforme o server evolui.

### Resources disponiveis

| URI | Descricao |
|-----|-----------|
| `zihin://agents` | Lista de agentes do tenant |
| `zihin://models` | Catalogo de modelos LLM disponiveis |
| `zihin://schema-templates` | Templates de schema para configuracao |

### Prompts disponiveis

| Nome | Descricao |
|------|-----------|
| `setup-agent` | Cria um agente completo (agente + persona + tools + publicacao) |
| `add-tool` | Adiciona uma tool a um agente existente |
| `configure-webhook` | Configura trigger webhook para um agente |

## Testes

O projeto inclui 19 testes de integracao real contra o server de producao:

```bash
ZIHIN_API_KEY=zhn_live_xxx npm test
```

Cobertura: validacao de API Key, tools (incluindo `chat_with_agent` com session tracking), resources, prompts e protocolo MCP.

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

### Tools nao aparecem no cliente

- Reinicie o cliente MCP apos alterar a configuracao
- Claude Desktop: verifique logs em `~/Library/Logs/Claude/mcp*.log` (macOS) ou `%APPDATA%\Claude\logs\mcp*.log` (Windows)

## Requisitos

- Node.js >= 18
- Compativel com macOS, Linux e Windows

## Licenca

MIT
