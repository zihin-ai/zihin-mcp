# Zihin plugin for Claude Code

Connect Claude Code to Zihin.ai to discover and work with hosted AI agents. This plugin
includes an MCP server configuration and English platform guides for agent creation,
tools, triggers, diagnostics and governance. Available operations depend on your API key.

Add the `zihin-ai/zihin-mcp` marketplace and install `zihin@zihin`. Set `ZIHIN_API_KEY`
before starting Claude Code. Update the plugin to receive its pinned proxy version and
revised skills. Keep your key in a secret store or environment configuration, never in Git.

Agent execution can consume credits and perform external actions. Read the relevant
skill and the server's current schemas before making changes. See the repository README
and https://docs.zihin.ai/integrations/mcp-server for installation and configuration.
