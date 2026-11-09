# Zihin MCP server

Connect MCP clients to the [Zihin.ai](https://zihin.ai) agent platform. This package
proxies stdio requests to the hosted MCP endpoint and includes platform skills.
Requires Node.js 20 or later and a Zihin API key.

## Quick start

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
`https://llm.zihin.ai/mcp`, using the `X-Api-Key` header.
Available tools and resources depend on your account and key permissions.

## Claude Code plugin

```text
/plugin marketplace add zihin-ai/zihin-mcp
/plugin install zihin@zihin
```

Set `ZIHIN_API_KEY` in the environment used to start Claude Code. Update the plugin
to receive changes to its pinned proxy version and bundled skills.

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
