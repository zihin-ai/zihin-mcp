---
name: zihin-criar-agente
description: Use this guide to create, configure, validate and publish a hosted Zihin agent, including its persona, tools, channels and optional memory settings.
---

# Create and publish an agent

1. Establish the intended role, objective and behavior with the user. Discover available
   models through `zihin://models` and inspect `zihin://schemas/llm_config`.
2. Call `create_agent` with the required fields. Use a valid provider-qualified model ID
   or `auto`. Keep the returned `agent_id` and address plan or model-tier warnings.
3. Create a `persona_config` schema. Read `zihin://schemas/persona_config`; the persona
   belongs under `editor_schema.persona`, not a legacy root-level instructions field.
4. Add optional `skill_config` schemas with clear instructions and unique skill names.
   For external capabilities, read `zihin://skills/tools-de-agente`.
5. Run `validate_agent_schemas`, inspect `list_agent_tools` and review `get_agent_full`.
   Resolve invalid schemas and tools cited outside the available surface. If validation
   reports a surface error, do not interpret an empty result as a successful check.
6. Call `publish_agent` only after validation succeeds. Publication can reject a model
   that exceeds the plan tier even if an earlier save returned only a warning.
   `unpublish_agent` takes a published agent offline: its webhooks stop answering and it
   leaves `list_agents` until republished (find it with `include_unpublished`).

Enable native chat with the chat_enabled field when requested. Read the trigger guide before
connecting external channels. Persistent memory requires `memory_enabled`; a skill
alone does not enable it. Keep consumer identities distinct and do not reuse a session
across people. Use dedicated engagement and session controls for operational state.

For updates, read a schema's current version and provide `base_version` when saving.
On `CONFLICT`, reload and reconcile the changes. Schema data replaces the whole document.
Validate and publish again. Use snapshot/version tools for supported rollback operations.

Inspect an existing agent with `get_agent` or `get_agent_full`, and read configuration
with `get_schema`. Use `clone_agent` only when duplication is intended and available
under the connection policy. Inspect `list_versions`, `compare_versions`,
`list_agent_history` and `list_snapshots` before using `rollback_version` or
`rollback_snapshot`; restoration overwrites current configuration. Triggers are restored
through the same rules as any trigger edit: one the current plan does not include comes back
disabled, one whose configuration the current rules refuse is left as it is, and both are listed
in `warnings`. A pending Builder proposal for a trigger blocks the rollback.
Inspect persistent memory with `list_agent_memory`. `delete_agent_memory` removes a
selected memory and cannot remove platform control entries.

Use `update_schema` with base_version for edits; it replaces the supplied schema document.
