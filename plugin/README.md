# Zihin plugin for Claude Code

Manage AI agents on the [Zihin.ai](https://zihin.ai) platform from Claude Code: create and publish
agents, configure tools and triggers, set budgets and approval policies, and diagnose executions.

## What it installs

- **The `zihin` MCP server.** It runs the official [`@zihin/mcp-server`](https://www.npmjs.com/package/@zihin/mcp-server)
  npm package through `npx`. The package is a stdio proxy: it forwards MCP requests over HTTPS to
  `https://llm.zihin.ai/mcp` and returns the responses. It talks to no other destination.
- **Six skills** with the platform playbooks: `zihin-mcp` (router), `zihin-criar-agente`,
  `zihin-tools-de-agente`, `zihin-triggers-e-canais`, `zihin-diagnostico` and
  `zihin-governanca-e-operacao`. They are plain Markdown and run nothing.

## Requirements

- Node.js 20 or later.
- A Zihin API Key in the `ZIHIN_API_KEY` environment variable. The key is sent only to the Zihin
  server, in the `X-Api-Key` header. Its role (admin, editor or member) decides which tools are
  available; access control is enforced on the server.

## Install and update

```bash
claude plugin marketplace add zihin-ai/zihin-mcp
claude plugin install zihin@zihin
```

To update an existing install, run `claude plugin update zihin@zihin` and restart Claude Code.

## Documentation

- Server reference: https://docs.zihin.ai/integrations/mcp-server
- Source and changelog: https://github.com/zihin-ai/zihin-mcp

MIT License.
