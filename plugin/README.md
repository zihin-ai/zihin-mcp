# Zihin plugin for Claude Code

Manage AI agents on the [Zihin.ai](https://zihin.ai) platform from Claude Code: create and publish
agents, configure tools and triggers, set budgets and approval policies, and diagnose executions.

## What it installs

- **The `zihin` MCP server.** It runs the official [`@zihin/mcp-server`](https://www.npmjs.com/package/@zihin/mcp-server)
  npm package through `npx`. The package is a stdio proxy: it forwards MCP requests over HTTPS to
  `https://llm.zihin.ai/mcp` and returns the responses. It talks to no other destination.
- **Seven skills** with the platform playbooks: `zihin-mcp` (router), `zihin-criar-agente`,
  `zihin-tools-de-agente`, `zihin-triggers-e-canais`, `zihin-diagnostico`,
  `zihin-governanca-e-operacao` and `zihin-processos`. They are plain Markdown and run nothing.

## Requirements

- Node.js 20 or later.
- A Zihin API Key in the `ZIHIN_API_KEY` environment variable. The key is sent only to the Zihin
  server, in the `X-Api-Key` header. Its role (admin, editor or member) decides which tools are
  available; access control is enforced on the server.

## Login de pessoa (sem API Key) / signing in without an API Key

The plugin stays in **API Key mode**. A person can also connect Claude Code with their own Zihin
account instead of a key, but that connection does not go through the plugin: each company has its
own server URL, `https://llm.zihin.ai/mcp/t/{tenant_id}` (lowercase UUID, no trailing slash), and in
Claude Code the connection needs a `--client-id` that belongs to that person in that company. The
plugin's `.mcp.json` cannot pin a per-person client, so:

1. In the Zihin console, open **Connect an assistant (MCP)** (on the **API Keys** page or on
   **/assistentes**) and click **Generate command**.
2. Run the generated command. It looks like
   `claude mcp add --transport http --client-id YOUR_CLIENT_ID zihin-your-company https://llm.zihin.ai/mcp/t/{tenant_id}`.
3. Call any Zihin tool (or `/mcp`) to sign in in the browser.

Codex (`codex mcp add <name> --url <url>`) and Cursor (remote MCP server with the URL) sign in the
same way. Other clients are not verified with the sign-in yet: use an API Key there.

Signed in, the person keeps their role in the company, minus 20 tools that create a credential or a
persistent way in (API Keys, secrets, triggers, external MCP servers, CSPs and approval policies,
version/snapshot rollback, agent cloning, publishing and enabling processes): `owner`/`admin` see
86 tools instead of 106. Those steps are done in the console or with an API Key. The skills
installed by this plugin work with either connection. Details:
https://docs.zihin.ai/integrations/mcp-server#sign-in

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
