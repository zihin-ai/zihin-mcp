---
name: zihin-mcp
description: Use this guide when starting work with the Zihin MCP server to discover account permissions, current schemas and the appropriate task-specific guide.
---

# Work with Zihin MCP

Start with `whoami` to confirm the account and role. The available tool list reflects your role and delegation policy. Discover identifiers with list tools; do not invent UUIDs or model names.

Before writing structured data, read `zihin://schemas/{type}` and the selected tool's
input schema. Entity schemas describe full records; supply only fields accepted by the
tool. Use `validate_schema_data` where supported, then inspect the result and warnings.
Treat `success: false` as a failed operation. A successful write can still return warnings
that must be addressed before publication.

Choose the relevant guide:
- Agent creation: `zihin://skills/criar-agente`.
- API and MCP tools: `zihin://skills/tools-de-agente`.
- Automation and channels: `zihin://skills/triggers-e-canais`.
- Troubleshooting: `zihin://skills/diagnostico`.
- Budgets, policies and human intervention: `zihin://skills/governanca-e-operacao`.

`chat_with_agent` and `test_trigger` execute real work and can consume credits or produce
external effects. Match these actions to the user's request. Keep credentials in tenant
secrets and configuration, never in prompts or skill text.

Writes require admin or owner. A personal OAuth connection excludes operations that
create persistent credentials or access. Complete those operations in the Zihin console;
never switch servers, credentials or routes to bypass this restriction. Guides describe
capabilities available with full delegation; always respect the current tool list.

## Category map (114 tools)

| Category | Purpose | Roles |
| --- | --- | --- |
| consumer (5) | Identity, published agents, chat and history | All |
| consumer-profile (3) | Consumer profiles and sessions | Owner/admin/editor |
| consumer-ops (10) | Consumer and session controls, operator messages and process intervention | Owner/admin |
| builder-read (51) | Configuration, validation, diagnostics, budgets, processes and integrations | Owner/admin/editor; individual tools may require a higher role |
| builder-write (45) | Configuration changes, publication, policies and integration grants | Owner/admin; grants require owner |

For process definitions and instances, read `zihin://skills/processos`.
