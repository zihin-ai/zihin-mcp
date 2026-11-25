# Changelog

## 2.3.0

- Claude Code plugin: sign in with your Zihin account at `https://llm.zihin.ai/mcp`. The
  API key option is now optional; leave it empty to sign in, or enter a key to connect as
  that key. Each connected assistant works with one organization.
- MCP Registry: the hosted remote lists `X-Api-Key` as optional, because clients can sign in instead.
- Bundled skills match the hosted server, including the new `zihin-processos` guide and
  the shared integrations section of `zihin-governanca-e-operacao`.
- The plugin and the npm package share version 2.3.0. The proxy still requires an API key.

## 2.2.4

- Detect integration-test readiness through the MCP handshake instead of translated diagnostics.

## 2.2.3 (not published)

- Use English documentation, bundled skills and client diagnostics.
- Limit package contents to runtime files, user documentation and required metadata.
- Check package contents before packing or publishing.
- Remove internal operating notes and stop printing API key suffixes.

## 2.2.2

- Pin the Claude Code plugin to the matching proxy version.

## 2.2.1

- Refresh platform skills and improve MCP client compatibility.

## Earlier releases

Earlier releases introduced the stdio proxy, bundled skills and the skill installer.
