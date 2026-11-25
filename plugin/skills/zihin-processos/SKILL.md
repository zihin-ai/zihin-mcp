---
name: zihin-processos
description: Use this guide to validate, publish and enable process definitions, configure worker recipes, inspect running instances and resolve permitted process incidents.
---

# Configure and operate processes

A definition is a versioned template published by an admin or owner. An instance is one
execution opened by an agent using that template. Publishing does not enable a definition;
agents can open only definitions enabled for the organization. Running instances keep
the version with which they started.

1. Read `zihin://schemas/process_definition` and construct the definition without version.
   Discover existing definitions with `list_process_definitions` and `get_process_definition`.
2. Run `validate_process_definition`. Resolve structural errors and inspect warnings about
   referenced agents, policies and MCP servers.
3. Run `publish_process_definition`, then `enable_process` for its key (or `*` for all
   published definitions). `disable_process` removes enablement without retiring the definition. Inspect `get_process_engine_status` to confirm availability.
4. Monitor with `list_process_instances`, `get_process_instance` and `get_process_trail`.
   Editors receive status metadata; variables, tasks, files and detailed trails require
   admin or owner.
5. Intervene with `cancel_process_instance` or `resolve_process_incident` when authorized.
   A returned command_id with status received acknowledges the request; it does not prove
   completion. Poll `get_process_command` for applied or rejected with a reason instead of
   repeating the mutation.
6. Use `retire_process_definition` to retire every version of a definition key.

Check open_tasks[].allowed_resolutions before resolving an incident. substitute_output
applies only to agent steps. Retrying after max_attempts is exhausted blocks again.
Approvals and information requests belong to their designated participants. A process
with closing_blocked requires Zihin support; these intervention tools cannot resolve it.

Publishing, enabling and intervention require an API key created by an admin or owner
who is still active in the organization. Personal OAuth follows the person's role, but
publication and enablement must be completed in the Zihin console. Do not bypass this
restriction with another credential or server.

## Compute recipes

A compute step processes referenced data outside the conversation. Store the worker
recipe in the definition:

- request: one fixed recipe.
- requests and choose_from: named recipes selected by an opening variable whose enum
  contains those names.
- request_from: the legacy reference-based form.

An MCP data source is accessible only when the instance is opened by the agent that owns
that MCP server. A source taken from another agent step's output is not supported.
For example, a single fixed recipe can inspect a complete dataset:

```json
{
  "key": "inspect-catalog",
  "title": "Inspect the product catalog",
  "description": "Use when the user requests an analysis of the complete product catalog.",
  "variables_schema": { "type": "object", "additionalProperties": false, "properties": {} },
  "budget_limit_usd": 1,
  "incident_owner": "owner",
  "on_reject": "complete_rejected",
  "steps": [
    {
      "key": "inspect", "kind": "compute", "title": "Inspect the catalog", "max_attempts": 2,
      "request": {
        "capability": "dataset.inspect.v1", "parameters": {},
        "source": {
          "kind": "mcp", "mcp_server_id": "<agent-owned server UUID>",
          "tool": "list-products", "arguments": {}, "columns": ["id", "name"],
          "data_source_meta": true, "name": "products.csv"
        }
      }
    },
    {
      "key": "notify", "kind": "notify", "title": "Report results",
      "target": "origin_session", "template": "Inspected {{inspect.output.export.rows}} rows.",
      "attach_from": "inspect.output"
    }
  ]
}
```

## Conversation tools

The agent uses `open_process` to start an instance, `get_process_status` to inspect it,
`list_my_processes` to list the person's processes and `list_my_tasks` for participant
work. `cancel_process` requires confirmation in a separate user reply before cancellation.

For ad hoc analysis, `analyze_data` uses an agent-owned data tool and worker code to
produce a report, charts and a spreadsheet without requiring a custom definition.
It uses the platform-provided definition and requires process-engine access. Data reads
and execution happen outside the conversation; report failures rather than assuming a
successful export.
