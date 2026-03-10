# @zihin/mcp-server

MCP Server proxy para a plataforma [Zihin.ai](https://zihin.ai). Conecta clientes MCP (Claude Desktop, Cursor, Claude Code, Codex, Windsurf) ao Zihin MCP Server via HTTP.

## Instalação

Não é necessário instalar. Use `npx` diretamente:

```bash
ZIHIN_API_KEY=zhn_live_xxx npx @zihin/mcp-server
```

## Configuração

### Claude Desktop / Claude Code

Adicione ao arquivo de configuração MCP (`claude_desktop_config.json` ou `.claude.json`):

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

## Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `ZIHIN_API_KEY` | Sim | API Key do tenant (formato `zhn_live_*`, `zhn_test_*` ou `zhn_dev_*`) |
| `ZIHIN_MCP_URL` | Não | URL do MCP Server (default: `https://llm.zihin.ai/mcp`) |

## Como funciona

O pacote atua como um **proxy transparente** entre o cliente MCP local (via stdio) e o Zihin MCP Server (via HTTP):

```
Cliente MCP ←stdio→ [@zihin/mcp-server] ←HTTP→ https://llm.zihin.ai/mcp
```

- Todas as tools, resources e prompts são descobertos automaticamente do server
- Auth, RBAC e tenant isolation são enforced server-side via API Key
- O role (admin/editor/member) é determinado pela API Key — para role diferente, crie uma nova API Key

## Capabilities

Dependendo do role da API Key:

| Role | Tools | Resources | Prompts |
|------|-------|-----------|---------|
| `admin` | 69 | 3 | 3 |
| `editor` | 69 (write guardado) | 3 | 3 |
| `member` | 4 (consumer) | 0 | 0 |

## Troubleshooting

### "ERRO: ZIHIN_API_KEY não definida"
Defina a variável de ambiente antes de rodar o comando:
```bash
ZIHIN_API_KEY=zhn_live_xxx npx @zihin/mcp-server
```

### "Falha ao conectar ao server"
- Verifique sua conexão com a internet
- Verifique se a API Key é válida e está ativa
- Se usar URL customizada, verifique `ZIHIN_MCP_URL`

### Tools não aparecem no Claude Desktop
- Reinicie o Claude Desktop após alterar a configuração
- Verifique os logs em `~/Library/Logs/Claude/mcp*.log` (macOS)
- No Windows: `%APPDATA%\Claude\logs\mcp*.log`

## Requisitos

- Node.js >= 18

## Licença

MIT
