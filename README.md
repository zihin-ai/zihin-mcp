# Zihin MCP server

Connect MCP clients to the [Zihin.ai](https://zihin.ai) agent platform. The hosted MCP
endpoint is `https://llm.zihin.ai/mcp`. People sign in there with their Zihin account;
integrations use an API key. This package is a stdio proxy for clients that cannot reach
a remote server, and it includes platform skills. The proxy requires Node.js 20 or later
and a Zihin API key.

## Sign in with your Zihin account

Clients that support MCP authorization (OAuth) connect to `https://llm.zihin.ai/mcp`
without an API key. On the first request the server answers `401` with its protected
resource metadata, the client opens your browser, you sign in to Zihin and choose the
organization. The connection then acts with your role in that organization.

- **One organization per assistant.** To work in another organization, disconnect the
  assistant and connect it again, choosing the other organization.
- **Fewer tools than an API key.** Operations that create credentials or persistent access,
  such as API keys, secrets, triggers or MCP servers, stay in the Zihin console.
- **Revoking.** Disconnect an assistant under **My assistants** in the Zihin console.
  For an assistant identified by a public client URL (claude.ai, ChatGPT, Codex, or
  Claude Code without a client of your own), disconnecting signs it out in all of your
  organizations, not only the current one. Other clients follow different rules: a client
  registered for you (such as the Claude Code command with `--client-id`, created per
  person and organization) is deleted, and a client shared by several connections only
  has the revoked connection cut. See [what revoking reaches](https://docs.zihin.ai/integrations/mcp-server#connected-assistants).

See [Sign in](https://docs.zihin.ai/integrations/mcp-server#sign-in) and
[Connected assistants](https://docs.zihin.ai/integrations/mcp-server#connected-assistants).

## Quick start (npm proxy, API key)

```sh
ZIHIN_API_KEY=YOUR_ZIHIN_API_KEY npx -y @zihin/mcp-server
```

Obtain your key from the Zihin console. Store it in your client's secret configuration.
Use a key with the permissions needed for your work. Never commit it to a repository.

## Client configuration

Add this entry to your MCP client's configuration:

```json
{
  "mcpServers": {
    "zihin": {
      "command": "npx",
      "args": ["-y", "@zihin/mcp-server"],
      "env": { "ZIHIN_API_KEY": "YOUR_ZIHIN_API_KEY" }
    }
  }
}
```

Clients with Streamable HTTP support can connect directly to
`https://llm.zihin.ai/mcp`, either by signing in or with the `X-Api-Key` header.
An invalid key is rejected without a sign-in prompt; remove the header to sign in instead.
Available tools and resources depend on your account and key permissions.

## Claude Code plugin

```text
/plugin marketplace add zihin-ai/zihin-mcp
/plugin install zihin@zihin
```

The plugin connects directly to `https://llm.zihin.ai/mcp` over HTTP; it does not start the
npm proxy. Leave the optional **Zihin API key** empty and run `/mcp` to sign in with your
Zihin account, or enter a key to connect as that key. See [the plugin guide](plugin/README.md)
for updates and configuration.

## Cursor plugin

The Cursor plugin connects directly to the hosted MCP endpoint and includes the same
platform skills. Configure the required `ZIHIN_API_KEY` variable under **Plugins → Configure**.
The repository contains only the variable declaration; never commit the key or put it
in a prompt. The API key determines which operations are available. Agent execution
can consume credits and perform external actions.

## Install skills

```sh
npx -y @zihin/mcp-server install-skills --client all --bundled
```

Supported clients are `claude`, `cursor`, `windsurf` and `codex`. Use `--dir` to choose
the project directory, or `--global` for Claude's user-level skills. Without `--bundled`,
the installer fetches skills from the server using your API key and falls back to bundled
skills if the server cannot supply them. Existing skill identifiers are retained for compatibility.

## Configuration

| Variable | Purpose |
| --- | --- |
| `ZIHIN_API_KEY` | Required API key |
| `ZIHIN_MCP_URL` | Optional trusted MCP endpoint; defaults to `https://llm.zihin.ai/mcp` |
| `ZIHIN_MCP_CALL_TIMEOUT_MS` | Tool-call timeout in milliseconds; default 300000, range 1000–1800000 |

The proxy sends your key to the configured endpoint. Change the endpoint only for a
trusted deployment. Diagnostics go to stderr; stdout carries MCP messages.
Agent execution can consume credits and trigger external actions. Inspect returned
errors and warnings before treating an operation as complete.

## Development

```sh
npm ci
npm test
npm run check:publication
```

Tests run offline without `ZIHIN_API_KEY`. Live integration tests require a test account
and key and can execute agents. `REQUIRE_INTEGRATION=1` makes a missing key an error.
The publication check rejects unexpected package files and known language regressions;
release review must also check all public text and exact artifact contents.

[Documentation](https://docs.zihin.ai/integrations/mcp-server) ·
[Security policy](SECURITY.md) · [License](LICENSE)
