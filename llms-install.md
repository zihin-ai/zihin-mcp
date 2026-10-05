# Installing the Zihin MCP server (guide for AI agents)

`@zihin/mcp-server` is a stdio proxy that connects an MCP client to the hosted Zihin.ai MCP server
at `https://llm.zihin.ai/mcp`. Nothing is built locally: the client runs the npm package with
`npx`.

## Requirements

- Node.js 20 or later.
- A Zihin API Key, created in the Zihin console. Valid keys start with `zhn_live_`, `zhn_test_`
  or `zhn_dev_`. Ask the user for the key; do not invent one.

## Configuration

Add this entry to the client's MCP settings file and replace the placeholder with the user's key:

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

VS Code uses the key `servers` instead of `mcpServers` in `.vscode/mcp.json`; the entry itself is
the same.

Optional environment variables:

- `ZIHIN_MCP_URL`: server URL. Default: `https://llm.zihin.ai/mcp`.
- `ZIHIN_MCP_CALL_TIMEOUT_MS`: ceiling for one tool call, in milliseconds. Default: `300000`.

## Verify

1. Restart the MCP client or reload its servers.
2. Call the `whoami` tool. It returns the tenant, the role of the key and the plan.
3. List the tools. The set depends on the role of the key: an admin key sees every tool, an
   editor key sees the read tools, a member key sees five.

## Troubleshooting

- `ZIHIN_API_KEY nao definida`: the environment variable did not reach the process. Check the
  `env` block.
- `API Key invalida ou revogada`: the key was rejected by the server. Ask the user for a new one.
- Tools do not appear: restart the client after changing the configuration.

Messages printed by the proxy are in Portuguese. Full documentation, in English:
https://docs.zihin.ai/integrations/mcp-server
