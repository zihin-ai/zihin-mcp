# Zihin plugin for Claude Code

Connect Claude Code to Zihin.ai to discover and work with hosted AI agents. This plugin
connects directly to `https://llm.zihin.ai/mcp` using Streamable HTTP and includes
English platform guides for agent creation, tools, triggers, processes, diagnostics and
governance. No local MCP process or Node.js installation is required.

Install from the official marketplace:

```text
/plugin install zihin --marketplace zihin-ai/zihin-mcp
```

## Sign in with your Zihin account

Leave the optional **Zihin API key** empty. Run `/mcp`, select the Zihin server and
authenticate: Claude Code opens your browser, you sign in to Zihin and choose the
organization. The connection acts with your role in that organization. Operations that
create credentials or persistent access, such as API keys, secrets, triggers or MCP
servers, are not available through sign-in; complete them in the Zihin console.

Each connected assistant works with one organization. To switch, disconnect it under
**My assistants** in the Zihin console and sign in again, choosing the other organization.
Disconnecting this assistant signs it out in all of your organizations.

## Use an API key instead

Enter a key in the **Zihin API key** option to connect as that key. The option is
sensitive: Claude stores it in its secure credential store and sends it in the
`X-Api-Key` header. Available operations then depend on the key's permissions. An
invalid or revoked key fails without a sign-in prompt; clear the option to sign in.
To change the option, open `/plugin`, select Zihin under Installed, and choose
**Configure options**. Never commit your key to Git or include it in prompts.

## Updates

Update the marketplace and plugin, then restart Claude Code and check `/mcp`:

```text
/plugin marketplace update zihin
/plugin update zihin@zihin
```

The plugin uses the hosted endpoint; the npm proxy remains available for clients that
require stdio. Proxy-only settings such as `ZIHIN_MCP_URL` and `ZIHIN_MCP_CALL_TIMEOUT_MS`
do not configure this plugin.

Agent execution can consume credits and perform external actions. Read the relevant
skill and the server's current schemas before making changes. See the repository README
and https://docs.zihin.ai/integrations/mcp-server for installation and configuration.

[Privacy policy](https://zihin.ai/en/privacy)
