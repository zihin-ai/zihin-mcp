# Zihin plugin for Claude Code

Connect Claude Code to Zihin.ai to discover and work with hosted AI agents. This plugin
connects directly to `https://llm.zihin.ai/mcp` using Streamable HTTP and includes
English platform guides for agent creation, tools, triggers, diagnostics and governance.
Available operations depend on your API key.

Install from the official marketplace:

```text
/plugin install zihin --marketplace zihin-ai/zihin-mcp
```

Set `ZIHIN_API_KEY` before starting Claude Code. The client sends this key in the
`X-Api-Key` header.
No local MCP process or Node.js installation is required by this plugin. Keep your key
in a secret store or environment configuration, never in Git.

Update the marketplace and plugin, then restart Claude Code and check `/mcp`:

```text
/plugin marketplace update zihin
/plugin update zihin@zihin
```

Plugin versions are independent of the npm proxy package. The plugin uses the hosted
endpoint; the npm proxy remains available for clients that require stdio. Proxy-only
settings such as `ZIHIN_MCP_URL` and `ZIHIN_MCP_CALL_TIMEOUT_MS` do not configure this plugin.

Agent execution can consume credits and perform external actions. Read the relevant
skill and the server's current schemas before making changes. See the repository README
and https://docs.zihin.ai/integrations/mcp-server for installation and configuration.

[Privacy policy](https://zihin.ai/en/privacy)
