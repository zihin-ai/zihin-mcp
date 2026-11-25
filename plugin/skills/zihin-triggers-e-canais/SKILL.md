---
name: zihin-triggers-e-canais
description: Use this guide to connect an agent to webhooks, schedules or email, choose session and response behavior, and validate delivery to the intended external channel.
---

# Configure triggers and channels

Read `zihin://schemas/trigger_config` and the tool input schema. Establish the source
system, message field, expected response format and session continuity requirements.

For webhooks, configure message extraction, response adapter, session strategy, sender
access and execution mode. Derived session fields must resolve through `context_mapping`;
otherwise continuity may be lost. Use only documented sender-access modes. Choose
synchronous responses or asynchronous execution with a configured callback.

Use the returned `call` block for the callable URL and authentication header. Do not guess
the route or authentication mode. API-key and signature authentication require different
headers. Trigger responses do not disclose the account API key. Store callback credentials
as tenant secrets and reference them by `secret_ref`.

For schedules, supply a cron expression, time zone and query template. The cron expression
has exactly five fields (minute hour day-of-month month day-of-week); a seconds field is
rejected. Any two runs must be at least 5 minutes apart, so `*/5 * * * *` is the most
frequent accepted schedule and lists, ranges and steps are checked the same way. The time
zone must be a valid IANA name. These rules apply on create, on update and when enabling a
disabled trigger. Schedules are available on Core, Pro and Business plans; a plan without
the feature answers `PLAN_LIMIT_REACHED` on create and on enable. A company without an active
subscription gets the same code for every trigger type, with `details.plan_code` set to `none`;
disabling a trigger is always allowed. Choose a supported
output channel. Scheduled runs open new sessions by default; use persistent memory or a
supported delivery target when continuity is needed. Dynamic event templates do not
resolve without event context: use a literal target for a schedule.

Output channels differ by trigger type. Check the schema and documentation before
assuming a webhook and schedule implement the same delivery options. Do not select
reserved channels. For email, configure allowed senders and filtering as required.

`test_trigger` executes the agent using a temporary session and can consume credits or
cause external effects. Inspect execution history and delivery results. Use
`toggle_trigger` to disable automation without deleting its configuration.

The `output.channel` contract in `zihin://schemas/trigger_config` is `silent | webhook | callback | user` (`agent` is reserved and not implemented).
Schedules support these delivery channels. Webhooks respond through response_adapter
for synchronous execution or execution.callback for asynchronous execution; their output
block supports only user delivery. Do not assume schedule delivery behavior applies to
webhooks. Legacy context_defaults is ignored; use the documented context mapping and
MCP defaults_from_context where appropriate.

Discover configuration with `list_triggers` and `get_trigger`. Use
`list_trigger_executions`, `get_trigger_execution` and `get_session_trigger_context`
to inspect runs and their triggering context. `update_trigger` replaces trigger_config
when supplied, so read and preserve the complete configuration before updating it.
Use `get_scheduler_status` to inspect active schedule jobs and their last execution.

Use `create_trigger` only after confirming the required channel, authentication and delivery settings.
