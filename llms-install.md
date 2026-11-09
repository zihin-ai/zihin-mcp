# Install the Zihin MCP server

Requires Node.js 20 or later, a Zihin account and an API key.

Run `npx -y @zihin/mcp-server` with `ZIHIN_API_KEY` in the environment.
The process exposes MCP over stdio. Configure it as a server in your MCP client.
For Streamable HTTP clients, use `https://llm.zihin.ai/mcp` and the `X-Api-Key` header.

To install the packaged platform guides without credentials, run:

```sh
npx -y @zihin/mcp-server install-skills --client all --bundled
```

Keep credentials out of source files, prompts and logs. Use the account's available tools
and schemas to discover current capabilities. See README.md for configuration and support.
