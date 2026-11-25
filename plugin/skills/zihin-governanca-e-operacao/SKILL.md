---
name: zihin-governanca-e-operacao
description: Use this guide to manage agent budgets, contextual security policies, human approval, operator handoff, consumer restrictions and recovery from operational blocks.
---

# Govern and operate agents

Read the current schema before changing a policy. Use least-privilege API keys and verify
the effective configuration after each change.

Agent budgets are USD spending limits; plan quota is a separate control. Inspect
`get_agent_budget` or `list_agent_budgets`, then use `set_agent_budget` as authorized.
Apply limits to child agents as well when controlling multi-agent costs. In-flight work
can complete after a limit is reached; a higher limit permits subsequent turns.

For CSPs, inspect `zihin://schemas/csp_config` and `get_effective_csps`. Use documented
rule names and scopes. `update_csp` replaces the full rules object. Tool restrictions
require exact names, including external MCP prefixes. Do not rely on unsupported origin
rules as an access-control boundary.

Examples of supported rules:
- schedule: { allowed_days: ["monday", "tuesday", "wednesday", "thursday", "friday"], allowed_hours: { start: "09:00", end: "17:00" }, timezone: "UTC" }
- behavior: { must_not_tools: ["server_delete_record"], max_tool_calls: 10 }
- data: { never_expose: ["payment credentials"], sensitive_fields: ["account_number"] }

Data rules guide the model's behavior; they do not provide programmatic masking of
responses. Keep access controls and secret handling in the underlying systems.

Human approval connects an approval policy to a behavior CSP using `require_approval_for`
and `approval_policy_id`. Inspect `zihin://schemas/approval_policy` for approver formats.
Use the native chat approval flow to decide requests; listing approvals does not approve them.

For operator handoff, set the session to `manual_handoff` or `suspended` before sending
manual messages. Check uncertain delivery outcomes before retrying and preserve the
idempotency key. Cancel an active turn when needed; restore `engaged` to resume automation.

Use `set_engagement_control` to stop one agent serving a consumer, or
`set_consumer_denylist` for an account-wide restriction. Inspect the consumer profile
first. Keep consumer identities distinct: account administrators must not reuse another
person's session. Use dedicated controls rather than storing operational state as memory.

## Shared integrations

An integration is an external destination owned by an organization, reached through the
Zihin Tunnel (kind tunnel, the only kind the platform runs today).
Another organization or one of its agents needs an active grant from the owner.

1. Use `create_integration` with kind tunnel, name, target and limits.
   target and limits are immutable; register a new integration to expand access.
   For kind tunnel, target is { service } with the service name declared in the tunnel
   agent; the integration is created ready to use, with the tunnel credential attached
   by the platform.
2. Do not call `attach_integration_credential` for a tunnel integration: it rejects the
   call. The key of the service behind the tunnel stays in the tunnel agent configuration
   (inject_headers of the service in zihin-agent.yml) and never goes to Zihin.
3. Use `grant_integration` with consumer_tenant_id, optional consumer_agent_id,
   allowed_operations (absent or empty = all operations) and expires_at (ISO 8601 with
   timezone, in the future). A lapsed grant does not block a new one. Use
   `revoke_integration_grant` to remove access.
4. Inspect `list_integrations` and `list_integration_grants` (as owner or consumer).
   A migrated grant in pending_ratification requires `ratify_integration_grant`.

Creating integrations and attaching credentials require admin/owner. Granting, ratifying
and revoking require owner; an admin sees these tools but receives INSUFFICIENT_PERMISSIONS.
An agent MCP server can reference integration_id. With auth_method=tunnel, destination
access requires the grant; with other methods the link is informational.
Personal OAuth supports listing and revocation. Creation, credential attachment, granting
and ratification must be completed in the Zihin console.

Manage approval policies with `list_approval_policies`, `get_approval_policy` and
`update_approval_policy`; `list_approvals` lists requests without deciding them.
Use `set_session_control` before `send_manual_message` for handoff. `cancel_agent_turn`
interrupts work already running. Inspect `list_consumer_sessions` before intervention.
`clear_session` irreversibly removes history; `archive_session` and `unarchive_session`
change visibility reversibly. Use `toggle_csp` to suspend a policy without deleting it.
Create least-privilege credentials with `create_api_key`. `list_secrets` returns metadata;
`create_secret` and `update_secret` store credentials without revealing plaintext later.

`delete_csp` permanently removes a policy and its restrictions; prefer toggling when
the change should be reversible.
