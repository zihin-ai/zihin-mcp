# Install the Zihin MCP server

The hosted server is `https://llm.zihin.ai/mcp` (Streamable HTTP). It accepts two credentials:

- **Sign-in (OAuth):** for a person using an assistant. Add the URL without headers. The
  first request returns `401` with protected resource metadata; the client opens a browser,
  the person signs in to Zihin and chooses one organization. Each connected assistant works
  with one organization.
- **API key:** for integrations. Send it in the `X-Api-Key` header. An invalid key is
  rejected without a sign-in prompt.

For clients that only support stdio, run `npx -y @zihin/mcp-server` with `ZIHIN_API_KEY`
in the environment. The proxy requires Node.js 20 or later and an API key.

To install the packaged platform guides without credentials, run:

```sh
npx -y @zihin/mcp-server install-skills --client all --bundled
```

Keep credentials out of source files, prompts and logs. Use the account's available tools
and schemas to discover current capabilities. See README.md for configuration and support.
