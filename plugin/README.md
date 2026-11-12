# Zihin plugin for Claude Code

Connect Claude Code to Zihin.ai to discover and work with hosted AI agents. This plugin
connects directly to `https://llm.zihin.ai/mcp` using Streamable HTTP and includes
English platform guides for agent creation, tools, triggers, diagnostics and governance.
Available operations depend on your API key.

Install from the official marketplace:

```text
/plugin install zihin --marketplace zihin-ai/zihin-mcp
```

When enabling the plugin, enter your Zihin API key in the **Zihin API key** option.
The option is required and sensitive: Claude stores it in its secure credential store
and sends it in the `X-Api-Key` header. To change the key, open `/plugin`, select Zihin
under Installed, and choose **Configure options**. Existing users must configure this
option after updating; the plugin no longer reads `ZIHIN_API_KEY` from the environment.
No local MCP process or Node.js installation is required by this plugin. Never commit
your key to Git or include it in prompts.

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
